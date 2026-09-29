-- ============================================================================
-- UAE INVOICING & SALES MANAGEMENT SYSTEM: MASTER POSTGRESQL SCHEMA
-- Fully Normalized, Audit-Compliant, FTA 5% VAT Ready for Supabase / PostgreSQL
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS & ENUMS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE customer_type_enum AS ENUM ('COMPANY', 'INDIVIDUAL');
CREATE TYPE customer_relation_enum AS ENUM ('PROSPECT', 'CUSTOMER');
CREATE TYPE uae_emirate_enum AS ENUM (
    'ABU_DHABI', 'DUBAI', 'SHARJAH', 'AJMAN', 
    'UMM_AL_QUWAIN', 'RAS_AL_KHAIMAH', 'FUJAIRAH'
);

CREATE TYPE vat_treatment_enum AS ENUM (
    'STANDARD_RATED',   -- 5% Standard UAE VAT
    'ZERO_RATED',       -- 0% Tax (Exports outside GCC, designated education/healthcare)
    'EXEMPT',           -- Tax Exempt
    'OUT_OF_SCOPE'      -- Out of territorial scope
);

CREATE TYPE quote_status_enum AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED');
CREATE TYPE invoice_status_enum AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');
CREATE TYPE payment_status_enum AS ENUM ('RECORDED', 'REVERSED');
CREATE TYPE credit_note_status_enum AS ENUM ('DRAFT', 'ISSUED', 'APPLIED', 'REFUNDED', 'CANCELLED');
CREATE TYPE discount_type_enum AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');
CREATE TYPE einvoice_status_enum AS ENUM ('NOT_APPLICABLE', 'PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'CANCELLED');
CREATE TYPE doc_type_enum AS ENUM ('QUOTE', 'INVOICE', 'CREDIT_NOTE', 'PAYMENT');
CREATE TYPE allocation_type_enum AS ENUM ('INVOICE_OFFSET', 'CASH_REFUND');

-- ============================================================================
-- 2. TENANCY & COMPANY PROFILE
-- ============================================================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'OWNER',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, user_id)
);

CREATE TABLE company_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    legal_company_name VARCHAR(255) NOT NULL,
    trading_name VARCHAR(255),
    trn VARCHAR(15),
    tax_registration_date DATE,
    address_line_1 TEXT NOT NULL,
    address_line_2 TEXT,
    city VARCHAR(100) NOT NULL,
    emirate uae_emirate_enum NOT NULL DEFAULT 'DUBAI',
    country VARCHAR(100) NOT NULL DEFAULT 'United Arab Emirates',
    po_box VARCHAR(50),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    mobile VARCHAR(50),
    website VARCHAR(255),
    logo_url TEXT,
    default_currency VARCHAR(3) NOT NULL DEFAULT 'AED',
    default_vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
    invoice_prefix VARCHAR(10) NOT NULL DEFAULT 'INV',
    quote_prefix VARCHAR(10) NOT NULL DEFAULT 'QUO',
    credit_note_prefix VARCHAR(10) NOT NULL DEFAULT 'CN',
    payment_prefix VARCHAR(10) NOT NULL DEFAULT 'PAY',
    default_payment_terms_days INTEGER NOT NULL DEFAULT 30,
    bank_name VARCHAR(150),
    bank_account_name VARCHAR(255),
    bank_account_number VARCHAR(50),
    bank_iban VARCHAR(50),
    bank_swift_bic VARCHAR(20),
    bank_branch VARCHAR(100),
    invoice_footer_notes TEXT,
    terms_and_conditions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_company_trn CHECK (trn IS NULL OR trn ~ '^[0-9]{15}$'),
    CONSTRAINT chk_default_currency_len CHECK (char_length(default_currency) = 3),
    CONSTRAINT chk_default_vat_rate_range CHECK (default_vat_rate >= 0.00 AND default_vat_rate <= 100.00),
    CONSTRAINT chk_payment_terms_positive CHECK (default_payment_terms_days >= 0)
);

-- ============================================================================
-- 3. VAT RATES & PAYMENT METHODS
-- ============================================================================
CREATE TABLE vat_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    rate_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    treatment vat_treatment_enum NOT NULL DEFAULT 'STANDARD_RATED',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (organization_id, code),
    CONSTRAINT chk_vat_rate_percentage_range CHECK (rate_percentage >= 0.00 AND rate_percentage <= 100.00)
);

CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (organization_id, code)
);

-- ============================================================================
-- 4. CUSTOMERS & CONTACTS
-- ============================================================================
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_type customer_type_enum NOT NULL DEFAULT 'COMPANY',
    relation_type customer_relation_enum NOT NULL DEFAULT 'CUSTOMER',
    company_name VARCHAR(255),
    contact_person VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    trn VARCHAR(15),
    billing_address_line_1 TEXT,
    billing_address_line_2 TEXT,
    billing_city VARCHAR(100),
    billing_emirate uae_emirate_enum DEFAULT 'DUBAI',
    billing_country VARCHAR(100) DEFAULT 'United Arab Emirates',
    billing_po_box VARCHAR(50),
    shipping_address_line_1 TEXT,
    shipping_address_line_2 TEXT,
    shipping_city VARCHAR(100),
    shipping_emirate uae_emirate_enum,
    shipping_country VARCHAR(100) DEFAULT 'United Arab Emirates',
    payment_terms_days INTEGER NOT NULL DEFAULT 30,
    currency VARCHAR(3) NOT NULL DEFAULT 'AED',
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_customer_trn CHECK (trn IS NULL OR trn ~ '^[0-9]{15}$'),
    CONSTRAINT chk_customer_terms_positive CHECK (payment_terms_days >= 0),
    CONSTRAINT chk_customer_currency_len CHECK (char_length(currency) = 3),
    CONSTRAINT chk_customer_company_name_if_corp CHECK (
        (customer_type = 'COMPANY' AND company_name IS NOT NULL AND length(trim(company_name)) > 0)
        OR (customer_type = 'INDIVIDUAL')
    )
);

CREATE TABLE customer_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    designation VARCHAR(100),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. PRODUCTS & SERVICES
-- ============================================================================
CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, name)
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    description TEXT,
    unit VARCHAR(50) NOT NULL DEFAULT 'Unit',
    cost_price NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    selling_price NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    vat_rate_id UUID NOT NULL REFERENCES vat_rates(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (organization_id, sku),
    CONSTRAINT chk_prod_cost_positive CHECK (cost_price >= 0.0000),
    CONSTRAINT chk_prod_selling_positive CHECK (selling_price >= 0.0000)
);

-- ============================================================================
-- 6. SEQUENTIAL NUMBERING, QUOTES & INVOICES
-- ============================================================================
CREATE TABLE document_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    doc_type doc_type_enum NOT NULL,
    prefix VARCHAR(20) NOT NULL,
    year INTEGER NOT NULL,
    current_number INTEGER NOT NULL DEFAULT 0,
    padding INTEGER NOT NULL DEFAULT 4,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (organization_id, doc_type, year),
    CONSTRAINT chk_seq_number_positive CHECK (current_number >= 0),
    CONSTRAINT chk_seq_padding_valid CHECK (padding >= 3 AND padding <= 10)
);

CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    quote_number VARCHAR(100) NOT NULL,
    quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE NOT NULL,
    status quote_status_enum NOT NULL DEFAULT 'DRAFT',
    currency VARCHAR(3) NOT NULL DEFAULT 'AED',
    exchange_rate NUMERIC(12, 6) NOT NULL DEFAULT 1.000000,
    subtotal_net NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    discount_type discount_type_enum,
    discount_value NUMERIC(15, 2) DEFAULT 0.00,
    discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    vat_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    terms TEXT,
    converted_invoice_id UUID,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (organization_id, quote_number),
    CONSTRAINT chk_quote_expiry_after_date CHECK (expiry_date >= quote_date),
    CONSTRAINT chk_quote_non_negative_amounts CHECK (
        subtotal_net >= 0.00 AND discount_amount >= 0.00 AND vat_total >= 0.00 AND grand_total >= 0.00
    ),
    CONSTRAINT chk_quote_discount_le_subtotal CHECK (discount_amount <= subtotal_net)
);

CREATE TABLE quote_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    item_order INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL,
    quantity NUMERIC(12, 4) NOT NULL DEFAULT 1.0000,
    unit_price NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    unit VARCHAR(50) DEFAULT 'Unit',
    discount_type discount_type_enum,
    discount_value NUMERIC(15, 2) DEFAULT 0.00,
    discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    subtotal_net NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    vat_rate_id UUID NOT NULL REFERENCES vat_rates(id) ON DELETE RESTRICT,
    vat_rate_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    vat_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_gross NUMERIC(15, 2) NOT NULL DEFAULT 0.00,

    CONSTRAINT chk_qi_quantity_positive CHECK (quantity > 0.0000),
    CONSTRAINT chk_qi_unit_price_non_negative CHECK (unit_price >= 0.0000),
    CONSTRAINT chk_qi_discount_non_negative CHECK (discount_amount >= 0.00),
    CONSTRAINT chk_qi_subtotal_net_non_negative CHECK (subtotal_net >= 0.00),
    CONSTRAINT chk_qi_vat_amount_non_negative CHECK (vat_amount >= 0.00),
    CONSTRAINT chk_qi_total_gross_match CHECK (total_gross = (subtotal_net + vat_amount))
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    originating_quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
    invoice_number VARCHAR(100) NOT NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supply_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    status invoice_status_enum NOT NULL DEFAULT 'DRAFT',
    currency VARCHAR(3) NOT NULL DEFAULT 'AED',
    exchange_rate NUMERIC(12, 6) NOT NULL DEFAULT 1.000000,
    subtotal_net NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    discount_type discount_type_enum,
    discount_value NUMERIC(15, 2) DEFAULT 0.00,
    discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    vat_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    balance_due NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    customer_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    company_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    bank_details_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes TEXT,
    terms TEXT,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    cancelled_by UUID,
    e_invoice_status einvoice_status_enum NOT NULL DEFAULT 'NOT_APPLICABLE',
    e_invoice_uuid VARCHAR(100),
    e_invoice_hash VARCHAR(255),
    e_invoice_qr_code TEXT,
    e_invoice_submitted_at TIMESTAMPTZ,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (organization_id, invoice_number),
    CONSTRAINT chk_inv_due_date_after_date CHECK (due_date >= invoice_date),
    CONSTRAINT chk_inv_non_negative_amounts CHECK (
        subtotal_net >= 0.00 AND discount_amount >= 0.00 AND vat_total >= 0.00 AND 
        grand_total >= 0.00 AND amount_paid >= 0.00 AND balance_due >= 0.00
    ),
    CONSTRAINT chk_inv_discount_le_subtotal CHECK (discount_amount <= subtotal_net),
    CONSTRAINT chk_inv_balance_math CHECK (balance_due = (grand_total - amount_paid)),
    CONSTRAINT chk_inv_cancellation_reason_if_cancelled CHECK (
        (status = 'CANCELLED' AND cancellation_reason IS NOT NULL AND length(trim(cancellation_reason)) > 0)
        OR (status != 'CANCELLED')
    )
);

ALTER TABLE quotes 
    ADD CONSTRAINT fk_quotes_converted_invoice 
    FOREIGN KEY (converted_invoice_id) 
    REFERENCES invoices(id) ON DELETE SET NULL;

CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    item_order INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL,
    quantity NUMERIC(12, 4) NOT NULL DEFAULT 1.0000,
    unit_price NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    unit VARCHAR(50) DEFAULT 'Unit',
    discount_type discount_type_enum,
    discount_value NUMERIC(15, 2) DEFAULT 0.00,
    discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    subtotal_net NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    vat_rate_id UUID NOT NULL REFERENCES vat_rates(id) ON DELETE RESTRICT,
    vat_rate_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    vat_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_gross NUMERIC(15, 2) NOT NULL DEFAULT 0.00,

    CONSTRAINT chk_ii_quantity_positive CHECK (quantity > 0.0000),
    CONSTRAINT chk_ii_unit_price_non_negative CHECK (unit_price >= 0.0000),
    CONSTRAINT chk_ii_discount_non_negative CHECK (discount_amount >= 0.00),
    CONSTRAINT chk_ii_subtotal_net_non_negative CHECK (subtotal_net >= 0.00),
    CONSTRAINT chk_ii_vat_amount_non_negative CHECK (vat_amount >= 0.00),
    CONSTRAINT chk_ii_total_gross_match CHECK (total_gross = (subtotal_net + vat_amount))
);

-- ============================================================================
-- 7. PAYMENTS & CREDIT NOTES
-- ============================================================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    payment_number VARCHAR(100) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method_id UUID NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'AED',
    exchange_rate NUMERIC(12, 6) NOT NULL DEFAULT 1.000000,
    reference_number VARCHAR(100),
    notes TEXT,
    status payment_status_enum NOT NULL DEFAULT 'RECORDED',
    reversed_at TIMESTAMPTZ,
    reversal_reason TEXT,
    reversed_by UUID,
    allow_overpayment BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (organization_id, payment_number),
    CONSTRAINT chk_payment_amount_positive CHECK (amount > 0.00),
    CONSTRAINT chk_payment_reversal_reason CHECK (
        (status = 'REVERSED' AND reversal_reason IS NOT NULL AND length(trim(reversal_reason)) > 0)
        OR (status != 'REVERSED')
    )
);

CREATE TABLE credit_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    credit_note_number VARCHAR(100) NOT NULL,
    credit_note_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status credit_note_status_enum NOT NULL DEFAULT 'DRAFT',
    reason TEXT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'AED',
    subtotal_net NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    vat_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    remaining_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    customer_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    company_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    e_invoice_status einvoice_status_enum NOT NULL DEFAULT 'NOT_APPLICABLE',
    e_invoice_uuid VARCHAR(100),
    e_invoice_hash VARCHAR(255),
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (organization_id, credit_note_number),
    CONSTRAINT chk_cn_amounts_non_negative CHECK (
        subtotal_net >= 0.00 AND vat_total >= 0.00 AND grand_total >= 0.00 AND remaining_balance >= 0.00
    )
);

CREATE TABLE credit_note_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    credit_note_id UUID NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
    invoice_item_id UUID REFERENCES invoice_items(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    item_order INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL,
    quantity NUMERIC(12, 4) NOT NULL DEFAULT 1.0000,
    unit_price NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    unit VARCHAR(50) DEFAULT 'Unit',
    discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    subtotal_net NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    vat_rate_id UUID NOT NULL REFERENCES vat_rates(id) ON DELETE RESTRICT,
    vat_rate_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    vat_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_gross NUMERIC(15, 2) NOT NULL DEFAULT 0.00,

    CONSTRAINT chk_cni_quantity_positive CHECK (quantity > 0.0000),
    CONSTRAINT chk_cni_unit_price_non_negative CHECK (unit_price >= 0.0000),
    CONSTRAINT chk_cni_subtotal_net_non_negative CHECK (subtotal_net >= 0.00),
    CONSTRAINT chk_cni_vat_amount_non_negative CHECK (vat_amount >= 0.00),
    CONSTRAINT chk_cni_total_gross_match CHECK (total_gross = (subtotal_net + vat_amount))
);

CREATE TABLE credit_note_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    credit_note_id UUID NOT NULL REFERENCES credit_notes(id) ON DELETE RESTRICT,
    invoice_id UUID REFERENCES invoices(id) ON DELETE RESTRICT,
    amount NUMERIC(15, 2) NOT NULL,
    allocation_type allocation_type_enum NOT NULL DEFAULT 'INVOICE_OFFSET',
    allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    
    CONSTRAINT chk_cn_alloc_amount_positive CHECK (amount > 0.00)
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    performed_by UUID,
    performed_by_name VARCHAR(255) NOT NULL DEFAULT 'System User',
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 8. INDEXES
-- ============================================================================
CREATE INDEX idx_customers_org_relation ON customers(organization_id, relation_type, is_active);
CREATE INDEX idx_customers_org_trn ON customers(organization_id, trn);
CREATE INDEX idx_products_org_active ON products(organization_id, is_active);
CREATE INDEX idx_invoices_org_status ON invoices(organization_id, status);
CREATE INDEX idx_invoices_org_date ON invoices(organization_id, invoice_date DESC);
CREATE INDEX idx_invoices_org_due ON invoices(organization_id, due_date);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_quotes_org_status ON quotes(organization_id, status);
CREATE INDEX idx_quote_items_quote ON quote_items(quote_id);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_customer ON payments(customer_id);
CREATE INDEX idx_credit_notes_invoice ON credit_notes(invoice_id);
CREATE INDEX idx_credit_notes_customer ON credit_notes(customer_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);

-- ============================================================================
-- 9. FUNCTIONS & BUSINESS LOGIC TRIGGERS
-- ============================================================================

-- A. Concurrency-Safe Sequence Monotonic Number Generator
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
    INSERT INTO document_sequences (organization_id, doc_type, prefix, year, current_number, padding)
    VALUES (p_org_id, p_doc_type, p_prefix, p_year, 0, v_padding)
    ON CONFLICT (organization_id, doc_type, year) DO NOTHING;

    SELECT current_number + 1, padding
    INTO v_next_num, v_padding
    FROM document_sequences
    WHERE organization_id = p_org_id AND doc_type = p_doc_type AND year = p_year
    FOR UPDATE;

    UPDATE document_sequences
    SET current_number = v_next_num, updated_at = NOW()
    WHERE organization_id = p_org_id AND doc_type = p_doc_type AND year = p_year;

    v_result := p_prefix || '-' || p_year::TEXT || '-' || LPAD(v_next_num::TEXT, v_padding, '0');
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- B. Deletion Prevention on Financial Records
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

-- C. Immutability Guard on Issued Invoices
CREATE OR REPLACE FUNCTION lock_issued_invoice_modifications()
RETURNS TRIGGER AS $$
BEGIN
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

-- D. Line Item Math Engine
CREATE OR REPLACE FUNCTION calculate_line_item_math()
RETURNS TRIGGER AS $$
DECLARE
    v_gross_net NUMERIC(15, 4);
    v_discount NUMERIC(15, 2) := 0.00;
    v_subtotal NUMERIC(15, 2);
    v_vat NUMERIC(15, 2) := 0.00;
BEGIN
    v_gross_net := NEW.quantity * NEW.unit_price;

    IF NEW.discount_value IS NOT NULL AND NEW.discount_value > 0 THEN
        IF NEW.discount_type = 'PERCENTAGE' THEN
            v_discount := ROUND((v_gross_net * NEW.discount_value / 100.00), 2);
        ELSE
            v_discount := ROUND(NEW.discount_value, 2);
        END IF;
    END IF;

    IF v_discount > v_gross_net THEN
        v_discount := ROUND(v_gross_net, 2);
    END IF;

    v_subtotal := ROUND(v_gross_net, 2) - v_discount;

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

-- E. Payment Balance Synchronizer & Overpayment Guard
CREATE OR REPLACE FUNCTION sync_payment_balance_and_overpayment_guard()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice RECORD;
    v_total_recorded_paid NUMERIC(15, 2) := 0.00;
    v_new_balance NUMERIC(15, 2);
BEGIN
    SELECT * INTO v_invoice
    FROM invoices
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id)
    FOR UPDATE;

    IF v_invoice.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Operation Error: Cannot apply or modify payments on a CANCELLED invoice.';
    END IF;

    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.status = 'RECORDED' AND (TG_OP = 'INSERT' OR OLD.status != 'RECORDED') THEN
            IF NEW.amount > v_invoice.balance_due AND NEW.allow_overpayment IS NOT TRUE THEN
                RAISE EXCEPTION 'Overpayment Guard Violation: Payment amount (AED %) exceeds invoice balance due (AED %). Explicit authorization flag required.', 
                    NEW.amount, v_invoice.balance_due;
            END IF;
        END IF;
    END IF;

    SELECT COALESCE(SUM(amount), 0.00)
    INTO v_total_recorded_paid
    FROM payments
    WHERE invoice_id = v_invoice.id AND status = 'RECORDED';

    v_new_balance := ROUND(v_invoice.grand_total - v_total_recorded_paid, 2);
    IF v_new_balance < 0 THEN
        v_new_balance := 0.00;
    END IF;

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

-- F. Credit Note Allocation Synchronizer
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

-- G. Audit Trail Trigger
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

-- ============================================================================
-- 10. REPORTING VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW view_sales_summary AS
SELECT 
    i.organization_id,
    i.id AS invoice_id,
    i.invoice_number,
    i.invoice_date,
    i.supply_date,
    i.due_date,
    i.customer_id,
    COALESCE(c.company_name, c.contact_person) AS customer_name,
    c.trn AS customer_trn,
    i.currency,
    i.subtotal_net,
    i.discount_amount,
    i.vat_total,
    i.grand_total,
    i.amount_paid,
    i.balance_due,
    i.status
FROM invoices i
JOIN customers c ON i.customer_id = c.id
WHERE i.status != 'CANCELLED';

CREATE OR REPLACE VIEW view_customer_balances AS
SELECT 
    c.organization_id,
    c.id AS customer_id,
    c.company_name,
    c.contact_person,
    c.email,
    c.phone,
    c.trn,
    c.billing_emirate,
    c.payment_terms_days,
    COALESCE(inv.total_invoiced, 0.00) AS total_invoiced,
    COALESCE(pay.total_paid, 0.00) AS total_paid,
    COALESCE(cn.total_credited, 0.00) AS total_credited,
    ROUND(
        COALESCE(inv.total_invoiced, 0.00) - 
        (COALESCE(pay.total_paid, 0.00) + COALESCE(cn.total_credited, 0.00)), 
        2
    ) AS net_balance_due
FROM customers c
LEFT JOIN (
    SELECT customer_id, SUM(grand_total) AS total_invoiced
    FROM invoices
    WHERE status != 'CANCELLED'
    GROUP BY customer_id
) inv ON c.id = inv.customer_id
LEFT JOIN (
    SELECT customer_id, SUM(amount) AS total_paid
    FROM payments
    WHERE status = 'RECORDED'
    GROUP BY customer_id
) pay ON c.id = pay.customer_id
LEFT JOIN (
    SELECT customer_id, SUM(grand_total) AS total_credited
    FROM credit_notes
    WHERE status IN ('ISSUED', 'APPLIED', 'REFUNDED')
    GROUP BY customer_id
) cn ON c.id = cn.customer_id;

CREATE OR REPLACE VIEW view_receivables_aging AS
SELECT 
    i.organization_id,
    i.id AS invoice_id,
    i.invoice_number,
    i.invoice_date,
    i.due_date,
    i.customer_id,
    COALESCE(c.company_name, c.contact_person) AS customer_name,
    c.trn AS customer_trn,
    i.grand_total,
    i.amount_paid,
    i.balance_due,
    GREATEST(0, (CURRENT_DATE - i.due_date)) AS days_overdue,
    CASE WHEN (CURRENT_DATE - i.due_date) <= 30 THEN i.balance_due ELSE 0.00 END AS bucket_0_30_days,
    CASE WHEN (CURRENT_DATE - i.due_date) > 30 AND (CURRENT_DATE - i.due_date) <= 60 THEN i.balance_due ELSE 0.00 END AS bucket_31_60_days,
    CASE WHEN (CURRENT_DATE - i.due_date) > 60 AND (CURRENT_DATE - i.due_date) <= 90 THEN i.balance_due ELSE 0.00 END AS bucket_61_90_days,
    CASE WHEN (CURRENT_DATE - i.due_date) > 90 THEN i.balance_due ELSE 0.00 END AS bucket_90_plus_days
FROM invoices i
JOIN customers c ON i.customer_id = c.id
WHERE i.status != 'CANCELLED' AND i.balance_due > 0.00;

CREATE OR REPLACE VIEW view_uae_vat_201_return AS
WITH standard_sales AS (
    SELECT 
        i.organization_id,
        DATE_TRUNC('month', i.supply_date) AS tax_period,
        SUM(ii.subtotal_net) AS gross_standard_taxable,
        SUM(ii.vat_amount) AS gross_standard_vat
    FROM invoices i
    JOIN invoice_items ii ON i.id = ii.invoice_id
    WHERE i.status != 'CANCELLED' AND ii.vat_rate_percentage > 0
    GROUP BY i.organization_id, DATE_TRUNC('month', i.supply_date)
),
zero_sales AS (
    SELECT 
        i.organization_id,
        DATE_TRUNC('month', i.supply_date) AS tax_period,
        SUM(ii.subtotal_net) AS zero_rated_taxable
    FROM invoices i
    JOIN invoice_items ii ON i.id = ii.invoice_id
    WHERE i.status != 'CANCELLED' AND ii.vat_rate_percentage = 0
    GROUP BY i.organization_id, DATE_TRUNC('month', i.supply_date)
),
credit_adjustments AS (
    SELECT 
        cn.organization_id,
        DATE_TRUNC('month', cn.credit_note_date) AS tax_period,
        SUM(cni.subtotal_net) AS credit_subtotal_adjustment,
        SUM(cni.vat_amount) AS credit_vat_adjustment
    FROM credit_notes cn
    JOIN credit_note_items cni ON cn.id = cni.credit_note_id
    WHERE cn.status IN ('ISSUED', 'APPLIED', 'REFUNDED')
    GROUP BY cn.organization_id, DATE_TRUNC('month', cn.credit_note_date)
)
SELECT 
    COALESCE(s.organization_id, c.organization_id) AS organization_id,
    COALESCE(s.tax_period, c.tax_period) AS tax_period,
    COALESCE(s.gross_standard_taxable, 0.00) AS box_1a_standard_supplies,
    COALESCE(s.gross_standard_vat, 0.00) AS box_1a_output_vat,
    COALESCE(c.credit_subtotal_adjustment, 0.00) AS box_1a_adjustment_supplies,
    COALESCE(c.credit_vat_adjustment, 0.00) AS box_1a_adjustment_vat,
    COALESCE(z.zero_rated_taxable, 0.00) AS box_1c_zero_rated_supplies,
    ROUND(
        COALESCE(s.gross_standard_vat, 0.00) - COALESCE(c.credit_vat_adjustment, 0.00), 
        2
    ) AS net_vat_payable_aed
FROM standard_sales s
FULL OUTER JOIN credit_adjustments c 
    ON s.organization_id = c.organization_id AND s.tax_period = c.tax_period
LEFT JOIN zero_sales z 
    ON s.organization_id = z.organization_id AND s.tax_period = z.tax_period;
