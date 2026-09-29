-- ============================================================================
-- 02_core_master_tables.sql
-- Master Organizations, Settings, Tax Configuration, Customers, Products
-- ============================================================================

-- 1. ORGANIZATIONS (Multi-Tenant SaaS Boundary)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organization Members (Access Control)
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- references Supabase auth.users(id)
    role VARCHAR(50) NOT NULL DEFAULT 'OWNER', -- OWNER, ADMIN, ACCOUNTANT, SALES, VIEWER
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, user_id)
);

-- 2. COMPANY SETTINGS (UAE Business & Tax Profile)
CREATE TABLE company_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Commercial Identification
    legal_company_name VARCHAR(255) NOT NULL,
    trading_name VARCHAR(255),
    trn VARCHAR(15), -- 15-digit UAE TRN
    tax_registration_date DATE,
    
    -- Physical Jurisdiction
    address_line_1 TEXT NOT NULL,
    address_line_2 TEXT,
    city VARCHAR(100) NOT NULL,
    emirate uae_emirate_enum NOT NULL DEFAULT 'DUBAI',
    country VARCHAR(100) NOT NULL DEFAULT 'United Arab Emirates',
    po_box VARCHAR(50),
    
    -- Corporate Communications
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    mobile VARCHAR(50),
    website VARCHAR(255),
    logo_url TEXT,
    
    -- Financial & Document Defaults
    default_currency VARCHAR(3) NOT NULL DEFAULT 'AED',
    default_vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
    invoice_prefix VARCHAR(10) NOT NULL DEFAULT 'INV',
    quote_prefix VARCHAR(10) NOT NULL DEFAULT 'QUO',
    credit_note_prefix VARCHAR(10) NOT NULL DEFAULT 'CN',
    payment_prefix VARCHAR(10) NOT NULL DEFAULT 'PAY',
    default_payment_terms_days INTEGER NOT NULL DEFAULT 30,
    
    -- Bank Wire Settlement Coordinates
    bank_name VARCHAR(150),
    bank_account_name VARCHAR(255),
    bank_account_number VARCHAR(50),
    bank_iban VARCHAR(50),
    bank_swift_bic VARCHAR(20),
    bank_branch VARCHAR(100),
    
    -- Legal Notices & Declarations
    invoice_footer_notes TEXT,
    terms_and_conditions TEXT,
    
    -- Audit Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT chk_company_trn CHECK (trn IS NULL OR trn ~ '^[0-9]{15}$'),
    CONSTRAINT chk_default_currency_len CHECK (char_length(default_currency) = 3),
    CONSTRAINT chk_default_vat_rate_range CHECK (default_vat_rate >= 0.00 AND default_vat_rate <= 100.00),
    CONSTRAINT chk_payment_terms_positive CHECK (default_payment_terms_days >= 0)
);

-- 3. VAT RATES CONFIGURATION LAYER
CREATE TABLE vat_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL, -- e.g. STANDARD_5, ZERO_0, EXEMPT, OUT_OF_SCOPE
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

-- 4. PAYMENT METHODS
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL, -- e.g. BANK_TRANSFER, CHEQUE, CREDIT_CARD, CASH
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (organization_id, code)
);

-- 5. CUSTOMERS & PROSPECTS
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
    trn VARCHAR(15), -- 15-digit UAE TRN
    
    -- Billing Address
    billing_address_line_1 TEXT,
    billing_address_line_2 TEXT,
    billing_city VARCHAR(100),
    billing_emirate uae_emirate_enum DEFAULT 'DUBAI',
    billing_country VARCHAR(100) DEFAULT 'United Arab Emirates',
    billing_po_box VARCHAR(50),
    
    -- Shipping / Service Location
    shipping_address_line_1 TEXT,
    shipping_address_line_2 TEXT,
    shipping_city VARCHAR(100),
    shipping_emirate uae_emirate_enum,
    shipping_country VARCHAR(100) DEFAULT 'United Arab Emirates',
    
    -- Terms & Financial Classification
    payment_terms_days INTEGER NOT NULL DEFAULT 30,
    currency VARCHAR(3) NOT NULL DEFAULT 'AED',
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Audit tracking
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT chk_customer_trn CHECK (trn IS NULL OR trn ~ '^[0-9]{15}$'),
    CONSTRAINT chk_customer_terms_positive CHECK (payment_terms_days >= 0),
    CONSTRAINT chk_customer_currency_len CHECK (char_length(currency) = 3),
    CONSTRAINT chk_customer_company_name_if_corp CHECK (
        (customer_type = 'COMPANY' AND company_name IS NOT NULL AND length(trim(company_name)) > 0)
        OR (customer_type = 'INDIVIDUAL')
    )
);

-- Additional Contacts per Customer
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

-- 6. PRODUCT CATEGORIES & PRODUCTS/SERVICES
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
    unit VARCHAR(50) NOT NULL DEFAULT 'Unit', -- Hour, Day, Unit, Pcs, Month, Service
    
    -- Monetary & Precision Amounts
    cost_price NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    selling_price NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    
    -- VAT Assignment (Restricted delete: cannot delete a tax rate in active use)
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

-- Core Master Indexes
CREATE INDEX idx_customers_org_relation ON customers(organization_id, relation_type, is_active);
CREATE INDEX idx_customers_org_trn ON customers(organization_id, trn);
CREATE INDEX idx_products_org_active ON products(organization_id, is_active);
CREATE INDEX idx_products_sku ON products(organization_id, sku);
CREATE INDEX idx_vat_rates_org_default ON vat_rates(organization_id, is_default);
