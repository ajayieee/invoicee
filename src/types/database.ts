export type CustomerType = 'COMPANY' | 'INDIVIDUAL';
export type CustomerRelation = 'PROSPECT' | 'CUSTOMER';
export type UAEEmirate = 
  | 'ABU_DHABI' 
  | 'DUBAI' 
  | 'SHARJAH' 
  | 'AJMAN' 
  | 'UMM_AL_QUWAIN' 
  | 'RAS_AL_KHAIMAH' 
  | 'FUJAIRAH';

export type VatTreatment = 
  | 'STANDARD_RATED' // 5%
  | 'ZERO_RATED'     // 0%
  | 'EXEMPT'         // Exempt
  | 'OUT_OF_SCOPE';   // Out of scope

export type QuoteStatus = 
  | 'DRAFT' 
  | 'SENT' 
  | 'ACCEPTED' 
  | 'REJECTED' 
  | 'EXPIRED' 
  | 'CONVERTED';

export type InvoiceStatus = 
  | 'DRAFT' 
  | 'ISSUED' 
  | 'PARTIALLY_PAID' 
  | 'PAID' 
  | 'OVERDUE' 
  | 'CANCELLED';

export type PaymentStatus = 'RECORDED' | 'REVERSED';

export type CreditNoteStatus = 
  | 'DRAFT' 
  | 'ISSUED' 
  | 'APPLIED' 
  | 'REFUNDED' 
  | 'CANCELLED';

export type CreditNoteType = 
  | 'FULL' 
  | 'PARTIAL' 
  | 'LINE_SELECTION' 
  | 'QUANTITY_ADJUSTMENT' 
  | 'AMOUNT_ADJUSTMENT';

export type RefundStatus = 
  | 'APPLIED_TO_INVOICE' 
  | 'REFUNDED_CASH' 
  | 'REFUNDED_BANK' 
  | 'CREDIT_ON_ACCOUNT'
  | 'PENDING';

export type CreditReasonCode = 
  | 'RE_CORRECTION' 
  | 'RE_RETURN' 
  | 'RE_DISCOUNT' 
  | 'RE_PRICE_REDUCTION' 
  | 'RE_CANCELLATION' 
  | 'RE_DEFECT' 
  | 'RE_OTHER';

export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export type EInvoiceStatus = 
  | 'NOT_APPLICABLE' 
  | 'PENDING' 
  | 'SUBMITTED' 
  | 'ACCEPTED' 
  | 'REJECTED' 
  | 'CANCELLED';

export type DocType = 'QUOTE' | 'INVOICE' | 'CREDIT_NOTE' | 'PAYMENT';

export interface CompanySettings {
  id: string;
  organization_id: string;
  legal_company_name: string;
  trading_name?: string;
  trn: string; // 15-digit UAE TRN
  tax_registration_date?: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  emirate: UAEEmirate;
  country: string;
  po_box?: string;
  email: string;
  phone: string;
  mobile?: string;
  website?: string;
  logo_url?: string;
  default_currency: string;
  default_vat_rate: number;
  invoice_prefix: string;
  quote_prefix: string;
  credit_note_prefix: string;
  payment_prefix: string;
  default_payment_terms_days: number;
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_iban?: string;
  bank_swift_bic?: string;
  bank_branch?: string;
  invoice_footer_notes?: string;
  terms_and_conditions?: string;
  created_at: string;
  updated_at: string;
}

export interface VatRate {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  rate_percentage: number;
  treatment: VatTreatment;
  is_active: boolean;
  is_default: boolean;
}

export interface PaymentMethod {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  is_active: boolean;
}

export interface CustomerContact {
  id: string;
  customer_id: string;
  name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  designation?: string;
  is_primary: boolean;
}

export interface Customer {
  id: string;
  organization_id: string;
  customer_type: CustomerType;
  relation_type: CustomerRelation;
  company_name?: string;
  contact_person: string;
  email?: string;
  phone?: string;
  mobile?: string;
  trn?: string;
  billing_address_line_1?: string;
  billing_address_line_2?: string;
  billing_city?: string;
  billing_emirate?: UAEEmirate;
  billing_country?: string;
  billing_po_box?: string;
  shipping_address_line_1?: string;
  shipping_address_line_2?: string;
  shipping_city?: string;
  shipping_emirate?: UAEEmirate;
  shipping_country?: string;
  payment_terms_days: number;
  currency: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  contacts?: CustomerContact[];
}

export interface ProductCategory {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
}

export interface Product {
  id: string;
  organization_id: string;
  category_id?: string;
  category_name?: string;
  name: string;
  sku?: string;
  description?: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  vat_rate_id: string;
  vat_rate_percentage?: number;
  vat_treatment?: VatTreatment;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LineItem {
  id: string;
  product_id?: string;
  item_order: number;
  description: string;
  quantity: number;
  unit_price: number;
  unit: string;
  discount_type?: DiscountType;
  discount_value: number;
  discount_amount: number;
  subtotal_net: number;
  vat_rate_id: string;
  vat_rate_percentage: number;
  vat_treatment?: VatTreatment;
  vat_amount: number;
  total_gross: number;
}

export interface Quote {
  id: string;
  organization_id: string;
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  customer_trn?: string;
  quote_number: string;
  quote_date: string;
  expiry_date: string;
  status: QuoteStatus;
  currency: string;
  exchange_rate: number;
  subtotal_net: number;
  discount_type?: DiscountType;
  discount_value: number;
  discount_amount: number;
  vat_total: number;
  grand_total: number;
  notes?: string;
  terms?: string;
  converted_invoice_id?: string;
  items: LineItem[];
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  organization_id: string;
  customer_id: string;
  originating_quote_id?: string;
  originating_quote_number?: string;
  invoice_number: string;
  reference_number?: string;
  po_number?: string;
  payment_terms_days?: number;
  invoice_date: string;
  supply_date: string;
  due_date: string;
  status: InvoiceStatus;
  currency: string;
  exchange_rate: number;
  subtotal_net: number;
  discount_type?: DiscountType;
  discount_value: number;
  discount_amount: number;
  vat_total: number;
  grand_total: number;
  amount_paid: number;
  balance_due: number;
  
  // Immutability snapshots
  customer_snapshot: Partial<Customer>;
  company_snapshot: Partial<CompanySettings>;
  bank_details_snapshot?: {
    bank_name?: string;
    account_name?: string;
    account_number?: string;
    iban?: string;
    swift_bic?: string;
    branch?: string;
  };

  notes?: string;
  terms?: string;

  cancelled_at?: string;
  cancellation_reason?: string;

  e_invoice_status: EInvoiceStatus;
  e_invoice_uuid?: string;
  e_invoice_hash?: string;
  e_invoice_qr_code?: string;
  e_invoice_submitted_at?: string;

  items: LineItem[];
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  organization_id: string;
  invoice_id: string;
  invoice_number?: string;
  customer_id: string;
  customer_name?: string;
  payment_number: string;
  payment_date: string;
  payment_method_id: string;
  payment_method_name?: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  reference_number?: string;
  notes?: string;
  payment_proof_url?: string;
  payment_proof_name?: string;
  status: PaymentStatus;
  reversed_at?: string;
  reversal_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface CreditNoteItem {
  id: string;
  credit_note_id: string;
  invoice_item_id?: string;
  product_id?: string;
  item_order: number;
  description: string;
  original_invoiced_quantity?: number;
  original_unit_price?: number;
  quantity: number;
  unit_price: number;
  unit: string;
  discount_amount: number;
  subtotal_net: number;
  vat_rate_id: string;
  vat_rate_percentage: number;
  vat_amount: number;
  total_gross: number;
  adjustment_type?: 'FULL' | 'QUANTITY' | 'AMOUNT' | 'LINE';
}

export interface CreditNoteAllocation {
  id: string;
  organization_id: string;
  credit_note_id: string;
  invoice_id?: string;
  amount: number;
  allocation_type: 'INVOICE_OFFSET' | 'CASH_REFUND' | 'BANK_REFUND' | 'CREDIT_ON_ACCOUNT';
  allocated_at: string;
  notes?: string;
}

export interface CreditNote {
  id: string;
  organization_id: string;
  invoice_id: string;
  invoice_number?: string;
  invoice_date?: string;
  original_invoice_total?: number;
  customer_id: string;
  customer_name?: string;
  credit_note_number: string;
  credit_note_date: string;
  status: CreditNoteStatus;
  credit_type: CreditNoteType;
  refund_status: RefundStatus;
  credit_reason_code?: CreditReasonCode;
  reason: string;
  currency: string;
  subtotal_net: number;
  discount_amount: number;
  vat_total: number;
  grand_total: number;
  remaining_balance: number;
  customer_snapshot: Partial<Customer>;
  company_snapshot: Partial<CompanySettings>;
  cancelled_at?: string;
  cancellation_reason?: string;
  refund_processed_at?: string;
  refund_reference?: string;
  // UAE E-Invoice / ASP Integration fields
  e_invoice_status: EInvoiceStatus;
  e_invoice_uuid?: string;
  e_invoice_hash?: string;
  e_invoice_qr_code?: string;
  asp_provider_name?: string;
  asp_submission_id?: string;
  asp_cleared_at?: string;
  items: CreditNoteItem[];
  allocations?: CreditNoteAllocation[];
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  organization_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  performed_by_name: string;
  created_at: string;
}
