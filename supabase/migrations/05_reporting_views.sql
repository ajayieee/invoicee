-- ============================================================================
-- 05_reporting_views.sql
-- Financial & UAE VAT Reporting SQL Views
-- ============================================================================

-- 1. SALES REGISTER VIEW (Excludes Cancelled Invoices)
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

-- 2. CUSTOMER BALANCES & RECEIVABLES VIEW
-- Calculates total invoiced, total payments received, total credit adjustments, and net outstanding
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
    
    -- Invoiced (Debits)
    COALESCE(inv.total_invoiced, 0.00) AS total_invoiced,
    
    -- Payments (Credits)
    COALESCE(pay.total_paid, 0.00) AS total_paid,
    
    -- Credit Notes (Credits)
    COALESCE(cn.total_credited, 0.00) AS total_credited,
    
    -- Net Outstanding Balance
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

-- 3. RECEIVABLES AGEING SCHEDULE VIEW (0-30, 31-60, 61-90, 90+ days)
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
    
    -- Days Overdue Calculation
    GREATEST(0, (CURRENT_DATE - i.due_date)) AS days_overdue,
    
    -- Ageing Buckets
    CASE 
        WHEN (CURRENT_DATE - i.due_date) <= 30 THEN i.balance_due 
        ELSE 0.00 
    END AS bucket_0_30_days,
    
    CASE 
        WHEN (CURRENT_DATE - i.due_date) > 30 AND (CURRENT_DATE - i.due_date) <= 60 THEN i.balance_due 
        ELSE 0.00 
    END AS bucket_31_60_days,
    
    CASE 
        WHEN (CURRENT_DATE - i.due_date) > 60 AND (CURRENT_DATE - i.due_date) <= 90 THEN i.balance_due 
        ELSE 0.00 
    END AS bucket_61_90_days,
    
    CASE 
        WHEN (CURRENT_DATE - i.due_date) > 90 THEN i.balance_due 
        ELSE 0.00 
    END AS bucket_90_plus_days

FROM invoices i
JOIN customers c ON i.customer_id = c.id
WHERE i.status != 'CANCELLED' AND i.balance_due > 0.00;

-- 4. UAE VAT RETURN 201 SUMMARY VIEW
-- Implements FTA Box 1a (Standard Rated 5% Supplies) and Box 1c (Zero-Rated Supplies)
CREATE OR REPLACE VIEW view_uae_vat_201_return AS
WITH standard_sales AS (
    -- Standard rated invoice line items
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
    -- Zero rated invoice line items
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
    -- Credit notes reducing output tax
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
    
    -- Box 1a: Standard Rated Supplies Amount
    COALESCE(s.gross_standard_taxable, 0.00) AS box_1a_standard_supplies,
    
    -- Box 1a: Output VAT Collected (5%)
    COALESCE(s.gross_standard_vat, 0.00) AS box_1a_output_vat,
    
    -- Box 1a Adjustment: Adjustments from Credit Notes
    COALESCE(c.credit_subtotal_adjustment, 0.00) AS box_1a_adjustment_supplies,
    COALESCE(c.credit_vat_adjustment, 0.00) AS box_1a_adjustment_vat,
    
    -- Box 1c: Zero Rated Supplies
    COALESCE(z.zero_rated_taxable, 0.00) AS box_1c_zero_rated_supplies,
    
    -- Net Tax Payable in AED to Federal Tax Authority
    ROUND(
        COALESCE(s.gross_standard_vat, 0.00) - COALESCE(c.credit_vat_adjustment, 0.00), 
        2
    ) AS net_vat_payable_aed

FROM standard_sales s
FULL OUTER JOIN credit_adjustments c 
    ON s.organization_id = c.organization_id AND s.tax_period = c.tax_period
LEFT JOIN zero_sales z 
    ON s.organization_id = z.organization_id AND s.tax_period = z.tax_period;

-- 5. CUSTOMER STATEMENT LEDGER TRANSACTIONS VIEW
CREATE OR REPLACE VIEW view_customer_statement_ledger AS
SELECT 
    i.organization_id,
    i.customer_id,
    i.invoice_date AS transaction_date,
    'TAX_INVOICE' AS document_type,
    i.invoice_number AS reference_number,
    'Tax Invoice Issued' AS description,
    i.grand_total AS debit_amount,  -- Debit increases customer receivable
    0.00 AS credit_amount
FROM invoices i
WHERE i.status != 'CANCELLED'

UNION ALL

SELECT 
    p.organization_id,
    p.customer_id,
    p.payment_date AS transaction_date,
    'PAYMENT' AS document_type,
    p.payment_number AS reference_number,
    CONCAT('Payment Received - ', p.reference_number) AS description,
    0.00 AS debit_amount,
    p.amount AS credit_amount     -- Credit reduces customer receivable
FROM payments p
WHERE p.status = 'RECORDED'

UNION ALL

SELECT 
    cn.organization_id,
    cn.customer_id,
    cn.credit_note_date AS transaction_date,
    'CREDIT_NOTE' AS document_type,
    cn.credit_note_number AS reference_number,
    CONCAT('Credit Note - ', cn.reason) AS description,
    0.00 AS debit_amount,
    cn.grand_total AS credit_amount -- Credit reduces customer receivable
FROM credit_notes cn
WHERE cn.status IN ('ISSUED', 'APPLIED', 'REFUNDED')

ORDER BY transaction_date ASC;
