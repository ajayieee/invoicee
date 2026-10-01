import mongoose, { Schema, Document } from 'mongoose';
import { VatTreatment } from './VatRate.js';

export type InvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED';

export type EInvoiceStatus =
  | 'NOT_APPLICABLE'
  | 'PENDING'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED';

export interface IInvoiceLineItem {
  productId?: mongoose.Types.ObjectId;
  itemOrder: number;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  discountAmount: number;
  subtotalNet: number;
  vatRatePercentage: number;
  vatTreatment: VatTreatment;
  vatAmount: number;
  totalGross: number;
}

export interface IInvoice extends Document {
  organizationId: string;
  customerId: mongoose.Types.ObjectId;
  quoteId?: mongoose.Types.ObjectId;
  invoiceNumber: string;
  sequenceNumber: number;
  invoiceDate: string;
  supplyDate: string;
  dueDate: string;
  paymentTermsDays: number;
  customerSnapshot: {
    companyName?: string;
    contactPerson: string;
    email?: string;
    phone?: string;
    trn?: string;
    billingAddressLine1?: string;
    billingCity?: string;
    billingEmirate?: string;
    billingCountry?: string;
  };
  items: IInvoiceLineItem[];
  subtotalNet: number;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  discountAmount: number;
  vatTotal: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  status: InvoiceStatus;
  currency: string;
  exchangeRate: number;
  referenceNumber?: string;
  poNumber?: string;
  notes?: string;
  terms?: string;
  cancellationReason?: string;
  cancelledAt?: Date;
  eInvoiceStatus: EInvoiceStatus;
  eInvoiceUuid?: string;
  qrCode?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceLineItemSchema = new Schema<IInvoiceLineItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product' },
  itemOrder: { type: Number, required: true },
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0.0001 },
  unit: { type: String, default: 'Unit' },
  unitPrice: { type: Number, required: true, min: 0 },
  discountType: { type: String, enum: ['PERCENTAGE', 'FIXED_AMOUNT'], default: 'PERCENTAGE' },
  discountValue: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  subtotalNet: { type: Number, required: true },
  vatRatePercentage: { type: Number, default: 5.0 },
  vatTreatment: {
    type: String,
    enum: ['STANDARD_RATED', 'ZERO_RATED', 'EXEMPT', 'OUT_OF_SCOPE', 'REVERSE_CHARGE'],
    default: 'STANDARD_RATED',
  },
  vatAmount: { type: Number, required: true },
  totalGross: { type: Number, required: true },
});

const InvoiceSchema = new Schema<IInvoice>(
  {
    organizationId: { type: String, required: true, default: 'org_pixelflames_001' },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    quoteId: { type: Schema.Types.ObjectId, ref: 'Quote' },
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    sequenceNumber: { type: Number, required: true, index: true },
    invoiceDate: { type: String, required: true },
    supplyDate: { type: String, required: true },
    dueDate: { type: String, required: true },
    paymentTermsDays: { type: Number, default: 30 },
    customerSnapshot: {
      companyName: String,
      contactPerson: { type: String, required: true },
      email: String,
      phone: String,
      trn: String,
      billingAddressLine1: String,
      billingCity: String,
      billingEmirate: String,
      billingCountry: { type: String, default: 'United Arab Emirates' },
    },
    items: [InvoiceLineItemSchema],
    subtotalNet: { type: Number, required: true },
    discountType: { type: String, enum: ['PERCENTAGE', 'FIXED_AMOUNT'], default: 'PERCENTAGE' },
    discountValue: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    vatTotal: { type: Number, required: true },
    grandTotal: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, required: true },
    status: {
      type: String,
      enum: ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },
    currency: { type: String, default: 'AED' },
    exchangeRate: { type: Number, default: 1.0 },
    referenceNumber: String,
    poNumber: String,
    notes: String,
    terms: String,
    cancellationReason: String,
    cancelledAt: Date,
    eInvoiceStatus: {
      type: String,
      enum: ['NOT_APPLICABLE', 'PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'CANCELLED'],
      default: 'NOT_APPLICABLE',
    },
    eInvoiceUuid: String,
    qrCode: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

InvoiceSchema.index({ invoiceNumber: 'text', 'customerSnapshot.companyName': 'text', 'customerSnapshot.trn': 'text', referenceNumber: 'text', poNumber: 'text' });

export const Invoice = mongoose.model<IInvoice>('Invoice', InvoiceSchema);
