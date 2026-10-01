import mongoose, { Schema, Document } from 'mongoose';
import { VatTreatment } from './VatRate.js';

export type CreditNoteStatus = 'DRAFT' | 'ISSUED' | 'APPLIED' | 'REFUNDED' | 'CANCELLED';
export type CreditNoteType = 'FULL' | 'PARTIAL' | 'LINE_SELECTION' | 'QUANTITY_ADJUSTMENT' | 'AMOUNT_ADJUSTMENT';
export type RefundStatus = 'APPLIED_TO_INVOICE' | 'REFUNDED_CASH' | 'REFUNDED_BANK' | 'CREDIT_ON_ACCOUNT' | 'PENDING';
export type CreditReasonCode = 'RE_CORRECTION' | 'RE_RETURN' | 'RE_DISCOUNT' | 'RE_PRICE_REDUCTION' | 'RE_CANCELLATION' | 'RE_DEFECT' | 'RE_OTHER';

export interface ICreditNoteItem {
  invoiceItemId?: string;
  productId?: mongoose.Types.ObjectId;
  itemOrder: number;
  description: string;
  originalInvoicedQuantity: number;
  originalUnitPrice: number;
  quantity: number;
  unitPrice: number;
  unit: string;
  subtotalNet: number;
  vatRatePercentage: number;
  vatAmount: number;
  totalGross: number;
  adjustmentType: 'LINE' | 'QUANTITY' | 'AMOUNT';
}

export interface ICreditNote extends Document {
  organizationId: string;
  invoiceId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  invoiceDate: string;
  creditNoteNumber: string;
  sequenceNumber: number;
  creditNoteDate: string;
  customerId: mongoose.Types.ObjectId;
  customerSnapshot: {
    companyName?: string;
    contactPerson: string;
    trn?: string;
    billingAddressLine1?: string;
    billingCity?: string;
    billingEmirate?: string;
  };
  reason: string;
  reasonCode: CreditReasonCode;
  creditType: CreditNoteType;
  items: ICreditNoteItem[];
  subtotalNet: number;
  vatTotal: number;
  grandTotal: number;
  remainingBalance: number;
  refundStatus: RefundStatus;
  status: CreditNoteStatus;
  currency: string;
  eInvoiceStatus: string;
  eInvoiceUuid?: string;
  qrCode?: string;
  documentHash?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CreditNoteItemSchema = new Schema<ICreditNoteItem>({
  invoiceItemId: String,
  productId: { type: Schema.Types.ObjectId, ref: 'Product' },
  itemOrder: { type: Number, required: true },
  description: { type: String, required: true },
  originalInvoicedQuantity: { type: Number, required: true },
  originalUnitPrice: { type: Number, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  unit: { type: String, default: 'Unit' },
  subtotalNet: { type: Number, required: true },
  vatRatePercentage: { type: Number, default: 5.0 },
  vatAmount: { type: Number, required: true },
  totalGross: { type: Number, required: true },
  adjustmentType: { type: String, enum: ['LINE', 'QUANTITY', 'AMOUNT'], default: 'LINE' },
});

const CreditNoteSchema = new Schema<ICreditNote>(
  {
    organizationId: { type: String, required: true, default: 'org_pixelflames_001' },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    invoiceNumber: { type: String, required: true },
    invoiceDate: { type: String, required: true },
    creditNoteNumber: { type: String, required: true, unique: true, index: true },
    sequenceNumber: { type: Number, required: true },
    creditNoteDate: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    customerSnapshot: {
      companyName: String,
      contactPerson: { type: String, required: true },
      trn: String,
      billingAddressLine1: String,
      billingCity: String,
      billingEmirate: String,
    },
    reason: { type: String, required: true },
    reasonCode: {
      type: String,
      enum: ['RE_CORRECTION', 'RE_RETURN', 'RE_DISCOUNT', 'RE_PRICE_REDUCTION', 'RE_CANCELLATION', 'RE_DEFECT', 'RE_OTHER'],
      default: 'RE_OTHER',
    },
    creditType: {
      type: String,
      enum: ['FULL', 'PARTIAL', 'LINE_SELECTION', 'QUANTITY_ADJUSTMENT', 'AMOUNT_ADJUSTMENT'],
      default: 'PARTIAL',
    },
    items: [CreditNoteItemSchema],
    subtotalNet: { type: Number, required: true },
    vatTotal: { type: Number, required: true },
    grandTotal: { type: Number, required: true },
    remainingBalance: { type: Number, default: 0 },
    refundStatus: {
      type: String,
      enum: ['APPLIED_TO_INVOICE', 'REFUNDED_CASH', 'REFUNDED_BANK', 'CREDIT_ON_ACCOUNT', 'PENDING'],
      default: 'APPLIED_TO_INVOICE',
    },
    status: {
      type: String,
      enum: ['DRAFT', 'ISSUED', 'APPLIED', 'REFUNDED', 'CANCELLED'],
      default: 'ISSUED',
      index: true,
    },
    currency: { type: String, default: 'AED' },
    eInvoiceStatus: { type: String, default: 'NOT_APPLICABLE' },
    eInvoiceUuid: String,
    qrCode: String,
    documentHash: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

CreditNoteSchema.index({ creditNoteNumber: 'text', invoiceNumber: 'text', 'customerSnapshot.companyName': 'text' });

export const CreditNote = mongoose.model<ICreditNote>('CreditNote', CreditNoteSchema);
