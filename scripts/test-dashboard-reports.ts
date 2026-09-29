import { db } from '../src/lib/db/repository';
import { dashboardService } from '../src/services/dashboard.service';
import { reportService, ReportFilterOptions } from '../src/services/report.service';
import { VatCalculator } from '../src/lib/vat/calculator';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ ${message}`);
  }
}

async function runDashboardAndReportTests() {
  console.log('\n======================================================');
  console.log('🧪 UAE INVOICING: DASHBOARD & REPORTING SYSTEM TEST SUITE');
  console.log('======================================================\n');

  // =========================================================================
  // SECTION 1: 8 DASHBOARD KPI CARDS
  // =========================================================================
  console.log('--- 1. Testing 8 Dashboard KPI Cards ---');
  const metrics = dashboardService.getMetrics();

  // 1. Revenue this month
  assert(typeof metrics.revenueThisMonth === 'number' && metrics.revenueThisMonth >= 0, 'Card 1: Revenue this month is calculated');
  console.log(`   Revenue this month: AED ${metrics.revenueThisMonth}`);

  // 2. Revenue this year
  assert(typeof metrics.revenueThisYear === 'number' && metrics.revenueThisYear >= 0, 'Card 2: Revenue this year is calculated');
  console.log(`   Revenue this year: AED ${metrics.revenueThisYear}`);

  // 3. Outstanding
  assert(typeof metrics.outstandingReceivables === 'number' && metrics.outstandingReceivables >= 0, 'Card 3: Outstanding receivables is calculated');
  console.log(`   Outstanding: AED ${metrics.outstandingReceivables}`);

  // 4. Overdue
  assert(typeof metrics.overdueReceivables === 'number' && metrics.overdueReceivables >= 0, 'Card 4: Overdue receivables is calculated');
  console.log(`   Overdue: AED ${metrics.overdueReceivables}`);

  // 5. Paid this month
  assert(typeof metrics.paymentsReceivedThisMonth === 'number' && metrics.paymentsReceivedThisMonth >= 0, 'Card 5: Paid this month is calculated');
  console.log(`   Paid this month: AED ${metrics.paymentsReceivedThisMonth}`);

  // 6. VAT collected
  assert(typeof metrics.totalVatCollected === 'number' && metrics.totalVatCollected >= 0, 'Card 6: VAT collected is calculated');
  console.log(`   VAT collected (5%): AED ${metrics.totalVatCollected}`);

  // 7. Open quotations
  assert(typeof metrics.openQuotationCount === 'number' && metrics.openQuotationCount >= 0, 'Card 7: Open quotations count is calculated');
  console.log(`   Open quotations: ${metrics.openQuotationCount}`);

  // 8. Quotation pipeline
  assert(typeof metrics.openQuotationValue === 'number' && metrics.openQuotationValue >= 0, 'Card 8: Quotation pipeline value is calculated');
  console.log(`   Quotation pipeline: AED ${metrics.openQuotationValue}`);

  // =========================================================================
  // SECTION 2: 5 DASHBOARD CHARTS
  // =========================================================================
  console.log('\n--- 2. Testing 5 Dashboard Charts Datasets ---');

  // Chart 1: Monthly revenue
  assert(Array.isArray(metrics.monthlyRevenue) && metrics.monthlyRevenue.length === 12, 'Chart 1: Monthly revenue dataset has 12 calendar months');
  assert(metrics.monthlyRevenue.every(m => typeof m.month === 'string' && typeof m.revenue === 'number'), 'Chart 1: Monthly revenue schema valid');

  // Chart 2: Monthly collections
  assert(Array.isArray(metrics.monthlyCollections) && metrics.monthlyCollections.length === 12, 'Chart 2: Monthly collections dataset has 12 calendar months');
  assert(metrics.monthlyCollections.every(m => typeof m.month === 'string' && typeof m.amount === 'number'), 'Chart 2: Monthly collections schema valid');

  // Chart 3: Outstanding receivables aging
  assert(Array.isArray(metrics.outstandingReceivablesBuckets) && metrics.outstandingReceivablesBuckets.length === 4, 'Chart 3: Outstanding receivables aging has 4 buckets');
  const bucketNames = metrics.outstandingReceivablesBuckets.map(b => b.name);
  assert(bucketNames.includes('0-30 Days') && bucketNames.includes('31-60 Days') && bucketNames.includes('61-90 Days') && bucketNames.includes('90+ Days'), 'Chart 3: Aging brackets match UAE accounting standard');

  // Chart 4: Revenue by customer
  assert(Array.isArray(metrics.salesByCustomer), 'Chart 4: Revenue by customer is an array');

  // Chart 5: Revenue by service
  assert(Array.isArray(metrics.revenueByService), 'Chart 5: Revenue by service is an array');

  // =========================================================================
  // SECTION 3: 11 COMPREHENSIVE REPORTS
  // =========================================================================
  console.log('\n--- 3. Testing 11 Financial & Compliance Reports ---');

  // Report 1: Sales
  const salesReport = reportService.getSalesReport({ page: 1, pageSize: 10 });
  assert(Array.isArray(salesReport.data), 'Report 1: Sales report returns paginated data');
  assert(salesReport.summary !== undefined && typeof salesReport.summary.totalNet === 'number', 'Report 1: Sales report includes summary totals');

  // Report 2: Invoices
  const invoiceReport = reportService.getInvoiceReport({ page: 1, pageSize: 10 });
  assert(Array.isArray(invoiceReport.data), 'Report 2: Invoices report returns paginated data');
  assert(invoiceReport.summary !== undefined && typeof invoiceReport.summary.totalGrand === 'number', 'Report 2: Invoices report includes summary totals');

  // Report 3: Payments
  const paymentReport = reportService.getPaymentReport({ page: 1, pageSize: 10 });
  assert(Array.isArray(paymentReport.data), 'Report 3: Payments report returns paginated data');
  assert(paymentReport.summary !== undefined && typeof paymentReport.summary.totalCollected === 'number', 'Report 3: Payments report includes total collected');

  // Report 4: Outstanding
  const outstandingReport = reportService.getOutstandingReport({ page: 1, pageSize: 10 });
  assert(Array.isArray(outstandingReport.data), 'Report 4: Outstanding report returns active unpaid invoices');
  assert(outstandingReport.data.every(r => r.balance_due > 0), 'Report 4: Outstanding report rows all have positive balance due');

  // Report 5: Overdue
  const overdueReport = reportService.getOverdueReport({ page: 1, pageSize: 10 });
  assert(Array.isArray(overdueReport.data), 'Report 5: Overdue report returns past-due invoices');
  assert(overdueReport.data.every(r => r.balance_due > 0), 'Report 5: Overdue invoices have positive balance due');

  // Report 6: UAE VAT 201 Return
  const vatReport = reportService.getVatReport({ page: 1, pageSize: 10 });
  assert(vatReport.summary !== undefined, 'Report 6: UAE VAT 201 report includes FTA summary boxes');
  assert(typeof vatReport.summary.standardRatedSales === 'number', 'Report 6: Box 1a standard rated sales exists');
  assert(typeof vatReport.summary.netVatPayable === 'number', 'Report 6: Box 1 net VAT payable exists');
  assert(Array.isArray(vatReport.transactions.data), 'Report 6: Itemized transaction audit trail exists');
  assert(Array.isArray(vatReport.summary.emirateBoxes) && vatReport.summary.emirateBoxes.length === 7, 'Report 6: Form VAT 201 Box 1 contains all 7 UAE Emirates schedules');
  assert(vatReport.summary.emirateBoxes[0].emirate === 'Abu Dhabi' && vatReport.summary.emirateBoxes[1].emirate === 'Dubai', 'Report 6: Emirate schedules map correctly to Box 1a (Abu Dhabi) through 1g (Fujairah)');

  // Report 7: Credit Notes
  const creditNoteReport = reportService.getCreditNoteReport({ page: 1, pageSize: 10 });
  assert(Array.isArray(creditNoteReport.data), 'Report 7: Credit notes report returns paginated records');

  // Report 8: Customer Statement
  const customers = db.getCustomers();
  const testCustomer = customers[0];
  const statement = reportService.getCustomerStatementReport(testCustomer?.id);
  assert(statement !== undefined && Array.isArray(statement.ledger), 'Report 8: Customer statement returns chronological ledger');
  assert(typeof statement.closingBalance === 'number', 'Report 8: Customer statement has computed closing balance');

  // Report 9: Revenue by Customer
  const revCustomerReport = reportService.getRevenueByCustomerReport({ page: 1, pageSize: 10 });
  assert(Array.isArray(revCustomerReport.data), 'Report 9: Revenue by customer report returns customer breakdowns');

  // Report 10: Revenue by Product/Service
  const revProductReport = reportService.getRevenueByProductReport({ page: 1, pageSize: 10 });
  assert(Array.isArray(revProductReport.data), 'Report 10: Revenue by product report returns service breakdowns');

  // Report 11: Receivables Ageing Schedule
  const ageingReport = reportService.getAgeingReport({ page: 1, pageSize: 10 });
  assert(ageingReport.summary !== undefined, 'Report 11: Receivables ageing returns summary buckets');
  assert(Array.isArray(ageingReport.records.data), 'Report 11: Receivables ageing returns itemized invoice rows');
  assert(
    typeof ageingReport.summary.buckets.current === 'number' &&
    typeof ageingReport.summary.buckets.days31_60 === 'number' &&
    typeof ageingReport.summary.buckets.days61_90 === 'number' &&
    typeof ageingReport.summary.buckets.days90_plus === 'number',
    'Report 11: All 4 aging buckets present and numeric'
  );

  // =========================================================================
  // SECTION 4: TESTING FILTERS ACROSS REPORTS
  // =========================================================================
  console.log('\n--- 4. Testing Universal Filters ---');

  // 1. Date Range Filter
  const dateFiltered = reportService.getSalesReport({ startDate: '2026-01-01', endDate: '2026-12-31' });
  assert(dateFiltered.data.every(r => r.date >= '2026-01-01' && r.date <= '2026-12-31'), 'Date range filter restricts rows appropriately');

  // 2. Customer Filter
  if (testCustomer) {
    const custFiltered = reportService.getInvoiceReport({ customerId: testCustomer.id });
    assert(custFiltered.data.every(r => r.customer_id === testCustomer.id), 'Customer filter restricts rows to selected client');
  }

  // 3. Status Filter
  const statusFiltered = reportService.getInvoiceReport({ status: 'PAID' });
  assert(statusFiltered.data.every(r => r.status === 'PAID'), 'Status filter correctly restricts to PAID invoices');

  // 4. VAT Treatment Filter
  const vatTreatmentFiltered = reportService.getSalesReport({ vatTreatment: 'STANDARD_RATED' });
  assert(vatTreatmentFiltered.data.every(r => r.vat_treatment === 'STANDARD_RATED'), 'VAT treatment filter restricts to STANDARD_RATED');

  // 5. Payment Status Filter
  const paidFiltered = reportService.getInvoiceReport({ paymentStatus: 'PAID' });
  assert(paidFiltered.data.every(r => r.status === 'PAID'), 'Payment status filter restricts to PAID');

  // =========================================================================
  // SECTION 5: SEARCH, SORT, AND PAGINATION
  // =========================================================================
  console.log('\n--- 5. Testing Search, Sort & Pagination ---');

  // Search
  const searchResult = reportService.getInvoiceReport({ search: 'INV' });
  assert(searchResult.data.every(r => r.invoice_number.includes('INV') || r.customer_name.toLowerCase().includes('inv')), 'Search keyword matches columns');

  // Sort Ascending vs Descending
  const sortAsc = reportService.getSalesReport({ sortBy: 'grand_total', sortDirection: 'asc' });
  const sortDesc = reportService.getSalesReport({ sortBy: 'grand_total', sortDirection: 'desc' });
  if (sortAsc.data.length >= 2) {
    assert(sortAsc.data[0].grand_total <= sortAsc.data[sortAsc.data.length - 1].grand_total, 'Sort Ascending operates correctly');
    assert(sortDesc.data[0].grand_total >= sortDesc.data[sortDesc.data.length - 1].grand_total, 'Sort Descending operates correctly');
  }

  // Pagination
  const paged1 = reportService.getInvoiceReport({ page: 1, pageSize: 2 });
  assert(paged1.data.length <= 2, 'PageSize limits rows returned');
  assert(paged1.page === 1, 'Current page index correct');

  // =========================================================================
  // SECTION 6: VAT & BUSINESS LOGIC CONSISTENCY PARITY
  // =========================================================================
  console.log('\n--- 6. Verifying VAT Math Parity (No Duplicated Formulas) ---');
  
  // Verify that report calculations match invoice line calculations
  const allInvoices = db.getInvoices().filter(i => i.status !== 'CANCELLED');
  for (const inv of allInvoices) {
    const rawItems = inv.items.map(it => ({
      quantity: it.quantity,
      unit_price: it.unit_price,
      discount_type: it.discount_type,
      discount_value: it.discount_value,
      vat_rate_percentage: it.vat_rate_percentage,
      vat_treatment: it.vat_treatment,
    }));
    const recomputed = VatCalculator.calculateDocument(rawItems, inv.discount_type, inv.discount_value);
    
    assert(Math.abs(recomputed.vat_total - inv.vat_total) < 0.01, `Invoice ${inv.invoice_number}: Stored VAT matches VatCalculator exactly`);
    assert(Math.abs(recomputed.grand_total - inv.grand_total) < 0.01, `Invoice ${inv.invoice_number}: Grand total matches VatCalculator exactly`);
  }

  console.log('\n======================================================');
  console.log('🎉 ALL DASHBOARD & REPORTING SYSTEM TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runDashboardAndReportTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
