import mongoose, { Schema, Document } from 'mongoose';
import { VatTreatment } from './VatRate.js';

export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED';

export interface IQuoteLineItem {
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

export interface IQuote extends Document {
  organizationId: string;
  customerId: mongoose.Types.ObjectId;
  quoteNumber: string;
  sequenceNumber: number;
  quoteDate: string;
  validUntil: string;
  customerSnapshot: {
    companyName?: string;
    contactPerson: string;
    email?: string;
    phone?: string;
    trn?: string;
    billingAddressLine1?: string;
    billingCity?: string;
    billingEmirate?: string;
  };
  items: IQuoteLineItem[];
  subtotalNet: number;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  discountAmount: number;
  vatTotal: number;
  grandTotal: number;
  status: QuoteStatus;
  currency: string;
  referenceNumber?: string;
  notes?: string;
  terms?: string;
  convertedInvoiceId?: mongoose.Types.ObjectId;
  convertedInvoiceNumber?: string;
  convertedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const QuoteLineItemSchema = new Schema<IQuoteLineItem>({
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

const QuoteSchema = new Schema<IQuote>(
  {
    organizationId: { type: String, required: true, default: 'org_pixelflames_001' },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    quoteNumber: { type: String, required: true, unique: true, index: true },
    sequenceNumber: { type: Number, required: true },
    quoteDate: { type: String, required: true },
    validUntil: { type: String, required: true },
    customerSnapshot: {
      companyName: String,
      contactPerson: { type: String, required: true },
      email: String,
      phone: String,
      trn: String,
      billingAddressLine1: String,
      billingCity: String,
      billingEmirate: String,
    },
    items: [QuoteLineItemSchema],
    subtotalNet: { type: Number, required: true },
    discountType: { type: String, enum: ['PERCENTAGE', 'FIXED_AMOUNT'], default: 'PERCENTAGE' },
    discountValue: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    vatTotal: { type: Number, required: true },
    grandTotal: { type: Number, required: true },
    status: {
      type: String,
      enum: ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'],
      default: 'DRAFT',
      index: true,
    },
    currency: { type: String, default: 'AED' },
    referenceNumber: String,
    notes: String,
    terms: String,
    convertedInvoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    convertedInvoiceNumber: String,
    convertedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

QuoteSchema.index({ quoteNumber: 'text', 'customerSnapshot.companyName': 'text', referenceNumber: 'text' });

export const Quote = mongoose.model<IQuote>('Quote', QuoteSchema);
