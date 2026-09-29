-- ============================================================================
-- 03_financial_documents.sql
-- Quotes, Invoices, Payments, Credit Notes, Items & Audit Tables
-- ============================================================================

-- 1. DOCUMENT SEQUENCES (Monotonic Counter with Concurrency Protection)
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

-- 2. QUOTATIONS
CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    
    -- Identification & Dates
    quote_number VARCHAR(100) NOT NULL,
    quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE NOT NULL,
    status quote_status_enum NOT NULL DEFAULT 'DRAFT',
    
    -- Multi-Currency Support (Base AED)
    currency VARCHAR(3) NOT NULL DEFAULT 'AED',
    exchange_rate NUMERIC(12, 6) NOT NULL DEFAULT 1.000000,
    
    -- Financial Totals (Stored using exact NUMERIC precision)
    subtotal_net NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    discount_type discount_type_enum,
    discount_value NUMERIC(15, 2) DEFAULT 0.00,
    discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    vat_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    
    -- Operational Texts
    notes TEXT,
    terms TEXT,
    converted_invoice_id UUID, -- Backlink to invoice once converted
    
    -- Audit Tracking
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (organization_id, quote_number),
    CONSTRAINT chk_quote_expiry_after_date CHECK (expiry_date >= quote_date),
    CONSTRAINT chk_quote_non_negative_amounts CHECK (
        subtotal_net >= 0.00 AND 
        discount_amount >= 0.00 AND 
        vat_total >= 0.00 AND 
        grand_total >= 0.00
    ),
    CONSTRAINT chk_quote_discount_le_subtotal CHECK (discount_amount <= subtotal_net)
);

-- Quotation Line Items
CREATE TABLE quote_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    item_order INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL,
    
    -- Pricing & Quantity
    quantity NUMERIC(12, 4) NOT NULL DEFAULT 1.0000,
    unit_price NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    unit VARCHAR(50) DEFAULT 'Unit',
    
    -- Line Discount
    discount_type discount_type_enum,
    discount_value NUMERIC(15, 2) DEFAULT 0.00,
    discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    subtotal_net NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    
    -- Line VAT Assignment
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

-- 3. TAX INVOICES (Legal Financial Instruments)
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    originating_quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
    
    -- Legal Identifier & Dates
    invoice_number VARCHAR(100) NOT NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supply_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    status invoice_status_enum NOT NULL DEFAULT 'DRAFT',
    
    -- Multi-Currency Support (Base AED)
    currency VARCHAR(3) NOT NULL DEFAULT 'AED',
    exchange_rate NUMERIC(12, 6) NOT NULL DEFAULT 1.000000,
    
    -- Financial Totals (Strict NUMERIC precision)
    subtotal_net NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    discount_type discount_type_enum,
    discount_value NUMERIC(15, 2) DEFAULT 0.00,
    discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    vat_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    balance_due NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    
    -- Immutable Historical Snapshots (Audit Freeze)
    customer_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    company_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    bank_details_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Compliance & Operational Notes
    notes TEXT,
    terms TEXT,
    
    -- Formal Cancellation Audit (Never deleted, sequence burned)
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    cancelled_by UUID,
    
    -- Future UAE E-Invoicing (Peppol / DCT)
    e_invoice_status einvoice_status_enum NOT NULL DEFAULT 'NOT_APPLICABLE',
    e_invoice_uuid VARCHAR(100),
    e_invoice_hash VARCHAR(255),
    e_invoice_qr_code TEXT,
    e_invoice_submitted_at TIMESTAMPTZ,
    
    -- Audit Tracking
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (organization_id, invoice_number),
    CONSTRAINT chk_inv_due_date_after_date CHECK (due_date >= invoice_date),
    CONSTRAINT chk_inv_non_negative_amounts CHECK (
        subtotal_net >= 0.00 AND 
        discount_amount >= 0.00 AND 
        vat_total >= 0.00 AND 
        grand_total >= 0.00 AND 
        amount_paid >= 0.00 AND 
        balance_due >= 0.00
    ),
    CONSTRAINT chk_inv_discount_le_subtotal CHECK (discount_amount <= subtotal_net),
    -- Strict mathematical balance equation
    CONSTRAINT chk_inv_balance_math CHECK (balance_due = (grand_total - amount_paid)),
    CONSTRAINT chk_inv_cancellation_reason_if_cancelled CHECK (
        (status = 'CANCELLED' AND cancellation_reason IS NOT NULL AND length(trim(cancellation_reason)) > 0)
        OR (status != 'CANCELLED')
    )
);

-- Back-link quote converted_invoice_id to invoices
ALTER TABLE quotes 
    ADD CONSTRAINT fk_quotes_converted_invoice 
    FOREIGN KEY (converted_invoice_id) 
    REFERENCES invoices(id) ON DELETE SET NULL;

-- Invoice Line Items
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    item_order INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL,
    
    -- Pricing & Quantity
    quantity NUMERIC(12, 4) NOT NULL DEFAULT 1.0000,
    unit_price NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    unit VARCHAR(50) DEFAULT 'Unit',
    
    -- Line Discount
    discount_type discount_type_enum,
    discount_value NUMERIC(15, 2) DEFAULT 0.00,
    discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    subtotal_net NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    
    -- Line VAT Assignment
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

-- 4. PAYMENTS LEDGER
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
    reference_number VARCHAR(100), -- Wire Ref, Cheque No
    notes TEXT,
    status payment_status_enum NOT NULL DEFAULT 'RECORDED',
    
    -- Reversal Audit
    reversed_at TIMESTAMPTZ,
    reversal_reason TEXT,
    reversed_by UUID,
    
    -- Explicit Overpayment Authorization Flag
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

-- 5. CREDIT NOTES
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
    
    -- Totals
    subtotal_net NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    vat_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    remaining_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    
    -- Snapshots
    customer_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    company_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    
    -- UAE E-Invoicing
    e_invoice_status einvoice_status_enum NOT NULL DEFAULT 'NOT_APPLICABLE',
    e_invoice_uuid VARCHAR(100),
    e_invoice_hash VARCHAR(255),
    
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (organization_id, credit_note_number),
    CONSTRAINT chk_cn_amounts_non_negative CHECK (
        subtotal_net >= 0.00 AND 
        vat_total >= 0.00 AND 
        grand_total >= 0.00 AND 
        remaining_balance >= 0.00
    )
);

-- Credit Note Line Items
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

-- Credit Note Allocations
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

-- 6. AUDIT TRAIL LOGS
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- INVOICE, PAYMENT, CREDIT_NOTE, QUOTE, CUSTOMER, PRODUCT
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,      -- CREATED, ISSUED, UPDATED, STATUS_CHANGE, CANCELLED, REVERSED
    old_values JSONB,
    new_values JSONB,
    performed_by UUID,
    performed_by_name VARCHAR(255) NOT NULL DEFAULT 'System User',
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
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
