export interface EInvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  vatRate: number;
  vatAmount: number;
  total: number;
}

export interface EInvoiceSubmissionPayload {
  invoiceId: string;
  invoiceNumber: string;
  issueDate: string;
  supplyDate: string;
  supplierTrn: string;
  customerTrn?: string;
  subtotal: number;
  vatTotal: number;
  grandTotal: number;
  currency: string;
  lineItems: EInvoiceLineItem[];
}

export interface EInvoiceSubmissionResponse {
  success: boolean;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  uuid: string;
  hash: string;
  qrCodeData?: string;
  errors?: string[];
  rawResponse?: Record<string, unknown>;
}

export interface EInvoiceProvider {
  readonly providerName: string;
  submitInvoice(payload: EInvoiceSubmissionPayload): Promise<EInvoiceSubmissionResponse>;
  submitCreditNote(payload: EInvoiceSubmissionPayload): Promise<EInvoiceSubmissionResponse>;
  getStatus(documentUuid: string): Promise<EInvoiceSubmissionResponse>;
  cancelDocument(documentUuid: string, reason: string): Promise<{ success: boolean; message: string }>;
}
