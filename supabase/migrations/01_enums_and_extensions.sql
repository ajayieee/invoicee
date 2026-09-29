-- ============================================================================
-- 01_enums_and_extensions.sql
-- PostgreSQL Extensions and Enumerated Types for UAE Invoicing System
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMERATED TYPES

-- Customer & Entity Classifications
CREATE TYPE customer_type_enum AS ENUM (
    'COMPANY', 
    'INDIVIDUAL'
);

CREATE TYPE customer_relation_enum AS ENUM (
    'PROSPECT', 
    'CUSTOMER'
);

-- UAE Emirates
CREATE TYPE uae_emirate_enum AS ENUM (
    'ABU_DHABI', 
    'DUBAI', 
    'SHARJAH', 
    'AJMAN', 
    'UMM_AL_QUWAIN', 
    'RAS_AL_KHAIMAH', 
    'FUJAIRAH'
);

-- UAE VAT Treatments (Executive Regulations of Federal Decree-Law No. 8)
CREATE TYPE vat_treatment_enum AS ENUM (
    'STANDARD_RATED',   -- Standard 5% UAE VAT
    'ZERO_RATED',       -- 0% Tax (Exports outside GCC, international transport, qualifying education/health)
    'EXEMPT',           -- Tax exempt (Financial services, residential bare land/leases)
    'OUT_OF_SCOPE'      -- Outside UAE territorial scope
);

-- Quotation Lifecycle States
CREATE TYPE quote_status_enum AS ENUM (
    'DRAFT',            -- Internal draft, not dispatched
    'SENT',             -- Dispatched to prospective customer
    'ACCEPTED',         -- Customer accepted proposal
    'REJECTED',         -- Customer declined
    'EXPIRED',          -- Past validity date without acceptance
    'CONVERTED'         -- Converted into official Tax Invoice
);

-- Tax Invoice Lifecycle States (Strict Accounting Lifecycle)
CREATE TYPE invoice_status_enum AS ENUM (
    'DRAFT',            -- Pre-issuance work in progress, no legal number assigned
    'ISSUED',           -- Official legal document, immutable financial snapshot
    'PARTIALLY_PAID',   -- One or more payments recorded, balance remains > 0
    'PAID',             -- Full balance settled (balance_due = 0.00)
    'OVERDUE',          -- Payment due date exceeded with unpaid balance
    'CANCELLED'         -- Formally voided; audit preserved, number never reused
);

-- Payment Ledger Status
CREATE TYPE payment_status_enum AS ENUM (
    'RECORDED',         -- Payment received and allocated
    'REVERSED'          -- Dishonored cheque, chargeback, or wire return
);

-- Credit Note Lifecycle States
CREATE TYPE credit_note_status_enum AS ENUM (
    'DRAFT',            -- Editable adjustment draft
    'ISSUED',           -- Official tax credit note issued
    'APPLIED',          -- Offset against invoice outstanding balance
    'REFUNDED',         -- Paid out directly to customer via cash/wire
    'CANCELLED'         -- Voided
);

-- Discount Calculation Types
CREATE TYPE discount_type_enum AS ENUM (
    'PERCENTAGE',       -- Calculated as % of subtotal
    'FIXED_AMOUNT'      -- Direct monetary deduction in AED
);

-- Future UAE E-Invoicing (Peppol / DCT) Submission Status
CREATE TYPE einvoice_status_enum AS ENUM (
    'NOT_APPLICABLE',   -- Pre-mandate or domestic non-e-invoice
    'PENDING',          -- Queued for transmission to Accredited Service Provider
    'SUBMITTED',        -- Sent to FTA / Peppol access point
    'ACCEPTED',         -- Cryptographically signed and accepted
    'REJECTED',         -- Validation error returned by ASP
    'CANCELLED'         -- Cancellation document acknowledged by ASP
);

-- Document Sequence Types
CREATE TYPE doc_type_enum AS ENUM (
    'QUOTE', 
    'INVOICE', 
    'CREDIT_NOTE', 
    'PAYMENT'
);

-- Credit Note Allocation Methods
CREATE TYPE allocation_type_enum AS ENUM (
    'INVOICE_OFFSET',   -- Reduces customer's invoice balance due
    'CASH_REFUND'       -- Direct cash or bank wire disbursement to client
);
