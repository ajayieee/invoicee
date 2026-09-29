-- ============================================================================
-- UAE INVOICING & SALES MANAGEMENT POSTGRESQL SCHEMA (SUPABASE READY)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS
CREATE TYPE customer_type_enum AS ENUM ('COMPANY', 'INDIVIDUAL');
CREATE TYPE customer_relation_enum AS ENUM ('PROSPECT', 'CUSTOMER');
CREATE TYPE uae_emirate_enum AS ENUM (
    'ABU_DHABI', 'DUBAI', 'SHARJAH', 'AJMAN', 
    'UMM_AL_QUWAIN', 'RAS_AL_KHAIMAH', 'FUJAIRAH'
);

CREATE TYPE vat_treatment_enum AS ENUM (
    'STANDARD_RATED',   -- 5%
    'ZERO_RATED',       -- 0%
    'EXEMPT',           -- Exempt
    'OUT_OF_SCOPE'      -- Out of UAE VAT scope
);

CREATE TYPE quote_status_enum AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED');
CREATE TYPE invoice_status_enum AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');
CREATE TYPE payment_status_enum AS ENUM ('RECORDED', 'REVERSED');
CREATE TYPE credit_note_status_enum AS ENUM ('DRAFT', 'ISSUED', 'APPLIED', 'REFUNDED', 'CANCELLED');
CREATE TYPE discount_type_enum AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');
CREATE TYPE einvoice_status_enum AS ENUM ('NOT_APPLICABLE', 'PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'CANCELLED');
CREATE TYPE doc_type_enum AS ENUM ('QUOTE', 'INVOICE', 'CREDIT_NOTE', 'PAYMENT');

-- 2. ORGANIZATIONS & TENANCY
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
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

-- 3. COMPANY SETTINGS
CREATE TABLE company_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    legal_company_name VARCHAR(255) NOT NULL,
    trading_name VARCHAR(255),
    trn VARCHAR(15), -- 15-digit UAE TRN
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. VAT RATES & PAYMENT METHODS
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
    UNIQUE (organization_id, code)
);

CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, code)
);

-- 5. DOCUMENT SEQUENCER
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
    UNIQUE (organization_id, doc_type, year)
);

CREATE OR REPLACE FUNCTION get_next_document_number(
    p_org_id UUID,
    p_doc_type doc_type_enum,
    p_year INTEGER,
    p_prefix VARCHAR
) RETURNS VARCHAR AS $$
DECLARE
    v_next_num INTEGER;
    v_padding INTEGER := 4;
BEGIN
    INSERT INTO document_sequences (organization_id, doc_type, prefix, year, current_number, padding)
    VALUES (p_org_id, p_doc_type, p_prefix, p_year, 0, v_padding)
    ON CONFLICT (organization_id, doc_type, year) DO NOTHING;

    SELECT current_number + 1, padding INTO v_next_num, v_padding
    FROM document_sequences
    WHERE organization_id = p_org_id AND doc_type = p_doc_type AND year = p_year
    FOR UPDATE;

    UPDATE document_sequences
    SET current_number = v_next_num, updated_at = NOW()
    WHERE organization_id = p_org_id AND doc_type = p_doc_type AND year = p_year;

    RETURN p_prefix || '-' || p_year::TEXT || '-' || LPAD(v_next_num::TEXT, v_padding, '0');
END;
$$ LANGUAGE plpgsql;

-- 6. CUSTOMERS & CONTACTS
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
    billing_emirate uae_emirate_enum,
    billing_country VARCHAR(100) DEFAULT 'United Arab Emirates',
    billing_po_box VARCHAR(50),
    shipping_address_line_1 TEXT,
    shipping_address_line_2 TEXT,
    shipping_city VARCHAR(100),
    shipping_emirate uae_emirate_enum,
    shipping_country VARCHAR(100) DEFAULT 'United Arab Emirates',
    payment_terms_days INTEGER DEFAULT 30,
    currency VARCHAR(3) NOT NULL DEFAULT 'AED',
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE customer_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    designation VARCHAR(100),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. PRODUCTS & CATEGORIES
CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, sku)
);

-- 8. QUOTATIONS
CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    quote_number VARCHAR(100) NOT NULL,
    quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE NOT NULL,
    status quote_status_enum NOT NULL DEFAULT 'DRAFT',
    currency VARCHAR(3) NOT NULL DEFAULT 'AED',
    exchange_rate NUMERIC(10, 6) NOT NULL DEFAULT 1.000000,
    subtotal_net NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    discount_type discount_type_enum,
    discount_value NUMERIC(15, 2) DEFAULT 0.00,
    discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    vat_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    terms TEXT,
    converted_invoice_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, quote_number)
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
    total_gross NUMERIC(15, 2) NOT NULL DEFAULT 0.00
);

-- 9. INVOICES
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
    exchange_rate NUMERIC(10, 6) NOT NULL DEFAULT 1.000000,
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
    e_invoice_status einvoice_status_enum NOT NULL DEFAULT 'NOT_APPLICABLE',
    e_invoice_uuid VARCHAR(100),
    e_invoice_hash VARCHAR(255),
    e_invoice_qr_code TEXT,
    e_invoice_submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, invoice_number)
);

CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
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
    total_gross NUMERIC(15, 2) NOT NULL DEFAULT 0.00
);

-- 10. PAYMENTS
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
    exchange_rate NUMERIC(10, 6) NOT NULL DEFAULT 1.000000,
    reference_number VARCHAR(100),
    notes TEXT,
    status payment_status_enum NOT NULL DEFAULT 'RECORDED',
    reversed_at TIMESTAMPTZ,
    reversal_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, payment_number),
    CONSTRAINT positive_payment_amount CHECK (amount > 0)
);

-- 11. CREDIT NOTES
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, credit_note_number)
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
    total_gross NUMERIC(15, 2) NOT NULL DEFAULT 0.00
);

-- 12. AUDIT TRAIL
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    performed_by_name VARCHAR(255) NOT NULL DEFAULT 'System User',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
