import {
  CompanySettings,
  VatRate,
  PaymentMethod,
  ProductCategory,
  Product,
  Customer,
  Quote,
  Invoice,
  Payment,
  CreditNote,
  AuditLog,
} from '@/types/database';

export const INITIAL_COMPANY_SETTINGS: CompanySettings = {
  id: 'org-sett-001',
  organization_id: 'org_pixelflames_001',
  legal_company_name: 'Pixelflames',
  trading_name: 'Pixelflames',
  trn: '100000000000003',
  tax_registration_date: '2018-01-01',
  address_line_1: 'Dubai',
  city: 'Dubai',
  emirate: 'DUBAI',
  country: 'United Arab Emirates',
  email: 'ajay@pixelflames.com',
  phone: '+971 4 000 0000',
  default_currency: 'AED',
  default_vat_rate: 5,
  invoice_prefix: 'INV',
  quote_prefix: 'QUO',
  credit_note_prefix: 'CN',
  payment_prefix: 'PAY',
  default_payment_terms_days: 30,
  invoice_footer_notes: 'Thank you for your business. Registered under UAE VAT Law.',
  terms_and_conditions: 'Payment is due within payment terms. Invoices subject to UAE Federal Decree-Law No. (8) of 2017.',
  created_at: new Date('2026-01-01').toISOString(),
  updated_at: new Date('2026-01-01').toISOString(),
};

export const INITIAL_VAT_RATES: VatRate[] = [
  {
    id: 'vat-001',
    organization_id: 'org_pixelflames_001',
    code: 'STANDARD_5',
    name: 'Standard Rated (5%)',
    rate_percentage: 5.0,
    treatment: 'STANDARD_RATED',
    is_active: true,
    is_default: true,
  },
  {
    id: 'vat-002',
    organization_id: 'org_pixelflames_001',
    code: 'ZERO_0',
    name: 'Zero Rated (0%)',
    rate_percentage: 0.0,
    treatment: 'ZERO_RATED',
    is_active: true,
    is_default: false,
  },
  {
    id: 'vat-003',
    organization_id: 'org_pixelflames_001',
    code: 'EXEMPT_0',
    name: 'Exempt (0%)',
    rate_percentage: 0.0,
    treatment: 'EXEMPT',
    is_active: true,
    is_default: false,
  },
  {
    id: 'vat-004',
    organization_id: 'org_pixelflames_001',
    code: 'OUT_OF_SCOPE',
    name: 'Out of Scope (0%)',
    rate_percentage: 0.0,
    treatment: 'OUT_OF_SCOPE',
    is_active: true,
    is_default: false,
  },
];

export const INITIAL_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'pm-001', organization_id: 'org_pixelflames_001', name: 'Bank Transfer (EFT)', code: 'BANK_TRANSFER', is_active: true },
  { id: 'pm-002', organization_id: 'org_pixelflames_001', name: 'Cheque', code: 'CHEQUE', is_active: true },
  { id: 'pm-003', organization_id: 'org_pixelflames_001', name: 'Credit Card', code: 'CREDIT_CARD', is_active: true },
  { id: 'pm-004', organization_id: 'org_pixelflames_001', name: 'Debit Card', code: 'DEBIT_CARD', is_active: true },
  { id: 'pm-005', organization_id: 'org_pixelflames_001', name: 'Cash', code: 'CASH', is_active: true },
  { id: 'pm-006', organization_id: 'org_pixelflames_001', name: 'Other', code: 'OTHER', is_active: true },
];

export const INITIAL_CATEGORIES: ProductCategory[] = [];
export const INITIAL_PRODUCTS: Product[] = [];
export const INITIAL_CUSTOMERS: Customer[] = [];
export const INITIAL_QUOTES: Quote[] = [];
export const INITIAL_INVOICES: Invoice[] = [];
export const INITIAL_PAYMENTS: Payment[] = [];
export const INITIAL_CREDIT_NOTES: CreditNote[] = [];
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];
