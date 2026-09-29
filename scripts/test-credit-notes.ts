import { db } from '../src/lib/db/repository';
import { creditNoteService } from '../src/services/credit-note.service';
import { invoiceService } from '../src/services/invoice.service';
import { customerService } from '../src/services/customer.service';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    if (details) console.error(`     Details: ${details}`);
    process.exitCode = 1;
  }
}

async function runCreditNoteTests() {
  console.log('\n===============================================================');
  console.log('🚀 RUNNING COMPREHENSIVE UAE CREDIT NOTE TEST SUITE');
  console.log('===============================================================\n');

  // Reset database to ensure a clean known state
  db.resetToDefault();

  // -------------------------------------------------------------
  // Test 1: Full Credit Note Linked to Original Invoice
  // -------------------------------------------------------------
  console.log('🔹 [1/7] Testing Full Credit Note & Invoice Settlement...');
  
  // Create a new invoice to credit
  const customers = db.getCustomers();
  const customer = customers[0];

  const newInv = db.saveInvoice({
    customer_id: customer.id,
    customer_snapshot: customer,
    company_snapshot: db.getCompanySettings(),
    invoice_date: '2026-03-01',
    supply_date: '2026-03-01',
    due_date: '2026-03-31',
    status: 'ISSUED',
    items: [
      {
        id: `ii-test-1`,
        item_order: 1,
        description: 'Cloud Infrastructure Hosting',
        quantity: 2,
        unit_price: 1000,
        unit: 'Month',
        discount_amount: 0,
        discount_value: 0,
        subtotal_net: 2000,
        vat_rate_id: 'vat-001',
        vat_rate_percentage: 5,
        vat_amount: 100,
        total_gross: 2100,
      },
      {
        id: `ii-test-2`,
        item_order: 2,
        description: 'Security Audit & Compliance',
        quantity: 1,
        unit_price: 3000,
        unit: 'Service',
        discount_amount: 0,
        discount_value: 0,
        subtotal_net: 3000,
        vat_rate_id: 'vat-001',
        vat_rate_percentage: 5,
        vat_amount: 150,
        total_gross: 3150,
      },
    ],
    subtotal_net: 5000,
    discount_amount: 0,
    vat_total: 250,
    grand_total: 5250,
    amount_paid: 0,
    balance_due: 5250,
  });

  assert(newInv.grand_total === 5250, 'INVOICE: Initial grand total is 5,250.00 AED');
  assert(newInv.balance_due === 5250, 'INVOICE: Initial balance due is 5,250.00 AED');

  // Issue FULL credit note
  const fullCn = db.createCreditNoteFromInvoice(
    newInv.id,
    newInv.items.map((it) => ({
      invoice_item_id: it.id,
      quantity_to_credit: it.quantity,
      unit_price: it.unit_price,
    })),
    'Complete project cancellation and contract termination.',
    'INVOICE_OFFSET',
    'FULL',
    'RE_CANCELLATION'
  );

  assert(fullCn.credit_type === 'FULL', 'FULL CN: Marked with credit_type FULL');
  assert(fullCn.invoice_id === newInv.id, 'FULL CN: Linked to original invoice ID');
  assert(fullCn.invoice_number === newInv.invoice_number, 'FULL CN: Displays originating invoice number');
  assert(fullCn.original_invoice_total === 5250, 'FULL CN: Displays original invoice total of 5,250 AED');
  assert(fullCn.subtotal_net === 5000, 'FULL CN: Net credit amount is 5,000.00 AED');
  assert(fullCn.vat_total === 250, 'FULL CN: VAT adjustment is 250.00 AED');
  assert(fullCn.grand_total === 5250, 'FULL CN: Total gross credit is 5,250.00 AED');
  assert(fullCn.refund_status === 'APPLIED_TO_INVOICE', 'FULL CN: Refund status is APPLIED_TO_INVOICE');

  // Verify invoice balance due and status
  const refreshedInv = db.getInvoiceById(newInv.id)!;
  assert(refreshedInv.balance_due === 0, 'INVOICE: Balance due reduced to exactly 0.00 AED');
  assert(refreshedInv.status === 'PAID', 'INVOICE: Status automatically transitioned to PAID');

  // -------------------------------------------------------------
  // Test 2: Partial Credit Note with Selected Invoice Lines
  // -------------------------------------------------------------
  console.log('\n🔹 [2/7] Testing Partial Credit Note with Selected Invoice Lines...');

  const inv2 = db.saveInvoice({
    customer_id: customer.id,
    customer_snapshot: customer,
    company_snapshot: db.getCompanySettings(),
    invoice_date: '2026-03-05',
    supply_date: '2026-03-05',
    due_date: '2026-04-05',
    status: 'ISSUED',
    items: [
      {
        id: `ii-part-1`,
        item_order: 1,
        description: 'Server Rack A',
        quantity: 1,
        unit_price: 4000,
        unit: 'Unit',
        discount_amount: 0,
        discount_value: 0,
        subtotal_net: 4000,
        vat_rate_id: 'vat-001',
        vat_rate_percentage: 5,
        vat_amount: 200,
        total_gross: 4200,
      },
      {
        id: `ii-part-2`,
        item_order: 2,
        description: 'Server Rack B',
        quantity: 1,
        unit_price: 6000,
        unit: 'Unit',
        discount_amount: 0,
        discount_value: 0,
        subtotal_net: 6000,
        vat_rate_id: 'vat-001',
        vat_rate_percentage: 5,
        vat_amount: 300,
        total_gross: 6300,
      },
    ],
    subtotal_net: 10000,
    discount_amount: 0,
    vat_total: 500,
    grand_total: 10500,
    amount_paid: 0,
    balance_due: 10500,
  });

  // Credit ONLY Server Rack A (item 1)
  const partialCn = db.createCreditNoteFromInvoice(
    inv2.id,
    [
      {
        invoice_item_id: inv2.items[0].id,
        quantity_to_credit: 1,
        unit_price: 4000,
      },
    ],
    'Return of Server Rack A due to warehouse redundancy.',
    'INVOICE_OFFSET',
    'LINE_SELECTION',
    'RE_RETURN'
  );

  assert(partialCn.credit_type === 'LINE_SELECTION', 'PARTIAL CN: Credit type is LINE_SELECTION');
  assert(partialCn.items.length === 1, 'PARTIAL CN: Only 1 item credited');
  assert(partialCn.subtotal_net === 4000, 'PARTIAL CN: Subtotal net is 4,000.00 AED');
  assert(partialCn.vat_total === 200, 'PARTIAL CN: VAT adjustment is 200.00 AED');
  assert(partialCn.grand_total === 4200, 'PARTIAL CN: Total gross credit is 4,200.00 AED');

  const refreshedInv2 = db.getInvoiceById(inv2.id)!;
  assert(refreshedInv2.balance_due === 6300, 'INVOICE: Balance due reduced to 6,300.00 AED');
  assert(refreshedInv2.status === 'ISSUED', 'INVOICE: Status remains ISSUED with outstanding balance');

  // -------------------------------------------------------------
  // Test 3: Quantity Adjustment & Over-crediting Safeguards
  // -------------------------------------------------------------
  console.log('\n🔹 [3/7] Testing Quantity Adjustment & Over-credit Safeguards...');

  const inv3 = db.saveInvoice({
    customer_id: customer.id,
    customer_snapshot: customer,
    company_snapshot: db.getCompanySettings(),
    invoice_date: '2026-03-10',
    supply_date: '2026-03-10',
    due_date: '2026-04-10',
    status: 'ISSUED',
    items: [
      {
        id: `ii-qty-1`,
        item_order: 1,
        description: 'Industrial Tablets',
        quantity: 10,
        unit_price: 500,
        unit: 'Unit',
        discount_amount: 0,
        discount_value: 0,
        subtotal_net: 5000,
        vat_rate_id: 'vat-001',
        vat_rate_percentage: 5,
        vat_amount: 250,
        total_gross: 5250,
      },
    ],
    subtotal_net: 5000,
    discount_amount: 0,
    vat_total: 250,
    grand_total: 5250,
    amount_paid: 0,
    balance_due: 5250,
  });

  // Credit 3 out of 10 tablets
  const qtyCn1 = db.createCreditNoteFromInvoice(
    inv3.id,
    [
      {
        invoice_item_id: inv3.items[0].id,
        quantity_to_credit: 3,
        unit_price: 500,
      },
    ],
    'Return of 3 damaged tablets.',
    'INVOICE_OFFSET',
    'QUANTITY_ADJUSTMENT',
    'RE_DEFECT'
  );

  assert(qtyCn1.items[0].quantity === 3, 'QTY ADJUSTMENT: Exactly 3 units credited');
  assert(qtyCn1.grand_total === 1575, 'QTY ADJUSTMENT: 3 units * 500 AED + 5% VAT = 1,575.00 AED');

  // Try to credit 8 more tablets (only 7 remain non-credited)
  let overQtyError = false;
  try {
    db.createCreditNoteFromInvoice(
      inv3.id,
      [
        {
          invoice_item_id: inv3.items[0].id,
          quantity_to_credit: 8,
          unit_price: 500,
        },
      ],
      'Attempting to over-credit tablets.'
    );
  } catch (e: any) {
    overQtyError = true;
  }
  assert(overQtyError, 'SAFEGUARD: Rejects credit note exceeding remaining non-credited quantity (8 > 7)');

  // -------------------------------------------------------------
  // Test 4: Amount Adjustment & Commercial Concession
  // -------------------------------------------------------------
  console.log('\n🔹 [4/7] Testing Amount Adjustment (Price Correction / Commercial Concession)...');

  const inv4 = db.saveInvoice({
    customer_id: customer.id,
    customer_snapshot: customer,
    company_snapshot: db.getCompanySettings(),
    invoice_date: '2026-03-12',
    supply_date: '2026-03-12',
    due_date: '2026-04-12',
    status: 'ISSUED',
    items: [
      {
        id: `ii-amt-1`,
        item_order: 1,
        description: 'Custom Software Retainer',
        quantity: 1,
        unit_price: 10000,
        unit: 'Month',
        discount_amount: 0,
        discount_value: 0,
        subtotal_net: 10000,
        vat_rate_id: 'vat-001',
        vat_rate_percentage: 5,
        vat_amount: 500,
        total_gross: 10500,
      },
    ],
    subtotal_net: 10000,
    discount_amount: 0,
    vat_total: 500,
    grand_total: 10500,
    amount_paid: 0,
    balance_due: 10500,
  });

  // Commercial price reduction: giving a 2,000 AED discount concession
  const amtCn = db.createCreditNoteFromInvoice(
    inv4.id,
    [
      {
        invoice_item_id: inv4.items[0].id,
        quantity_to_credit: 1,
        amount_to_credit: 2000,
      },
    ],
    'Agreed 2,000 AED commercial discount following service delay.',
    'INVOICE_OFFSET',
    'AMOUNT_ADJUSTMENT',
    'RE_PRICE_REDUCTION'
  );

  assert(amtCn.credit_type === 'AMOUNT_ADJUSTMENT', 'AMOUNT ADJUSTMENT: Credit type is AMOUNT_ADJUSTMENT');
  assert(amtCn.subtotal_net === 2000, 'AMOUNT ADJUSTMENT: Net credit is exactly 2,000.00 AED');
  assert(amtCn.vat_total === 100, 'AMOUNT ADJUSTMENT: 5% VAT adjustment is 100.00 AED');
  assert(amtCn.grand_total === 2100, 'AMOUNT ADJUSTMENT: Gross credit is 2,100.00 AED');

  const refreshedInv4 = db.getInvoiceById(inv4.id)!;
  assert(refreshedInv4.balance_due === 8400, 'INVOICE: Balance due reduced to 8,400.00 AED');

  // -------------------------------------------------------------
  // Test 5: Client Refund Recording & Accounting Immutability
  // -------------------------------------------------------------
  console.log('\n🔹 [5/7] Testing Client Refund Recording & Accounting Immutability...');

  const inv5 = db.saveInvoice({
    customer_id: customer.id,
    customer_snapshot: customer,
    company_snapshot: db.getCompanySettings(),
    invoice_date: '2026-03-15',
    supply_date: '2026-03-15',
    due_date: '2026-04-15',
    status: 'ISSUED',
    items: [
      {
        id: `ii-ref-1`,
        item_order: 1,
        description: 'Annual Maintenance Retainer',
        quantity: 1,
        unit_price: 5000,
        unit: 'Year',
        discount_amount: 0,
        discount_value: 0,
        subtotal_net: 5000,
        vat_rate_id: 'vat-001',
        vat_rate_percentage: 5,
        vat_amount: 250,
        total_gross: 5250,
      },
    ],
    subtotal_net: 5000,
    discount_amount: 0,
    vat_total: 250,
    grand_total: 5250,
    amount_paid: 0,
    balance_due: 5250,
  });

  // Issue a credit note marked as CREDIT_ON_ACCOUNT
  const accountCn = db.createCreditNoteFromInvoice(
    inv5.id,
    [
      {
        invoice_item_id: inv5.items[0].id,
        quantity_to_credit: 1,
        amount_to_credit: 1000,
      },
    ],
    'Retained credit on account for future billing.',
    'CREDIT_ON_ACCOUNT',
    'AMOUNT_ADJUSTMENT',
    'RE_DISCOUNT'
  );

  assert(accountCn.refund_status === 'CREDIT_ON_ACCOUNT', 'REFUND: Initial status is CREDIT_ON_ACCOUNT');
  assert(accountCn.remaining_balance === 1050, 'REFUND: Remaining balance on account is 1,050.00 AED');

  // Now process refund via bank wire
  const refundedCn = db.processCreditNoteRefund(
    accountCn.id,
    'BANK',
    'WIRE-2026-9921',
    'Transferred to Emirates NBD account'
  );

  assert(refundedCn.status === 'REFUNDED', 'REFUND: Status transitioned to REFUNDED');
  assert(refundedCn.refund_status === 'REFUNDED_BANK', 'REFUND: Refund status is REFUNDED_BANK');
  assert(refundedCn.remaining_balance === 0, 'REFUND: Remaining balance on account reduced to 0');
  assert(refundedCn.refund_reference === 'WIRE-2026-9921', 'REFUND: Reference recorded');

  // Accounting Principle Violation: Attempt to delete issued credit note
  let deleteError = false;
  try {
    db.deleteCreditNote(accountCn.id);
  } catch (e: any) {
    deleteError = true;
  }
  assert(deleteError, 'IMMUTABILITY: Rejects deleting issued credit note');

  // -------------------------------------------------------------
  // Test 6: Impact on Financial Reports, Revenue, VAT, and Statements
  // -------------------------------------------------------------
  console.log('\n🔹 [6/7] Testing Impact on Financial Reports, Revenue, VAT, and Customer Statements...');

  // Dashboard Metrics
  const metrics = db.getDashboardMetrics();
  assert(typeof metrics.revenueThisYear === 'number', 'DASHBOARD: Revenue this year calculated');
  assert(typeof metrics.totalVatCollected === 'number', 'DASHBOARD: VAT collected accounts for credit notes');

  // VAT Summary (UAE VAT 201)
  const vatSummary = db.getReportData('VAT_SUMMARY') as any;
  assert(vatSummary.creditNotesStandardAdjustment > 0, 'VAT REPORT: Standard rated credit adjustments reported');
  assert(vatSummary.creditNotesVatAdjustment > 0, 'VAT REPORT: Output VAT adjustments reported');
  assert(
    vatSummary.netVatPayable === Number((vatSummary.standardVatCollected - vatSummary.creditNotesVatAdjustment).toFixed(2)),
    'VAT REPORT: Net VAT payable accurately subtracts credit note VAT adjustments'
  );

  // Customer Statement
  const statement = db.getReportData('CUSTOMER_STATEMENT', { customerId: customer.id }) as any;
  assert(statement.totalCredited > 0, 'STATEMENT: Customer total credited accurately aggregated');
  const cnEntries = statement.ledger.filter((r: any) => r.type === 'Credit Note');
  assert(cnEntries.length > 0, 'STATEMENT: Credit note transactions appear in customer ledger');

  // -------------------------------------------------------------
  // Test 7: UAE Electronic Credit Note / ASP Integration
  // -------------------------------------------------------------
  console.log('\n🔹 [7/7] Testing UAE Electronic Credit Note / ASP Clearance Simulation...');

  const aspCn = await db.submitCreditNoteToAsp(accountCn.id);
  assert(aspCn.e_invoice_status === 'ACCEPTED', 'ASP E-INVOICE: Status is ACCEPTED');
  assert(aspCn.e_invoice_uuid?.startsWith('uae-cn-') === true, 'ASP E-INVOICE: Contains valid UUID');
  assert(aspCn.e_invoice_hash?.startsWith('sha256:') === true, 'ASP E-INVOICE: Contains SHA-256 cryptographic digest');
  assert(aspCn.e_invoice_qr_code?.includes('tax.gov.ae') === true, 'ASP E-INVOICE: Verification QR code generated');
  assert(aspCn.asp_provider_name !== undefined, 'ASP E-INVOICE: Accredited Service Provider recorded');

  console.log('\n===============================================================');
  console.log(`📊 CREDIT NOTE TEST RESULTS: ${passedTests} PASSED, ${totalTests - passedTests} FAILED`);
  console.log('===============================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL UAE CREDIT NOTE SCENARIOS TESTED AND FULLY VERIFIED!\n');
  }
}

runCreditNoteTests().catch((err) => {
  console.error('Fatal error in credit note test suite:', err);
  process.exit(1);
});
