import { quoteService, QuoteInput } from '../src/services/quote.service';
import { customerService } from '../src/services/customer.service';
import { productService } from '../src/services/product.service';
import { db } from '../src/lib/db/repository';
import { VatCalculator } from '../src/lib/vat/calculator';

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

async function runQuoteTestSuite() {
  console.log('\n===============================================================');
  console.log('🚀 RUNNING COMPREHENSIVE QUOTATION MODULE TEST SUITE');
  console.log('===============================================================\n');

  // Reset repository state to clean seed data
  db.resetToDefault();

  const vatRates = productService.getVatRates();
  const standardVat = vatRates.find((v) => v.treatment === 'STANDARD_RATED')!;
  const zeroVat = vatRates.find((v) => v.treatment === 'ZERO_RATED')!;
  const exemptVat = vatRates.find((v) => v.treatment === 'EXEMPT')!;

  const testCustomer = customerService.getCustomers().items[0];

  // -------------------------------------------------------------
  // TEST SCENARIO 1: MATHEMATICAL & TAX ACCURACY
  // -------------------------------------------------------------
  console.log('🔹 [1/4] Testing Quotation Mathematical Accuracy (Subtotal, Discount, VAT 5%, Total)...');

  // Test 1.1: Single Standard 5% item
  const calcSingle = quoteService.calculateQuoteTotals([
    {
      description: 'Cloud Consulting',
      quantity: 2,
      unit: 'Hour',
      unit_price: 1000,
      vat_rate_id: standardVat.id,
    },
  ]);
  assert(calcSingle.subtotal_net === 2000, 'Subtotal: 2 x 1,000 = 2,000 AED');
  assert(calcSingle.vat_total === 100, 'VAT (5%): 2,000 * 5% = 100.00 AED');
  assert(calcSingle.grand_total === 2100, 'Grand Total: 2,000 + 100 = 2,100.00 AED');

  // Test 1.2: Line-level Percentage Discount
  // Qty: 4, Price: 500 = 2,000 gross. Discount: 10% = 200 discount. Net = 1,800. VAT 5% = 90. Gross = 1,890.
  const calcLineDiscount = quoteService.calculateQuoteTotals([
    {
      description: 'Managed Services',
      quantity: 4,
      unit: 'Month',
      unit_price: 500,
      discount_type: 'PERCENTAGE',
      discount_value: 10,
      vat_rate_id: standardVat.id,
    },
  ]);
  assert(calcLineDiscount.items[0].discount_amount === 200, 'Line Discount: 10% of 2,000 = 200 AED');
  assert(calcLineDiscount.subtotal_net === 1800, 'Subtotal Net: 2,000 - 200 = 1,800 AED');
  assert(calcLineDiscount.vat_total === 90, 'VAT (5%): 1,800 * 5% = 90.00 AED');
  assert(calcLineDiscount.grand_total === 1890, 'Grand Total: 1,800 + 90 = 1,890.00 AED');

  // Test 1.3: Document-level Fixed Discount
  // Items net = 3,000. Doc discount = 500. Taxable Net = 2,500. VAT 5% = 125. Grand Total = 2,625.
  const calcDocDiscount = quoteService.calculateQuoteTotals(
    [
      {
        description: 'Server Provisioning',
        quantity: 3,
        unit: 'Unit',
        unit_price: 1000,
        vat_rate_id: standardVat.id,
      },
    ],
    'FIXED_AMOUNT',
    500
  );
  assert(calcDocDiscount.subtotal_net === 3000, 'Line Subtotal: 3 x 1,000 = 3,000 AED');
  assert(calcDocDiscount.invoice_discount_amount === 500, 'Document Discount: 500 AED');
  assert(calcDocDiscount.vat_total === 125, 'VAT (5% on 2,500): 125.00 AED');
  assert(calcDocDiscount.grand_total === 2625, 'Grand Total: 2,500 + 125 = 2,625.00 AED');

  // Test 1.4: Mixed VAT treatments (Standard 5% + Zero-Rated 0% export)
  const calcMixed = quoteService.calculateQuoteTotals([
    {
      description: 'Local UAE Consultancy',
      quantity: 1,
      unit: 'Unit',
      unit_price: 10000,
      vat_rate_id: standardVat.id, // 5%
    },
    {
      description: 'Export of Remote Software License',
      quantity: 1,
      unit: 'Unit',
      unit_price: 5000,
      vat_rate_id: zeroVat.id, // 0%
    },
  ]);
  assert(calcMixed.subtotal_net === 15000, 'Combined Net Subtotal: 10,000 + 5,000 = 15,000 AED');
  assert(calcMixed.vat_total === 500, 'VAT: 5% on 10,000 (500) + 0% on 5,000 (0) = 500.00 AED');
  assert(calcMixed.grand_total === 15500, 'Grand Total: 15,000 + 500 = 15,500.00 AED');

  // -------------------------------------------------------------
  // TEST SCENARIO 2: QUOTATION LIFECYCLE (DRAFT, SEND, ACCEPT, REJECT)
  // -------------------------------------------------------------
  console.log('\n🔹 [2/4] Testing Quotation Lifecycle & Audit Safeguards...');

  // Create Draft Quote
  const createRes = quoteService.createQuote({
    customer_id: testCustomer.id,
    quote_date: '2026-03-01',
    expiry_date: '2026-03-31',
    items: [
      {
        description: 'Enterprise ERP Migration',
        quantity: 1,
        unit: 'Contract',
        unit_price: 40000,
        vat_rate_id: standardVat.id,
      },
      {
        description: 'User Onboarding Training',
        quantity: 5,
        unit: 'Day',
        unit_price: 2000,
        vat_rate_id: standardVat.id,
      },
    ],
    notes: 'Standard UAE warranty applies.',
    terms: 'Payment 50% advance, 50% upon signoff.',
  });

  assert(createRes.success && !!createRes.data, 'CREATE: Draft quotation created');
  const quoteId = createRes.data!.id;
  const quoteNum = createRes.data!.quote_number;
  assert(createRes.data!.status === 'DRAFT', 'Initial quotation status is DRAFT');
  assert(createRes.data!.grand_total === 52500, 'Grand Total calculated: (40k + 10k) + 5% VAT = 52,500 AED');

  // Edit Draft Quote
  const updateDraftRes = quoteService.updateQuote(quoteId, {
    customer_id: testCustomer.id,
    quote_date: '2026-03-01',
    expiry_date: '2026-04-15',
    items: [
      {
        description: 'Enterprise ERP Migration (Advanced)',
        quantity: 1,
        unit: 'Contract',
        unit_price: 45000, // Updated price
        vat_rate_id: standardVat.id,
      },
      {
        description: 'User Onboarding Training',
        quantity: 5,
        unit: 'Day',
        unit_price: 2000,
        vat_rate_id: standardVat.id,
      },
    ],
    notes: 'Extended validity to April 15.',
  });
  assert(updateDraftRes.success, 'UPDATE: Draft quote modified successfully');
  assert(
    quoteService.getQuoteById(quoteId)?.grand_total === 57750,
    'UPDATE: Grand Total updated: (45k + 10k) + 5% VAT = 57,750 AED'
  );

  // Transition DRAFT -> SENT
  const sendRes = quoteService.updateQuoteStatus(quoteId, 'SENT');
  assert(sendRes.success && sendRes.data?.status === 'SENT', 'TRANSITION: Quote marked as SENT');

  // Audit Safeguard: Cannot edit SENT quote
  const editSentRes = quoteService.updateQuote(quoteId, {
    customer_id: testCustomer.id,
    quote_date: '2026-03-01',
    expiry_date: '2026-04-15',
    items: [
      {
        description: 'Attempted Post-Send Tampering',
        quantity: 1,
        unit: 'Unit',
        unit_price: 100,
        vat_rate_id: standardVat.id,
      },
    ],
  });
  assert(
    Boolean(!editSentRes.success && editSentRes.error?.includes('locked for audit integrity')),
    'AUDIT GUARD: Prohibits editing quotation once dispatched/sent'
  );

  // Transition SENT -> ACCEPTED
  const acceptRes = quoteService.updateQuoteStatus(quoteId, 'ACCEPTED');
  assert(acceptRes.success && acceptRes.data?.status === 'ACCEPTED', 'TRANSITION: Quote marked as ACCEPTED');

  // -------------------------------------------------------------
  // TEST SCENARIO 3: QUOTE DUPLICATION
  // -------------------------------------------------------------
  console.log('\n🔹 [3/4] Testing Quote Duplication (Cloning)...');

  const dupRes = quoteService.duplicateQuote(quoteId);
  assert(dupRes.success && !!dupRes.data, 'DUPLICATE: Clones quotation into new proposal');
  const dupQuote = dupRes.data!;
  assert(dupQuote.id !== quoteId, 'DUPLICATE: Generates new unique quotation ID');
  assert(dupQuote.quote_number !== quoteNum, 'DUPLICATE: Allocates brand new sequential quote number');
  assert(dupQuote.status === 'DRAFT', 'DUPLICATE: Cloned quote resets to DRAFT status');
  assert(dupQuote.items.length === 2, 'DUPLICATE: Preserves all line items');
  assert(dupQuote.grand_total === 57750, 'DUPLICATE: Preserves exact monetary pricing');

  // -------------------------------------------------------------
  // TEST SCENARIO 4: CONVERT QUOTE TO TAX INVOICE
  // -------------------------------------------------------------
  console.log('\n🔹 [4/4] Testing Quote-to-Invoice Conversion Protocol...');

  // Convert ACCEPTED quote to Tax Invoice
  const convertRes = quoteService.convertQuoteToInvoice(quoteId);
  assert(convertRes.success && !!convertRes.data, 'CONVERT: Successfully converts quotation to invoice');
  const createdInvoice = convertRes.data!;

  // 4.1 Preserve Original Quote Reference
  assert(
    createdInvoice.originating_quote_id === quoteId,
    'CONVERT REF: Originating quote ID preserved on invoice'
  );
  assert(
    createdInvoice.originating_quote_number === quoteNum,
    'CONVERT REF: Originating quote number preserved on invoice'
  );

  // 4.2 Copy Customer Information
  assert(
    createdInvoice.customer_id === testCustomer.id,
    'CONVERT CUSTOMER: Customer ID matches'
  );
  assert(
    createdInvoice.customer_snapshot.company_name === testCustomer.company_name,
    'CONVERT CUSTOMER: Customer legal snapshot copied'
  );

  // 4.3 Copy Line Items, Quantities, Prices, and VAT
  assert(
    createdInvoice.items.length === 2,
    'CONVERT ITEMS: Both line items copied'
  );
  assert(
    createdInvoice.items[0].unit_price === 45000 && createdInvoice.items[0].vat_rate_percentage === 5,
    'CONVERT ITEMS: Item 1 unit price (45,000) and VAT (5%) copied accurately'
  );
  assert(
    createdInvoice.items[1].quantity === 5 && createdInvoice.items[1].unit_price === 2000,
    'CONVERT ITEMS: Item 2 quantity (5) and unit price (2,000) copied accurately'
  );

  // 4.4 Recalculate Totals Safely
  assert(
    createdInvoice.subtotal_net === 55000,
    'CONVERT TOTALS: Invoice net subtotal is 55,000 AED'
  );
  assert(
    createdInvoice.vat_total === 2750,
    'CONVERT TOTALS: Invoice VAT total is 2,750 AED (5%)'
  );
  assert(
    createdInvoice.grand_total === 57750,
    'CONVERT TOTALS: Invoice grand total is 57,750 AED'
  );
  assert(
    createdInvoice.balance_due === 57750,
    'CONVERT TOTALS: Invoice initial balance due matches grand total'
  );

  // 4.5 Original Quote Verification (Unchanged & Linked)
  const originalQuoteAfter = quoteService.getQuoteById(quoteId)!;
  assert(
    originalQuoteAfter.status === 'CONVERTED',
    'CONVERT ORIGINAL: Quote status transitioned to CONVERTED'
  );
  assert(
    originalQuoteAfter.converted_invoice_id === createdInvoice.id,
    'CONVERT ORIGINAL: Quote links to created Tax Invoice ID'
  );
  assert(
    originalQuoteAfter.items.length === 2 && originalQuoteAfter.grand_total === 57750,
    'CONVERT ORIGINAL: Original quote line items and totals remain completely intact and uncorrupted'
  );

  // 4.6 Idempotency: Re-converting returns existing invoice
  const reConvertRes = quoteService.convertQuoteToInvoice(quoteId);
  assert(
    reConvertRes.data?.id === createdInvoice.id,
    'CONVERT IDEMPOTENCY: Re-converting returns existing invoice without generating duplicates'
  );

  // 4.7 Guard: Cannot delete converted quote
  const delConverted = quoteService.deleteQuote(quoteId);
  assert(
    Boolean(!delConverted.success && delConverted.error?.includes('official UAE Tax Invoice')),
    'DELETE GUARD: Prevents deleting converted quote'
  );

  // Summary
  console.log('\n===============================================================');
  console.log(`📊 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('===============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runQuoteTestSuite();
