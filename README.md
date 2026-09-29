# UAE Invoicing & Sales Management System

A professional, audit-compliant, desktop-first SaaS web application designed specifically for UAE commercial operations and Federal Tax Authority (FTA) 5% VAT compliance.

---

## 🌟 Key Features Implemented

### 1. Prospects & Clients Management
- **Entity Types:** Corporate / Companies and Individual Customers.
- **Account Classification:** Active Customers and Sales Prospects (Leads).
- **UAE Specific Attributes:**
  - 15-digit UAE Tax Registration Number (TRN) validation.
  - Emirate selector (Abu Dhabi, Dubai, Sharjah, Ajman, Umm Al Quwain, Ras Al Khaimah, Fujairah).
  - Billing and Service addresses with PO Box support.
  - Customer 360° profile drawer displaying transaction history and running ledger.

### 2. Products & Services Catalog
- Manage service codes / SKUs, billing units (Hour, Day, Month, Unit, Service, Pcs), cost and selling prices.
- Configurable UAE VAT categorization per item (Standard 5%, Zero-Rated 0%, Exempt, Out of Scope).
- Live margin / markup indicator.

### 3. Quotations & Lifecycle Management
- **Document States:** `DRAFT` ➔ `SENT` ➔ `ACCEPTED` ➔ `CONVERTED` (or `REJECTED`, `EXPIRED`).
- **Sequential Numbering:** `QUO-2026-0001` format.
- Line items with line-level discounts and VAT calculations.
- Document-level discount calculation.
- **1-Click Convert to Invoice:** Deep copies customer and line items into an official tax invoice, transitioning quote state to `CONVERTED`.

### 4. UAE Tax Invoices Engine
- **Document States:** `DRAFT` ➔ `ISSUED` ➔ `PARTIALLY_PAID` ➔ `PAID` (or `OVERDUE`, `CANCELLED`).
- **Accounting Immutability Principle:** Issued invoices are locked against deletion or destructive modifications.
- **JSONB Snapshots:** Freezes immutable copies of Supplier profile (legal name, TRN, address, bank info) and Customer profile at time of issuance.
- **Sequential Monotonicity:** `INV-2026-0001` allocated atomically.
- **Audit-Compliant Cancellation:** Voided invoices cannot be deleted; sequence numbers are never reused and remain visible with mandatory cancellation justification logs.

### 5. Payments & Overpayment Guard
- Supports multiple partial installment payments per invoice.
- **Overpayment Guard:** Detects payments exceeding balance due, raises a warning modal, and caps or rejects excessive amounts.
- **Payment Reversal Workflow:** Reverses bounced cheques or disputed wires, reopens invoice balance, and maintains unbroken audit logs.

### 6. Credit Notes Engine
- **States:** `DRAFT` ➔ `ISSUED` ➔ `APPLIED` ➔ `REFUNDED` ➔ `CANCELLED`.
- Issued directly from invoices with support for **Full Credit** or **Partial Credit** (custom quantity and unit price).
- Flexible allocation: Offset against invoice balance or direct cash/wire refund.

### 7. UAE VAT Calculation & Compliance Engine
- Built with `decimal.js` for half-up commercial rounding to 2 decimal places (fils).
- Line subtotal, line discounts, VAT calculation per item, document discounts, and aggregate output VAT.
- Ready for UAE VAT Return 201 filing.

### 8. Analytics Dashboard & Reports Suite
- **KPI Cards:** Monthly Revenue, Annual Revenue, Outstanding Receivables, Overdue Receivables, Output VAT Collected, Open Quotations Value.
- **Interactive Chart:** Monthly invoiced revenue vs cash collections (Recharts).
- **11 Dedicated Reports:**
  1. Sales Summary Register
  2. Invoice Register
  3. Payment Collection Register
  4. Outstanding Receivables Report
  5. Overdue Invoices Aging Report
  6. Customer Statement of Account
  7. UAE VAT 201 Return Summary
  8. Credit Notes Register
  9. Revenue by Customer
  10. Revenue by Product & Service
  11. Receivables Ageing Schedule (0-30, 31-60, 61-90, 90+ days)
- Direct **CSV / Excel Export** and **A4 Printable PDF layout**.

### 9. Professional PDF Document Generator
- Official bilingual **UAE Tax Invoice** (`TAX INVOICE / فاتورة ضريبية`).
- Professional Quotation proposal layout.
- Tax Credit Note layout.
- Customer Statement of Account with running balance.
- Incorporates 15-digit TRNs, Date of Supply, Bank Coordinates (IBAN, SWIFT), and E-Invoicing verification QR code placeholder.

### 10. Future UAE E-Invoicing (Peppol / DCT) Ready
- Decoupled `EInvoiceProvider` TypeScript interface with `submitInvoice()`, `submitCreditNote()`, `getStatus()`, and `cancelDocument()`.
- Pre-configured data attributes (`e_invoice_status`, `e_invoice_uuid`, `e_invoice_hash`, `e_invoice_qr_code`).

---

## 🚀 Running the Application

The development server is actively running on:
```bash
http://localhost:3000
```

To run migrations in your Supabase PostgreSQL database:
```bash
# Execute the SQL script located at:
supabase/migrations/01_initial_schema.sql
```
