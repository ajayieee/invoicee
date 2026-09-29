-- ============================================================================
-- 04_triggers_and_guards.sql
-- Business Rules, Immutability Guards, Overpayment Protection & Sequence Locks
-- ============================================================================

-- 1. CONCURRENCY-SAFE MONOTONIC DOCUMENT NUMBER GENERATOR
CREATE OR REPLACE FUNCTION get_next_document_number(
    p_org_id UUID,
    p_doc_type doc_type_enum,
    p_year INTEGER,
    p_prefix VARCHAR
) RETURNS VARCHAR AS $$
DECLARE
    v_next_num INTEGER;
    v_padding INTEGER := 4;
    v_result VARCHAR;
BEGIN
    -- Ensure partition exists for (org_id, doc_type, year)
    INSERT INTO document_sequences (organization_id, doc_type, prefix, year, current_number, padding)
    VALUES (p_org_id, p_doc_type, p_prefix, p_year, 0, v_padding)
    ON CONFLICT (organization_id, doc_type, year) DO NOTHING;

    -- Pessimistic row-level lock against concurrent transactions
    SELECT current_number + 1, padding
    INTO v_next_num, v_padding
    FROM document_sequences
    WHERE organization_id = p_org_id AND doc_type = p_doc_type AND year = p_year
    FOR UPDATE;

    -- Increment counter atomically
    UPDATE document_sequences
    SET current_number = v_next_num, updated_at = NOW()
    WHERE organization_id = p_org_id AND doc_type = p_doc_type AND year = p_year;

    -- Format standard monotonic sequence: e.g. INV-2026-0001
    v_result := p_prefix || '-' || p_year::TEXT || '-' || LPAD(v_next_num::TEXT, v_padding, '0');
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 2. FINANCIAL DOCUMENT DELETION PREVENTION TRIGGER
-- Rule: Do not allow financial documents to be casually deleted.
CREATE OR REPLACE FUNCTION prevent_financial_document_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'invoices' THEN
        IF OLD.status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED') THEN
            RAISE EXCEPTION 'Accounting Principle Violation: Cannot delete non-draft invoice (%). Issued financial records must remain for unbroken sequence auditing.', OLD.invoice_number;
        END IF;
    ELSIF TG_TABLE_NAME = 'credit_notes' THEN
        IF OLD.status IN ('ISSUED', 'APPLIED', 'REFUNDED') THEN
            RAISE EXCEPTION 'Accounting Principle Violation: Cannot delete issued credit note (%).', OLD.credit_note_number;
        END IF;
    ELSIF TG_TABLE_NAME = 'payments' THEN
        RAISE EXCEPTION 'Accounting Principle Violation: Recorded payments cannot be deleted. Perform a payment reversal with an audit explanation instead.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_invoice_deletion
    BEFORE DELETE ON invoices
    FOR EACH ROW EXECUTE FUNCTION prevent_financial_document_deletion();

CREATE TRIGGER trg_prevent_credit_note_deletion
    BEFORE DELETE ON credit_notes
    FOR EACH ROW EXECUTE FUNCTION prevent_financial_document_deletion();

CREATE TRIGGER trg_prevent_payment_deletion
    BEFORE DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION prevent_financial_document_deletion();

-- 3. ISSUED INVOICE IMMUTABILITY GUARD
-- Rule: Do not allow users to modify issued financial documents in a way that destroys historical information.
CREATE OR REPLACE FUNCTION lock_issued_invoice_modifications()
RETURNS TRIGGER AS $$
BEGIN
    -- If already issued or settled, forbid changing financial numbers, customer, or dates
    IF OLD.status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED') THEN
        IF NEW.invoice_number != OLD.invoice_number THEN
            RAISE EXCEPTION 'Security Violation: Cannot alter invoice number of an issued invoice.';
        END IF;
        IF NEW.organization_id != OLD.organization_id THEN
            RAISE EXCEPTION 'Security Violation: Cannot alter organization ownership of an issued invoice.';
        END IF;
        IF NEW.customer_id != OLD.customer_id THEN
            RAISE EXCEPTION 'Security Violation: Cannot change customer on an issued invoice.';
        END IF;
        IF NEW.subtotal_net != OLD.subtotal_net OR NEW.vat_total != OLD.vat_total OR NEW.grand_total != OLD.grand_total THEN
            -- Allow updates only if driven by payment balance updates or cancellations
            IF NEW.status NOT IN ('PARTIALLY_PAID', 'PAID', 'CANCELLED', OLD.status) THEN
                RAISE EXCEPTION 'Audit Violation: Cannot modify monetary figures of an issued invoice. Adjustments must be performed via Credit Notes.';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lock_issued_invoices
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION lock_issued_invoice_modifications();

-- 4. LINE ITEM CALCULATION ENGINE & CONSISTENCY CHECK
CREATE OR REPLACE FUNCTION calculate_line_item_math()
RETURNS TRIGGER AS $$
DECLARE
    v_gross_net NUMERIC(15, 4);
    v_discount NUMERIC(15, 2) := 0.00;
    v_subtotal NUMERIC(15, 2);
    v_vat NUMERIC(15, 2) := 0.00;
BEGIN
    v_gross_net := NEW.quantity * NEW.unit_price;

    -- Calculate line discount
    IF NEW.discount_value IS NOT NULL AND NEW.discount_value > 0 THEN
        IF NEW.discount_type = 'PERCENTAGE' THEN
            v_discount := ROUND((v_gross_net * NEW.discount_value / 100.00), 2);
        ELSE
            v_discount := ROUND(NEW.discount_value, 2);
        END IF;
    END IF;

    -- Discount cannot exceed line gross
    IF v_discount > v_gross_net THEN
        v_discount := ROUND(v_gross_net, 2);
    END IF;

    v_subtotal := ROUND(v_gross_net, 2) - v_discount;

    -- Calculate line VAT (Standard 5% or 0%)
    IF NEW.vat_rate_percentage > 0 THEN
        v_vat := ROUND((v_subtotal * NEW.vat_rate_percentage / 100.00), 2);
    END IF;

    NEW.discount_amount := v_discount;
    NEW.subtotal_net := v_subtotal;
    NEW.vat_amount := v_vat;
    NEW.total_gross := v_subtotal + v_vat;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calc_invoice_item_math
    BEFORE INSERT OR UPDATE ON invoice_items
    FOR EACH ROW EXECUTE FUNCTION calculate_line_item_math();

CREATE TRIGGER trg_calc_quote_item_math
    BEFORE INSERT OR UPDATE ON quote_items
    FOR EACH ROW EXECUTE FUNCTION calculate_line_item_math();

-- 5. PAYMENT SYNCHRONIZER & OVERPAYMENT GUARD
CREATE OR REPLACE FUNCTION sync_payment_balance_and_overpayment_guard()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice RECORD;
    v_total_recorded_paid NUMERIC(15, 2) := 0.00;
    v_new_balance NUMERIC(15, 2);
BEGIN
    -- Acquire pessimistic lock on the target invoice
    SELECT * INTO v_invoice
    FROM invoices
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id)
    FOR UPDATE;

    IF v_invoice.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Operation Error: Cannot apply or modify payments on a CANCELLED invoice.';
    END IF;

    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Overpayment Guard Rule: Do not silently accept overpayments!
        IF NEW.status = 'RECORDED' AND (TG_OP = 'INSERT' OR OLD.status != 'RECORDED') THEN
            IF NEW.amount > v_invoice.balance_due AND NEW.allow_overpayment IS NOT TRUE THEN
                RAISE EXCEPTION 'Overpayment Guard Violation: Payment amount (AED %) exceeds invoice balance due (AED %). Explicit authorization flag required.', 
                    NEW.amount, v_invoice.balance_due;
            END IF;
        END IF;
    END IF;

    -- Recalculate total payments recorded for this invoice
    SELECT COALESCE(SUM(amount), 0.00)
    INTO v_total_recorded_paid
    FROM payments
    WHERE invoice_id = v_invoice.id AND status = 'RECORDED';

    v_new_balance := ROUND(v_invoice.grand_total - v_total_recorded_paid, 2);
    IF v_new_balance < 0 THEN
        v_new_balance := 0.00;
    END IF;

    -- Update invoice balance and lifecycle state
    UPDATE invoices
    SET 
        amount_paid = v_total_recorded_paid,
        balance_due = v_new_balance,
        status = CASE 
            WHEN v_new_balance = 0.00 THEN 'PAID'::invoice_status_enum
            WHEN v_total_recorded_paid > 0.00 THEN 'PARTIALLY_PAID'::invoice_status_enum
            WHEN v_invoice.due_date < CURRENT_DATE THEN 'OVERDUE'::invoice_status_enum
            ELSE 'ISSUED'::invoice_status_enum
        END,
        updated_at = NOW()
    WHERE id = v_invoice.id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_payment_balance
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION sync_payment_balance_and_overpayment_guard();

-- 6. CREDIT NOTE ALLOCATION SYNCHRONIZER
CREATE OR REPLACE FUNCTION sync_credit_note_allocation()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice RECORD;
    v_credit_note RECORD;
    v_allocated_total NUMERIC(15, 2);
BEGIN
    SELECT * INTO v_credit_note FROM credit_notes WHERE id = NEW.credit_note_id FOR UPDATE;

    IF NEW.allocation_type = 'INVOICE_OFFSET' AND NEW.invoice_id IS NOT NULL THEN
        SELECT * INTO v_invoice FROM invoices WHERE id = NEW.invoice_id FOR UPDATE;

        IF NEW.amount > v_invoice.balance_due THEN
            RAISE EXCEPTION 'Credit Allocation Error: Credit amount (AED %) exceeds invoice balance due (AED %).',
                NEW.amount, v_invoice.balance_due;
        END IF;

        -- Reduce invoice balance due
        UPDATE invoices
        SET 
            balance_due = ROUND(balance_due - NEW.amount, 2),
            status = CASE 
                WHEN (balance_due - NEW.amount) <= 0 THEN 'PAID'::invoice_status_enum
                ELSE status 
            END,
            updated_at = NOW()
        WHERE id = v_invoice.id;
    END IF;

    -- Recalculate remaining balance on credit note
    SELECT COALESCE(SUM(amount), 0.00) INTO v_allocated_total
    FROM credit_note_allocations
    WHERE credit_note_id = v_credit_note.id;

    UPDATE credit_notes
    SET 
        remaining_balance = ROUND(grand_total - v_allocated_total, 2),
        status = CASE 
            WHEN (grand_total - v_allocated_total) <= 0 THEN 
                CASE WHEN NEW.allocation_type = 'CASH_REFUND' THEN 'REFUNDED'::credit_note_status_enum
                ELSE 'APPLIED'::credit_note_status_enum END
            ELSE status
        END,
        updated_at = NOW()
    WHERE id = v_credit_note.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_credit_note_allocation
    AFTER INSERT ON credit_note_allocations
    FOR EACH ROW EXECUTE FUNCTION sync_credit_note_allocation();

-- 7. AUDIT TRAIL AUTOMATION TRIGGER
CREATE OR REPLACE FUNCTION log_financial_audit_trail()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
    v_action VARCHAR(50);
    v_old_json JSONB := NULL;
    v_new_json JSONB := NULL;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_org_id := NEW.organization_id;
        v_action := 'CREATED';
        v_new_json := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_org_id := NEW.organization_id;
        v_action := 'UPDATED';
        v_old_json := to_jsonb(OLD);
        v_new_json := to_jsonb(NEW);
        
        -- Specific actions
        IF TG_TABLE_NAME = 'invoices' THEN
            IF OLD.status != 'CANCELLED' AND NEW.status = 'CANCELLED' THEN
                v_action := 'CANCELLED';
            ELSIF OLD.status = 'DRAFT' AND NEW.status = 'ISSUED' THEN
                v_action := 'ISSUED';
            END IF;
        ELSIF TG_TABLE_NAME = 'payments' THEN
            IF OLD.status != 'REVERSED' AND NEW.status = 'REVERSED' THEN
                v_action := 'REVERSED';
            END IF;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        v_org_id := OLD.organization_id;
        v_action := 'DELETED';
        v_old_json := to_jsonb(OLD);
    END IF;

    INSERT INTO audit_logs (
        organization_id,
        entity_type,
        entity_id,
        action,
        old_values,
        new_values,
        performed_by_name
    ) VALUES (
        v_org_id,
        UPPER(TG_TABLE_NAME),
        COALESCE(NEW.id, OLD.id),
        v_action,
        v_old_json,
        v_new_json,
        'System Trigger'
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_invoices
    AFTER INSERT OR UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION log_financial_audit_trail();

CREATE TRIGGER trg_audit_payments
    AFTER INSERT OR UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION log_financial_audit_trail();

CREATE TRIGGER trg_audit_credit_notes
    AFTER INSERT OR UPDATE ON credit_notes
    FOR EACH ROW EXECUTE FUNCTION log_financial_audit_trail();
