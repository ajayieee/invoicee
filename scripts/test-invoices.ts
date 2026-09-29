import { invoiceService, InvoiceInput } from '../src/services/invoice.service';
import { customerService } from '../src/services/customer.service';
import { productService } from '../src/services/product.service';
import { db } from '../src/lib/db/repository';
import { VatCalculator } from '../src/lib/vat/calculator';
import Decimal from 'decimal.js';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
    failedTests++;
  }
}

async function runInvoiceTestSuite() {
  console.log('\n===============================================================');
  console.log('🚀 RUNNING COMPREHENSIVE INVOICE MODULE TEST SUITE');
  console.log('===============================================================\n');

  // Reset repository state to clean seed data
  db.resetToDefault();

  const vatRates = productService.getVatRates();
  const standardVat = vatRates.find((v) => v.treatment === 'STANDARD_RATED')!;
  const zeroVat = vatRates.find((v) => v.treatment === 'ZERO_RATED')!;
  const exemptVat = vatRates.find((v) => v.treatment === 'EXEMPT')!;
  const outOfScopeVat = vatRates.find((v) => v.treatment === 'OUT_OF_SCOPE') || {
    id: 'vat-out-of-scope',
    rate_percentage: 0,
    treatment: 'OUT_OF_SCOPE' as const,
  };

  const paymentMethods = db.getPaymentMethods();
  const bankTransferPm = paymentMethods.find((p) => p.code === 'BANK_TRANSFER') || paymentMethods[0];

  const testCustomer = customerService.getCustomers().items[0];

  // -------------------------------------------------------------
  // TEST SCENARIO 1: UAE FTA VAT CALCULATIONS & TREATMENTS
  // -------------------------------------------------------------
  console.log('🔹 [1/6] Testing UAE FTA VAT Treatments (5%, 0%, Exempt, Out of Scope)...');

  // 1.1: 5% Standard VAT
  const calc5Pct = invoiceService.calculateInvoiceTotals([
    {
      description: 'Standard Consulting Services',
      quantity: 1,
      unit: 'Month',
      unit_price: 10000,
      vat_rate_id: standardVat.id,
      vat_treatment: 'STANDARD_RATED',
    },
  ]);
  assert(calc5Pct.subtotal_net === 10000, '5% VAT: Subtotal is 10,000.00 AED');
  assert(calc5Pct.vat_total === 500, '5% VAT: Total Output VAT is 500.00 AED (5%)');
  assert(calc5Pct.grand_total === 10500, '5% VAT: Grand Total is 10,500.00 AED');

  // 1.2: 0% Zero-Rated VAT
  const calc0Pct = invoiceService.calculateInvoiceTotals([
    {
      description: 'Export of Technical Services outside GCC',
      quantity: 2,
      unit: 'Service',
      unit_price: 4000,
      vat_rate_id: zeroVat.id,
      vat_treatment: 'ZERO_RATED',
    },
  ]);
  assert(calc0Pct.subtotal_net === 8000, '0% VAT: Subtotal is 8,000.00 AED');
  assert(calc0Pct.vat_total === 0, '0% VAT: Total Output VAT is 0.00 AED');
  assert(calc0Pct.grand_total === 8000, '0% VAT: Grand Total is 8,000.00 AED');

  // 1.3: Exempt VAT
  const calcExempt = invoiceService.calculateInvoiceTotals([
    {
      description: 'Exempt Financial Margin Service',
      quantity: 1,
      unit: 'Transaction',
      unit_price: 12000,
      vat_rate_id: exemptVat.id,
      vat_treatment: 'EXEMPT',
    },
  ]);
  assert(calcExempt.subtotal_net === 12000, 'Exempt: Subtotal is 12,000.00 AED');
  assert(calcExempt.vat_total === 0, 'Exempt: Total Output VAT is 0.00 AED');
  assert(calcExempt.grand_total === 12000, 'Exempt: Grand Total is 12,000.00 AED');

  // 1.4: Out of Scope VAT
  const calcOutOfScope = invoiceService.calculateInvoiceTotals([
    {
      description: 'Supply outside UAE territorial jurisdiction',
      quantity: 1,
      unit: 'Contract',
      unit_price: 15000,
      vat_rate_id: outOfScopeVat.id,
      vat_treatment: 'OUT_OF_SCOPE',
    },
  ]);
  assert(calcOutOfScope.subtotal_net === 15000, 'Out of Scope: Subtotal is 15,000.00 AED');
  assert(calcOutOfScope.vat_total === 0, 'Out of Scope: Total Output VAT is 0.00 AED');
  assert(calcOutOfScope.grand_total === 15000, 'Out of Scope: Grand Total is 15,000.00 AED');

  // -------------------------------------------------------------
  // TEST SCENARIO 2: DISCOUNTS & MULTIPLE VAT RATES & ROUNDING
  // -------------------------------------------------------------
  console.log('\n🔹 [2/6] Testing Discounts (Line & Document), Multiple VAT Rates, and Rounding...');

  // 2.1: Line-Level Discount before VAT
  const calcLineDiscount = invoiceService.calculateInvoiceTotals([
    {
      description: 'Server Hosting Package',
      quantity: 4,
      unit: 'Quarter',
      unit_price: 1000, // Gross 4,000
      discount_type: 'PERCENTAGE',
      discount_value: 10, // 10% = 400 AED discount -> Net 3,600 AED
      vat_rate_id: standardVat.id,
      vat_treatment: 'STANDARD_RATED',
    },
  ]);
  assert(calcLineDiscount.subtotal_net === 3600, 'Line Discount: Net taxable basis is 3,600.00 AED');
  assert(calcLineDiscount.vat_total === 180, 'Line Discount: 5% VAT computed on post-discount base is 180.00 AED');
  assert(calcLineDiscount.grand_total === 3780, 'Line Discount: Grand Total is 3,780.00 AED');

  // 2.2: Document-Level Discount before VAT (UAE FTA Article 25)
  const calcDocDiscount = invoiceService.calculateInvoiceTotals(
    [
      {
        description: 'Product A',
        quantity: 1,
        unit: 'Unit',
        unit_price: 1000,
        vat_rate_id: standardVat.id,
        vat_treatment: 'STANDARD_RATED',
      },
      {
        description: 'Product B',
        quantity: 1,
        unit: 'Unit',
        unit_price: 1000,
        vat_rate_id: standardVat.id,
        vat_treatment: 'STANDARD_RATED',
      },
    ],
    'FIXED_AMOUNT',
    200 // 200 AED doc discount on 2,000 AED subtotal -> 1,800 AED taxable
  );
  assert(calcDocDiscount.subtotal_net === 2000, 'Doc Discount: Gross subtotal is 2,000.00 AED');
  assert(calcDocDiscount.invoice_discount_amount === 200, 'Doc Discount: Document discount is 200.00 AED');
  assert(calcDocDiscount.vat_total === 90, 'Doc Discount: 5% VAT on 1,800 AED taxable consideration is 90.00 AED');
  assert(calcDocDiscount.grand_total === 1890, 'Doc Discount: Grand Total is 1,890.00 AED');

  // 2.3: Multiple VAT Rates in Single Invoice
  const calcMixed = invoiceService.calculateInvoiceTotals([
    {
      description: 'Standard 5% Item',
      quantity: 1,
      unit: 'Unit',
      unit_price: 10000,
      vat_rate_id: standardVat.id,
      vat_treatment: 'STANDARD_RATED',
    },
    {
      description: 'Zero Rated Item',
      quantity: 1,
      unit: 'Unit',
      unit_price: 5000,
      vat_rate_id: zeroVat.id,
      vat_treatment: 'ZERO_RATED',
    },
    {
      description: 'Exempt Item',
      quantity: 1,
      unit: 'Unit',
      unit_price: 3000,
      vat_rate_id: exemptVat.id,
      vat_treatment: 'EXEMPT',
    },
    {
      description: 'Out of Scope Item',
      quantity: 1,
      unit: 'Unit',
      unit_price: 2000,
      vat_rate_id: outOfScopeVat.id,
      vat_treatment: 'OUT_OF_SCOPE',
    },
  ]);
  assert(calcMixed.subtotal_net === 20000, 'Mixed VAT: Subtotal is 20,000.00 AED');
  assert(calcMixed.vat_total === 500, 'Mixed VAT: VAT total is exactly 500.00 AED (only standard line taxed)');
  assert(calcMixed.grand_total === 20500, 'Mixed VAT: Grand Total is 20,500.00 AED');

  // 2.4: Half-Up Commercial Rounding to Nearest Fils
  // 3 x 33.33 = 99.99 AED. 5% VAT = 4.9995 AED -> round half-up = 5.00 AED. Total = 104.99 AED.
  const calcRounding = invoiceService.calculateInvoiceTotals([
    {
      description: 'Fractional Unit Item',
      quantity: 3,
      unit: 'Item',
      unit_price: 33.33,
      vat_rate_id: standardVat.id,
      vat_treatment: 'STANDARD_RATED',
    },
  ]);
  assert(calcRounding.subtotal_net === 99.99, 'Rounding: Subtotal 3 x 33.33 is 99.99 AED');
  assert(calcRounding.vat_total === 5.0, 'Rounding: 4.9995 AED VAT rounds half-up to exactly 5.00 AED');
  assert(calcRounding.grand_total === 104.99, 'Rounding: Grand Total is 104.99 AED');

  // -------------------------------------------------------------
  // TEST SCENARIO 3: INVOICE LIFECYCLE (DRAFT -> ISSUED -> EDIT GUARDS)
  // -------------------------------------------------------------
  console.log('\n🔹 [3/6] Testing Invoice Creation, Draft Editing, and Official Issuance...');

  const todayStr = new Date().toISOString().split('T')[0];
  const dueStr = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  // 3.1: Create Draft Invoice
  const createDraftRes = invoiceService.createInvoice({
    customer_id: testCustomer.id,
    invoice_date: todayStr,
    supply_date: todayStr,
    due_date: dueStr,
    payment_terms_days: 30,
    reference_number: 'PO-TEST-001',
    status: 'DRAFT',
    items: [
      {
        description: 'Draft Enterprise Setup',
        quantity: 2,
        unit: 'Month',
        unit_price: 5000,
        vat_rate_id: standardVat.id,
        vat_treatment: 'STANDARD_RATED',
      },
    ],
  });

  assert(createDraftRes.success, 'CREATE DRAFT: Draft invoice created successfully');
  const draftInvoice = createDraftRes.data!;
  assert(draftInvoice.status === 'DRAFT', 'CREATE DRAFT: Status is DRAFT');
  assert(draftInvoice.grand_total === 10500, 'CREATE DRAFT: Grand Total is 10,500.00 AED (10k + 5% VAT)');
  assert(draftInvoice.balance_due === 10500, 'CREATE DRAFT: Initial balance due matches grand total');

  // 3.2: Edit Draft Invoice
  const updateDraftRes = invoiceService.updateDraftInvoice(draftInvoice.id, {
    items: [
      {
        description: 'Updated Enterprise Setup',
        quantity: 3, // Changed from 2 to 3 -> 15k + 5% VAT = 15,750 AED
        unit: 'Month',
        unit_price: 5000,
        vat_rate_id: standardVat.id,
        vat_treatment: 'STANDARD_RATED',
      },
    ],
  });
  assert(updateDraftRes.success, 'UPDATE DRAFT: Draft invoice updated successfully');
  assert(updateDraftRes.data?.grand_total === 15750, 'UPDATE DRAFT: Grand total recalculated to 15,750.00 AED');

  // 3.3: Issue Official Invoice (DRAFT -> ISSUED)
  const issueRes = invoiceService.issueInvoice(draftInvoice.id);
  assert(issueRes.success, 'ISSUE: Invoice officially issued');
  const issuedInvoice = issueRes.data!;
  assert(issuedInvoice.status === 'ISSUED', 'ISSUE: Status transitioned to ISSUED');
  assert(
    issuedInvoice.invoice_number.startsWith('INV-'),
    'ISSUE: Permanent legal sequential number allocated (starts with INV-)'
  );
  assert(issuedInvoice.balance_due === 15750, 'ISSUE: Balance due is set to 15,750.00 AED');

  // 3.4: Audit Guard: Prohibit Destructive Editing on Issued Invoice
  const editIssuedRes = invoiceService.updateDraftInvoice(issuedInvoice.id, {
    notes: 'Illegal modification attempt',
  });
  assert(
    Boolean(!editIssuedRes.success && editIssuedRes.error?.includes('locked for audit integrity')),
    'AUDIT GUARD: Prohibits destructive editing once invoice is issued'
  );

  // -------------------------------------------------------------
  // TEST SCENARIO 4: PAYMENTS (PARTIAL, FULL, ANTI-OVERPAYMENT, REVERSAL)
  // -------------------------------------------------------------
  console.log('\n🔹 [4/6] Testing Payments (Partial, Anti-Overpayment, Full, Reversal)...');

  // 4.1: Record Partial Payment
  const partialPayRes = invoiceService.recordPayment({
    invoice_id: issuedInvoice.id,
    payment_method_id: bankTransferPm.id,
    amount: 5000, // 5,000 of 15,750 AED
    notes: 'First installment payment',
  });
  assert(partialPayRes.success, 'PARTIAL PAYMENT: Recorded 5,000.00 AED payment');
  const invAfterPartial = invoiceService.getInvoiceById(issuedInvoice.id)!;
  assert(invAfterPartial.amount_paid === 5000, 'PARTIAL PAYMENT: Amount paid is 5,000.00 AED');
  assert(invAfterPartial.balance_due === 10750, 'PARTIAL PAYMENT: Balance due is 10,750.00 AED');
  assert(invAfterPartial.status === 'PARTIALLY_PAID', 'PARTIAL PAYMENT: Status transitioned to PARTIALLY_PAID');

  // 4.2: Anti-Overpayment Check
  const overpayRes = invoiceService.recordPayment({
    invoice_id: issuedInvoice.id,
    payment_method_id: bankTransferPm.id,
    amount: 15000, // Exceeds balance of 10,750 AED
    notes: 'Attempted overpayment',
  });
  assert(
    Boolean(!overpayRes.success && overpayRes.error?.includes('exceeds invoice balance due')),
    'ANTI-OVERPAYMENT: Rejects payment exceeding outstanding balance due'
  );

  // 4.3: Full Payment
  const fullPayRes = invoiceService.recordPayment({
    invoice_id: issuedInvoice.id,
    payment_method_id: bankTransferPm.id,
    amount: 10750, // Pay exact balance
    notes: 'Final settlement payment',
  });
  assert(fullPayRes.success, 'FULL PAYMENT: Recorded remaining 10,750.00 AED payment');
  const invAfterFull = invoiceService.getInvoiceById(issuedInvoice.id)!;
  assert(invAfterFull.amount_paid === 15750, 'FULL PAYMENT: Amount paid is 15,750.00 AED');
  assert(invAfterFull.balance_due === 0, 'FULL PAYMENT: Balance due is exactly 0.00 AED');
  assert(invAfterFull.status === 'PAID', 'FULL PAYMENT: Status transitioned to PAID');

  // 4.4: Payment Reversal
  const reverseRes = invoiceService.reversePayment(fullPayRes.data!.id, 'Client payment bounced by bank');
  assert(reverseRes.success, 'REVERSAL: Successfully reversed final payment');
  const invAfterReverse = invoiceService.getInvoiceById(issuedInvoice.id)!;
  assert(invAfterReverse.amount_paid === 5000, 'REVERSAL: Amount paid restored to 5,000.00 AED');
  assert(invAfterReverse.balance_due === 10750, 'REVERSAL: Balance due restored to 10,750.00 AED');
  assert(invAfterReverse.status === 'PARTIALLY_PAID', 'REVERSAL: Status reverted back to PARTIALLY_PAID');

  // -------------------------------------------------------------
  // TEST SCENARIO 5: CREDIT NOTES WORKFLOW
  // -------------------------------------------------------------
  console.log('\n🔹 [5/6] Testing Credit Notes Adjustment Workflow...');

  // Create fresh issued invoice for credit note testing: 1 item x 4,000 + 5% VAT = 4,200 AED
  const cnTestInvoiceRes = invoiceService.createInvoice({
    customer_id: testCustomer.id,
    invoice_date: todayStr,
    supply_date: todayStr,
    due_date: dueStr,
    status: 'ISSUED',
    items: [
      {
        description: 'Server Migration Service',
        quantity: 2,
        unit: 'Unit',
        unit_price: 2000, // 4,000 AED + 200 AED VAT = 4,200 AED
        vat_rate_id: standardVat.id,
        vat_treatment: 'STANDARD_RATED',
      },
    ],
  });
  const cnTestInvoice = cnTestInvoiceRes.data!;

  // 5.1: Issue Credit Note for 1 unit (2,000 AED + 100 AED VAT = 2,100 AED)
  const creditNoteRes = invoiceService.createCreditNote({
    invoice_id: cnTestInvoice.id,
    reason: 'Defective server node returned by customer',
    items: [
      {
        invoice_item_id: cnTestInvoice.items[0].id,
        quantity_to_credit: 1,
        unit_price: 2000,
        reason: 'Partial return',
      },
    ],
    allocation_type: 'INVOICE_OFFSET',
  });

  assert(creditNoteRes.success, 'CREDIT NOTE: Issued credit note successfully');
  const createdCreditNote = creditNoteRes.data!;
  assert(
    createdCreditNote.credit_note_number.startsWith('CN-'),
    'CREDIT NOTE: Allocated sequential credit note number (starts with CN-)'
  );
  assert(createdCreditNote.grand_total === 2100, 'CREDIT NOTE: Credit note total is 2,100.00 AED');

  const invAfterCn = invoiceService.getInvoiceById(cnTestInvoice.id)!;
  assert(invAfterCn.balance_due === 2100, 'CREDIT NOTE: Invoice balance due reduced from 4,200 to 2,100.00 AED');

  // -------------------------------------------------------------
  // TEST SCENARIO 6: CANCELLATION, PERMANENCE & DUPLICATION
  // -------------------------------------------------------------
  console.log('\n🔹 [6/6] Testing Cancellation Safeguards, Permanent Numbers, and Duplication...');

  // 6.1: Cannot cancel invoice with payments recorded
  const cancelPaidAttempt = invoiceService.cancelInvoice(
    issuedInvoice.id,
    'Attempt to cancel partially paid invoice'
  );
  assert(
    Boolean(!cancelPaidAttempt.success && cancelPaidAttempt.error?.includes('recorded payments')),
    'CANCELLATION GUARD: Prohibits cancelling invoice with active recorded payments'
  );

  // 6.2: Create new unpaid issued invoice to test clean cancellation
  const cancelTestInvRes = invoiceService.createInvoice({
    customer_id: testCustomer.id,
    invoice_date: todayStr,
    supply_date: todayStr,
    due_date: dueStr,
    status: 'ISSUED',
    items: [
      {
        description: 'Cancelled Cloud Migration',
        quantity: 1,
        unit: 'Job',
        unit_price: 8000,
        vat_rate_id: standardVat.id,
        vat_treatment: 'STANDARD_RATED',
      },
    ],
  });
  const cancelTestInv = cancelTestInvRes.data!;
  const cancelledInvNumber = cancelTestInv.invoice_number;

  // 6.3: Cancel the invoice with audit reason
  const cancelRes = invoiceService.cancelInvoice(cancelTestInv.id, 'Contract cancelled by mutual consent prior to supply');
  assert(cancelRes.success, 'CANCELLATION: Unpaid invoice successfully cancelled');
  const cancelledInv = invoiceService.getInvoiceById(cancelTestInv.id)!;
  assert(cancelledInv.status === 'CANCELLED', 'CANCELLATION: Status is CANCELLED');
  assert(cancelledInv.balance_due === 0, 'CANCELLATION: Balance due zeroed out');
  assert(cancelledInv.cancelled_at !== undefined, 'CANCELLATION: Timestamp recorded');
  assert(cancelledInv.cancellation_reason !== undefined, 'CANCELLATION: Reason recorded');

  // 6.4: Number Permanence Check: Number must NOT be reused
  const nextInvRes = invoiceService.createInvoice({
    customer_id: testCustomer.id,
    invoice_date: todayStr,
    supply_date: todayStr,
    due_date: dueStr,
    status: 'ISSUED',
    items: [
      {
        description: 'Subsequent Contract',
        quantity: 1,
        unit: 'Job',
        unit_price: 5000,
        vat_rate_id: standardVat.id,
        vat_treatment: 'STANDARD_RATED',
      },
    ],
  });
  const nextInv = nextInvRes.data!;
  assert(
    nextInv.invoice_number !== cancelledInvNumber,
    'NUMBER PERMANENCE: Cancelled invoice number is NEVER reused by subsequent invoices'
  );

  // 6.5: Verify Cancelled Invoice Still Exists in Database (Accounting Principle)
  const foundCancelled = invoiceService.getInvoiceById(cancelTestInv.id);
  assert(
    foundCancelled !== undefined && foundCancelled.invoice_number === cancelledInvNumber,
    'AUDIT RETENTION: Cancelled invoice remains permanently recorded in the database'
  );

  // 6.6: Duplicate Invoice
  const duplicateRes = invoiceService.duplicateInvoice(nextInv.id);
  assert(duplicateRes.success, 'DUPLICATE: Clones invoice into new proposal');
  const cloned = duplicateRes.data!;
  assert(cloned.status === 'DRAFT', 'DUPLICATE: Cloned invoice resets to DRAFT status');
  assert(cloned.id !== nextInv.id, 'DUPLICATE: Cloned invoice has new unique ID');
  assert(cloned.items.length === nextInv.items.length, 'DUPLICATE: Preserves all line items');
  assert(cloned.grand_total === nextInv.grand_total, 'DUPLICATE: Preserves monetary totals');

  // Summary
  console.log('\n===============================================================');
  console.log(`📊 INVOICE TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('===============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runInvoiceTestSuite();
