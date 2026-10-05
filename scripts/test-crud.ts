import { authService, SYSTEM_USERS } from '../src/services/auth.service';
import { companyService } from '../src/services/company.service';
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

async function runTestSuite() {
  console.log('\n===============================================================');
  console.log('🚀 RUNNING APPLICATION FOUNDATION & CRUD TEST SUITE');
  console.log('===============================================================\n');

  // Reset to known state before testing
  db.resetToDefault();

  // -------------------------------------------------------------
  // TEST SUITE 1: AUTHENTICATION & ROLE-BASED ACCESS CONTROL
  // -------------------------------------------------------------
  console.log('🔹 [1/5] Testing Authentication & RBAC Layer...');

  const currentUser = authService.getCurrentUser();
  assert(currentUser.role === 'OWNER', 'Initial default user is OWNER (Tariq Mansour)');
  assert(authService.hasPermission('canEditCompanySettings'), 'OWNER has canEditCompanySettings');
  assert(authService.hasPermission('canCreateInvoice'), 'OWNER has canCreateInvoice');

  // Check SALES role permissions
  assert(
    !authService.hasPermission('canEditCompanySettings', 'SALES'),
    'SALES user cannot edit company settings'
  );
  assert(
    !authService.hasPermission('canRecordPayment', 'SALES'),
    'SALES user cannot record payments'
  );
  assert(
    authService.hasPermission('canApproveQuote', 'SALES'),
    'SALES user can approve quotes'
  );

  // Check ACCOUNTANT role permissions
  assert(
    authService.hasPermission('canRecordPayment', 'ACCOUNTANT'),
    'ACCOUNTANT can record payments'
  );
  assert(
    authService.hasPermission('canIssueCreditNote', 'ACCOUNTANT'),
    'ACCOUNTANT can issue credit notes'
  );

  // -------------------------------------------------------------
  // TEST SUITE 2: COMPANY SETTINGS & STRICT UAE VALIDATION
  // -------------------------------------------------------------
  console.log('\n🔹 [2/5] Testing Company Settings & UAE Tax Validation...');

  const initialSettings = companyService.getSettings();
  assert(initialSettings.trn === '100284759600003', 'Initial company TRN is seeded accurately');

  // Validation: Invalid TRN (only 12 digits)
  const invalidTrnResult = companyService.validateSettings({ trn: '100123456789' });
  assert(
    !!invalidTrnResult.trn,
    'Rejects non-15-digit TRN with clear validation error'
  );

  // Validation: TRN not starting with 100
  const invalidPrefixTrn = companyService.validateSettings({ trn: '200123456789003' });
  assert(
    !!invalidPrefixTrn.trn,
    'Rejects TRN that does not start with UAE FTA prefix 100'
  );

  // Validation: Invalid IBAN
  const invalidIban = companyService.validateSettings({ bank_iban: 'GB290330000000000000000' });
  assert(
    !!invalidIban.bank_iban,
    'Rejects non-UAE IBAN with clear validation error'
  );

  // Successful update
  const updateRes = companyService.updateSettings({
    trading_name: 'Al Thuraya Cloud ERP Solutions',
    phone: '+971 4 888 9999',
    invoice_footer_notes: 'Standard 5% UAE VAT applies under FTA regulation.',
  });
  assert(updateRes.success, 'Updates company settings successfully');
  assert(
    companyService.getSettings().trading_name === 'Al Thuraya Cloud ERP Solutions',
    'Updated company trading name persists in repository'
  );

  const auditLogs = companyService.getAuditTrail();
  assert(
    auditLogs.some((l) => l.entity_type === 'COMPANY_SETTINGS'),
    'Settings update creates an immutable audit trail entry'
  );

  // -------------------------------------------------------------
  // TEST SUITE 3: CUSTOMER MANAGEMENT CRUD & ACCOUNTING GUARDS
  // -------------------------------------------------------------
  console.log('\n🔹 [3/5] Testing Customer Management CRUD & Validation...');

  // Validation: Corporate client missing legal company name
  const custMissingCompany = customerService.validateCustomer({
    customer_type: 'COMPANY',
    relation_type: 'CUSTOMER',
    contact_person: 'Ahmed Ali',
    company_name: '',
  });
  assert(
    !!custMissingCompany.company_name,
    'Validation requires company name for corporate entities'
  );

  // Validation: Invalid TRN
  const custBadTrn = customerService.validateCustomer({
    contact_person: 'Ahmed Ali',
    trn: '99999',
  });
  assert(
    !!custBadTrn.trn,
    'Validation enforces 15-digit TRN for customer entities'
  );

  // CREATE: New corporate customer
  const createCustRes = await customerService.createCustomer({
    customer_type: 'COMPANY',
    relation_type: 'CUSTOMER',
    company_name: 'Emaar Hospitality Group PJSC',
    contact_person: 'Rashid Al-Maktoum',
    email: 'finance@emaar.ae',
    phone: '+971 4 367 3333',
    trn: '100392847500003',
    billing_emirate: 'DUBAI',
    billing_address_line_1: 'Downtown Dubai, Boulevard Plaza Tower 1',
    billing_city: 'Dubai',
    payment_terms_days: 60,
  });
  assert(createCustRes.success && !!createCustRes.data, 'CREATE: Corporate customer registered successfully');
  const newCustId = createCustRes.data!.id;

  // CREATE: Sales prospect lead
  const createProspectRes = await customerService.createCustomer({
    customer_type: 'INDIVIDUAL',
    relation_type: 'PROSPECT',
    contact_person: 'Mansoor Al-Zaabi',
    email: 'mansoor.zaabi@gmail.com',
    mobile: '+971 50 998 7766',
    billing_emirate: 'ABU_DHABI',
    payment_terms_days: 15,
  });
  assert(createProspectRes.success && !!createProspectRes.data, 'CREATE: Sales prospect registered successfully');
  const prospectId = createProspectRes.data!.id;

  // READ: Search & Filter
  const searchResults = customerService.getCustomers({ search: 'Emaar' });
  assert(
    searchResults.items.some((c) => c.company_name?.includes('Emaar')),
    'READ: Search locates customer by legal company name'
  );

  const prospectResults = customerService.getCustomers({ relationType: 'PROSPECT' });
  assert(
    prospectResults.items.every((c) => c.relation_type === 'PROSPECT'),
    'READ: Filter isolates sales prospects correctly'
  );

  const emirateResults = customerService.getCustomers({ emirate: 'ABU_DHABI' });
  assert(
    emirateResults.items.every((c) => c.billing_emirate === 'ABU_DHABI'),
    'READ: Filter isolates accounts by UAE Emirate'
  );

  // READ: Customer 360 view
  const c360 = customerService.getCustomer360('cust-001');
  assert(c360 !== null, 'READ: Customer 360 overview loaded');
  assert(c360!.totalInvoiced > 0, 'READ: Customer 360 computes total invoiced gross amount');
  assert(c360!.invoices.length > 0, 'READ: Customer 360 links historical invoices');

  // UPDATE:
  const updateCustRes = await customerService.updateCustomer(newCustId, {
    customer_type: 'COMPANY',
    relation_type: 'CUSTOMER',
    company_name: 'Emaar Hospitality Group PJSC',
    contact_person: 'Rashid Al-Maktoum (VP Finance)',
    email: 'finance.executive@emaar.ae',
    billing_emirate: 'DUBAI',
    payment_terms_days: 90,
  });
  assert(updateCustRes.success, 'UPDATE: Customer contact and payment terms updated');
  assert(
    customerService.getCustomerById(newCustId)?.payment_terms_days === 90,
    'UPDATE: Updated payment terms persist in repository'
  );

  // TOGGLE ACTIVE:
  await customerService.toggleActive(newCustId);
  assert(
    customerService.getCustomerById(newCustId)?.is_active === false,
    'UPDATE: Account deactivated successfully'
  );
  await customerService.toggleActive(newCustId);
  assert(
    customerService.getCustomerById(newCustId)?.is_active === true,
    'UPDATE: Account reactivated successfully'
  );

  // DELETE: Guard against deleting customer with existing invoices
  const delBlocked = await customerService.deleteCustomer('cust-001');
  assert(
    Boolean(!delBlocked.success && delBlocked.error?.includes('financial invoices exist')),
    'DELETE GUARD: Prevents deleting customer with active financial invoices'
  );

  // DELETE: Customer without transactions can be deleted
  const delAllowed = await customerService.deleteCustomer(prospectId);
  assert(
    delAllowed.success,
    'DELETE: Deletes prospect with zero financial transactions cleanly'
  );
  assert(
    customerService.getCustomerById(prospectId) === null,
    'DELETE: Prospect is completely removed from active accounts'
  );

  // -------------------------------------------------------------
  // TEST SUITE 4: PRODUCT/SERVICE CATALOG CRUD & VALIDATION
  // -------------------------------------------------------------
  console.log('\n🔹 [4/5] Testing Product / Service Catalog CRUD & Validation...');

  const vatRates = productService.getVatRates();
  const standardVat = vatRates.find((v) => v.rate_percentage === 5)!;

  // Validation: Missing name
  const prodMissingName = productService.validateProduct({
    name: '',
    unit: 'Unit',
    selling_price: 100,
    vat_rate_id: standardVat.id,
  });
  assert(!!prodMissingName.name, 'Validation requires product/service name');

  // Validation: Negative selling price
  const prodNegPrice = productService.validateProduct({
    name: 'IT Support',
    unit: 'Hours',
    selling_price: -50,
    vat_rate_id: standardVat.id,
  });
  assert(!!prodNegPrice.selling_price, 'Validation rejects negative selling price');

  // Validation: Duplicate SKU check
  const prodDupSku = productService.validateProduct({
    name: 'Duplicate SKU Service',
    sku: 'SRV-ARCH-01', // Already assigned in seed data
    unit: 'Unit',
    selling_price: 1000,
    vat_rate_id: standardVat.id,
  });
  assert(!!prodDupSku.sku, 'Validation prevents duplicate SKU within catalog');

  // CREATE: New billable service with margin
  const createProdRes = productService.createProduct({
    name: 'AI Document Extraction Engine',
    sku: 'SRV-AI-DOC-01',
    description: 'Custom OCR and NLP invoice pipeline for UAE FTA audit logs',
    unit: 'Contract',
    cost_price: 12000,
    selling_price: 28000,
    vat_rate_id: standardVat.id,
  });
  assert(createProdRes.success && !!createProdRes.data, 'CREATE: Product cataloged successfully');
  const newProdId = createProdRes.data!.id;

  // READ: Profit margin calculation
  const prodWithMargin = productService.getProductById(newProdId);
  assert(prodWithMargin !== null, 'READ: Product retrieved by ID');
  assert(
    prodWithMargin!.profitPerUnit === 16000,
    'READ: Profit per unit calculated correctly (28,000 - 12,000 = 16,000)'
  );
  assert(
    prodWithMargin!.profitMarginPercentage === 57.1,
    'READ: Profit margin % computed accurately (57.1%)'
  );

  // READ: Search & Category filter
  const prodSearch = productService.getProducts({ search: 'AI Document' });
  assert(
    prodSearch.items.some((p) => p.name.includes('AI Document')),
    'READ: Search locates product by name keyword'
  );

  // READ: Pagination
  const prodPage1 = productService.getProducts({ pageSize: 3, page: 1 });
  assert(prodPage1.items.length === 3, 'READ: Pagination respects page size limit (3 items)');
  assert(prodPage1.totalPages > 1, 'READ: Pagination calculates total pages correctly');

  // UPDATE:
  const updateProdRes = productService.updateProduct(newProdId, {
    name: 'AI Document Extraction Engine Enterprise',
    sku: 'SRV-AI-DOC-ENT',
    unit: 'Contract',
    cost_price: 15000,
    selling_price: 35000,
    vat_rate_id: standardVat.id,
  });
  assert(updateProdRes.success, 'UPDATE: Product name, SKU, and prices updated');
  const updatedProd = productService.getProductById(newProdId);
  assert(
    updatedProd?.selling_price === 35000 && updatedProd?.sku === 'SRV-AI-DOC-ENT',
    'UPDATE: Updated product pricing and SKU persist in repository'
  );

  // DELETE GUARD: Product referenced in invoices cannot be casually deleted
  const delProdBlocked = productService.deleteProduct('prod-001');
  assert(
    Boolean(!delProdBlocked.success && delProdBlocked.error?.includes('referenced in issued tax invoices')),
    'DELETE GUARD: Prevents deleting product used in issued tax invoices'
  );

  // DELETE: Unreferenced product can be deleted
  const delProdAllowed = productService.deleteProduct(newProdId);
  assert(delProdAllowed.success, 'DELETE: Unreferenced product deleted cleanly');
  assert(
    productService.getProductById(newProdId) === null,
    'DELETE: Deleted product is no longer in catalog'
  );

  // -------------------------------------------------------------
  // TEST SUITE 5: DASHBOARD SHELL & FINANCIAL METRICS AGGREGATION
  // -------------------------------------------------------------
  console.log('\n🔹 [5/5] Testing Dashboard Financial Metrics Aggregator...');

  const metrics = dashboardService.getMetrics();
  assert(metrics.revenueThisYear > 0, 'Aggregates annual gross revenue');
  assert(metrics.outstandingReceivables > 0, 'Aggregates outstanding receivables');
  assert(metrics.totalVatCollected > 0, 'Aggregates FTA standard 5% VAT collected');
  assert(metrics.monthlyRevenue.length === 12, 'Generates 12-month revenue trend data');
  assert(
    dashboardService.getRecentInvoices(5).length > 0,
    'Fetches recent chronological invoices'
  );
  assert(
    dashboardService.getRecentQuotes(5).length > 0,
    'Fetches recent chronological quotations'
  );

  // Summary
  console.log('\n===============================================================');
  console.log(`📊 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('===============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite();
