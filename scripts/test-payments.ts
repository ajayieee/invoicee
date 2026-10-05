import { paymentService } from '../src/services/payment.service';
import { invoiceService } from '../src/services/invoice.service';
import { customerService } from '../src/services/customer.service';
import { productService } from '../src/services/product.service';
import { dashboardService } from '../src/services/dashboard.service';
import { db } from '../src/lib/db/repository';

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

async function runPaymentTestSuite() {
  console.log('\n===============================================================');
  console.log('🚀 RUNNING COMPREHENSIVE PAYMENT MODULE TEST SUITE');
  console.log('===============================================================\n');

  // Reset repository state to clean seed data
  db.resetToDefault();

  const vatRates = productService.getVatRates();
  const standardVat = vatRates.find((v) => v.treatment === 'STANDARD_RATED')!;
  const testCustomer = customerService.getCustomers().items[0];

  const todayStr = new Date().toISOString().split('T')[0];
  const dueStr = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  // -------------------------------------------------------------
  // TEST SCENARIO 1: PAYMENT METHODS VALIDATION
  // -------------------------------------------------------------
  console.log('🔹 [1/6] Verifying Supported Payment Methods (Wire, Cash, Card, Debit, Cheque, Other)...');

  const methods = paymentService.getPaymentMethods();
  const methodCodes = methods.map((m) => m.code);

  assert(methodCodes.includes('BANK_TRANSFER'), 'PAYMENT METHOD: Bank Transfer supported');
  assert(methodCodes.includes('CASH'), 'PAYMENT METHOD: Cash supported');
  assert(methodCodes.includes('CREDIT_CARD'), 'PAYMENT METHOD: Credit Card supported');
  assert(methodCodes.includes('DEBIT_CARD'), 'PAYMENT METHOD: Debit Card supported');
  assert(methodCodes.includes('CHEQUE'), 'PAYMENT METHOD: Cheque supported');
  assert(methodCodes.includes('OTHER'), 'PAYMENT METHOD: Other supported');

  const wireMethod = methods.find((m) => m.code === 'BANK_TRANSFER')!;
  const chequeMethod = methods.find((m) => m.code === 'CHEQUE')!;
  const cardMethod = methods.find((m) => m.code === 'CREDIT_CARD')!;

  // -------------------------------------------------------------
  // TEST SCENARIO 2: MULTIPLE PAYMENTS & BALANCE AUTO-CALCULATIONS
  // -------------------------------------------------------------
  console.log('\n🔹 [2/6] Testing Multiple Payments Against One Invoice & Status Transitions...');

  // Create test invoice: 10,000 AED + 5% VAT = 10,500.00 AED
  const invRes = await invoiceService.createInvoice({
    customer_id: testCustomer.id,
    invoice_date: todayStr,
    supply_date: todayStr,
    due_date: dueStr,
    status: 'ISSUED',
    items: [
      {
        description: 'Enterprise Cloud Architecture',
        quantity: 1,
        unit: 'Month',
        unit_price: 10000,
        vat_rate_id: standardVat.id,
        vat_treatment: 'STANDARD_RATED',
      },
    ],
  });

  const testInvoice = invRes.data!;
  assert(testInvoice.grand_total === 10500, 'INVOICE: Initial grand total is 10,500.00 AED');
  assert(testInvoice.amount_paid === 0, 'INVOICE: Initial amount paid is 0.00 AED');
  assert(testInvoice.balance_due === 10500, 'INVOICE: Initial balance due is 10,500.00 AED');
  assert(testInvoice.status === 'ISSUED', 'INVOICE: Initial status is ISSUED');

  // 2.1: Payment 1 (Partial payment of 4,000 AED via Wire)
  const pay1Res = paymentService.recordPayment({
    invoice_id: testInvoice.id,
    payment_method_id: wireMethod.id,
    amount: 4000,
    payment_date: todayStr,
    reference_number: 'WIRE-2026-001',
    notes: 'Advance installment 1',
    payment_proof_name: 'wire_advice_001.pdf',
    payment_proof_url: 'data:application/pdf;base64,JVBERi0xLjQKJ...',
  });

  assert(pay1Res.success, 'PAYMENT 1: Recorded 4,000.00 AED partial payment');
  const pay1 = pay1Res.data!;
  assert(pay1.payment_number.startsWith('PAY-'), 'PAYMENT 1: Sequential payment number allocated');
  assert(pay1.payment_proof_name === 'wire_advice_001.pdf', 'PAYMENT 1: Proof file name recorded');

  const invAfterPay1 = invoiceService.getInvoiceById(testInvoice.id)!;
  assert(invAfterPay1.grand_total === 10500, 'CALCULATION 1: Invoice total remains 10,500.00 AED');
  assert(invAfterPay1.amount_paid === 4000, 'CALCULATION 1: Total paid is 4,000.00 AED');
  assert(invAfterPay1.balance_due === 6500, 'CALCULATION 1: Balance due is 6,500.00 AED');
  assert(invAfterPay1.status === 'PARTIALLY_PAID', 'STATUS 1: Status transitioned to PARTIALLY_PAID');

  // 2.2: Payment 2 (Second partial payment of 3,500 AED via Cheque)
  const pay2Res = paymentService.recordPayment({
    invoice_id: testInvoice.id,
    payment_method_id: chequeMethod.id,
    amount: 3500,
    payment_date: todayStr,
    reference_number: 'CHQ-98402',
    notes: 'Installment 2 via post-dated cheque cleared',
  });

  assert(pay2Res.success, 'PAYMENT 2: Recorded 3,500.00 AED second payment');
  const invAfterPay2 = invoiceService.getInvoiceById(testInvoice.id)!;
  assert(invAfterPay2.amount_paid === 7500, 'CALCULATION 2: Cumulative paid is 7,500.00 AED');
  assert(invAfterPay2.balance_due === 3000, 'CALCULATION 2: Remaining balance due is 3,000.00 AED');
  assert(invAfterPay2.status === 'PARTIALLY_PAID', 'STATUS 2: Status remains PARTIALLY_PAID');

  // 2.3: Payment 3 (Final settlement of 3,000 AED via Credit Card)
  const pay3Res = paymentService.recordPayment({
    invoice_id: testInvoice.id,
    payment_method_id: cardMethod.id,
    amount: 3000,
    payment_date: todayStr,
    reference_number: 'AUTH-CC-8874',
    notes: 'Final balance payment',
  });

  assert(pay3Res.success, 'PAYMENT 3: Recorded final 3,000.00 AED settlement payment');
  const invAfterPay3 = invoiceService.getInvoiceById(testInvoice.id)!;
  assert(invAfterPay3.amount_paid === 10500, 'CALCULATION 3: Cumulative paid is exactly 10,500.00 AED');
  assert(invAfterPay3.balance_due === 0, 'CALCULATION 3: Balance due is exactly 0.00 AED');
  assert(invAfterPay3.status === 'PAID', 'STATUS 3: Status transitioned to PAID');

  // -------------------------------------------------------------
  // TEST SCENARIO 3: ACCIDENTAL DUPLICATE PAYMENT PREVENTION
  // -------------------------------------------------------------
  console.log('\n🔹 [3/6] Testing Accidental Duplicate Payment Prevention & Overpayment Safeguards...');

  // 3.1: Anti-Overpayment Guard on fully paid invoice
  const overpayAttempt = paymentService.recordPayment({
    invoice_id: testInvoice.id,
    payment_method_id: wireMethod.id,
    amount: 500,
    payment_date: todayStr,
    reference_number: 'EXTRA-001',
  });
  assert(
    Boolean(!overpayAttempt.success && overpayAttempt.error?.includes('exceeds invoice outstanding balance')),
    'ANTI-OVERPAYMENT: Rejects payment on invoice with 0 balance due'
  );

  // 3.2: Create fresh partially paid invoice to test duplicate detection
  const dupTestInvRes = await invoiceService.createInvoice({
    customer_id: testCustomer.id,
    invoice_date: todayStr,
    supply_date: todayStr,
    due_date: dueStr,
    status: 'ISSUED',
    items: [
      {
        description: 'Consulting Retainer',
        quantity: 1,
        unit: 'Month',
        unit_price: 20000, // 21,000 AED total
        vat_rate_id: standardVat.id,
        vat_treatment: 'STANDARD_RATED',
      },
    ],
  });
  const dupInvoice = dupTestInvRes.data!;

  // Record initial payment of 5,000 with reference 'WIRE-TXN-777'
  const firstPmtRes = paymentService.recordPayment({
    invoice_id: dupInvoice.id,
    payment_method_id: wireMethod.id,
    amount: 5000,
    payment_date: todayStr,
    reference_number: 'WIRE-TXN-777',
    notes: 'First payment',
  });
  assert(firstPmtRes.success, 'DUPLICATE BASE: First payment of 5,000 AED posted');

  // Attempt 1: Duplicate with same reference number
  const dupRefAttempt = paymentService.recordPayment({
    invoice_id: dupInvoice.id,
    payment_method_id: wireMethod.id,
    amount: 5000,
    payment_date: todayStr,
    reference_number: 'WIRE-TXN-777', // Same reference
    notes: 'Accidental double click submit',
  });
  assert(
    Boolean(!dupRefAttempt.success && dupRefAttempt.error?.includes('Potential duplicate payment detected')),
    'DUPLICATE GUARD: Rejects duplicate payment sharing identical reference number'
  );

  // Attempt 2: Duplicate with same amount on same date
  const dupAmountAttempt = paymentService.recordPayment({
    invoice_id: dupInvoice.id,
    payment_method_id: wireMethod.id,
    amount: 5000, // Same amount on same date
    payment_date: todayStr,
    notes: 'No reference entered',
  });
  assert(
    Boolean(!dupAmountAttempt.success && dupAmountAttempt.error?.includes('Potential duplicate payment detected')),
    'DUPLICATE GUARD: Rejects identical amount recorded on same date without override'
  );

  // Intentional Override: Allow duplicate when flag is explicitly provided
  const overrideRes = paymentService.recordPayment({
    invoice_id: dupInvoice.id,
    payment_method_id: wireMethod.id,
    amount: 5000,
    payment_date: todayStr,
    reference_number: 'WIRE-TXN-777',
    allow_duplicate: true, // User confirmed
    notes: 'Confirmed separate wire transfer with same transaction id batch',
  });
  assert(overrideRes.success, 'DUPLICATE OVERRIDE: Permits payment when user explicitly confirms intent');

  // -------------------------------------------------------------
  // TEST SCENARIO 4: PAYMENT HISTORY AUDITING (INVOICE & CUSTOMER)
  // -------------------------------------------------------------
  console.log('\n🔹 [4/6] Testing Payment History Access on Invoices and Customers...');

  // 4.1: Payment history on Invoice
  const invoiceHistory = paymentService.getPaymentsByInvoice(testInvoice.id);
  assert(invoiceHistory.length === 3, 'INVOICE HISTORY: All 3 payments listed for invoice');
  assert(invoiceHistory[0].amount === 3000, 'INVOICE HISTORY: Most recent payment appears first');

  // 4.2: Payment history on Customer
  const customerHistory = paymentService.getPaymentsByCustomer(testCustomer.id);
  assert(customerHistory.length >= 5, 'CUSTOMER HISTORY: Complete customer payment ledger accessible');

  // 4.3: Customer 360 includes payments
  const c360 = customerService.getCustomer360(testCustomer.id)!;
  assert(c360.payments.length >= 5, 'CUSTOMER 360: Payments included in Customer 360 summary');
  assert(c360.totalPaid > 0, 'CUSTOMER 360: Total paid accurately aggregated');

  // -------------------------------------------------------------
  // TEST SCENARIO 5: PAYMENT REVERSAL MECHANISM
  // -------------------------------------------------------------
  console.log('\n🔹 [5/6] Testing Payment Reversal (Audit Retained, Never Deleted, Balance Reopened)...');

  // Reverse payment 3 (3,000 AED) on testInvoice
  const revRes = paymentService.reversePayment(pay3Res.data!.id, 'Client payment bounced by bank');
  assert(revRes.success, 'REVERSAL: Payment successfully reversed');
  const reversedPay = paymentService.getPaymentById(pay3Res.data!.id)!;
  assert(reversedPay.status === 'REVERSED', 'REVERSAL: Payment status transitioned to REVERSED');
  assert(reversedPay.reversed_at !== undefined, 'REVERSAL: Reversal timestamp recorded');
  assert(reversedPay.reversal_reason === 'Client payment bounced by bank', 'REVERSAL: Reason recorded');

  // Check invoice balance reopening
  const invReopened = invoiceService.getInvoiceById(testInvoice.id)!;
  assert(invReopened.amount_paid === 7500, 'REVERSAL REOPEN: Amount paid restored to 7,500.00 AED');
  assert(invReopened.balance_due === 3000, 'REVERSAL REOPEN: Balance due reopened to 3,000.00 AED');
  assert(invReopened.status === 'PARTIALLY_PAID', 'REVERSAL REOPEN: Invoice status restored to PARTIALLY_PAID');

  // Prohibit double reversal
  const doubleRev = paymentService.reversePayment(pay3Res.data!.id, 'Second reversal attempt');
  assert(
    Boolean(!doubleRev.success && doubleRev.error?.includes('already been reversed')),
    'REVERSAL GUARD: Prohibits reversing an already reversed payment'
  );

  // -------------------------------------------------------------
  // TEST SCENARIO 6: AUTOMATIC DASHBOARD METRICS UPDATE
  // -------------------------------------------------------------
  console.log('\n🔹 [6/6] Testing Automatic Dashboard Financial Metrics Update...');

  const metricsBefore = dashboardService.getMetrics();
  assert(metricsBefore.outstandingReceivables > 0, 'DASHBOARD: Computes outstanding receivables');

  // Record a payment of 1,000 AED and verify dashboard metrics reflect it
  const dashPay = paymentService.recordPayment({
    invoice_id: dupInvoice.id,
    payment_method_id: wireMethod.id,
    amount: 1000,
    payment_date: todayStr,
    reference_number: 'DASH-METRIC-01',
  });
  assert(dashPay.success, 'DASHBOARD TEST: Recorded 1,000.00 AED payment');

  const metricsAfter = dashboardService.getMetrics();
  assert(
    metricsAfter.outstandingReceivables === metricsBefore.outstandingReceivables - 1000,
    'DASHBOARD: Outstanding receivables decreased by exactly 1,000.00 AED'
  );
  assert(
    metricsAfter.paymentsReceivedThisMonth === metricsBefore.paymentsReceivedThisMonth + 1000,
    'DASHBOARD: Payments received this month increased by exactly 1,000.00 AED'
  );

  // Summary
  console.log('\n===============================================================');
  console.log(`📊 PAYMENT TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('===============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPaymentTestSuite();
