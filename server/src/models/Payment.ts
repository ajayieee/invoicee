import mongoose, { Schema, Document } from 'mongoose';

export type PaymentStatus = 'RECORDED' | 'REVERSED';

export interface IPayment extends Document {
  organizationId: string;
  invoiceId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  paymentNumber: string;
  sequenceNumber: number;
  paymentDate: string;
  paymentMethodId: mongoose.Types.ObjectId;
  paymentMethodName: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  referenceNumber?: string;
  notes?: string;
  paymentProofUrl?: string;
  paymentProofName?: string;
  status: PaymentStatus;
  reversalReason?: string;
  reversedAt?: Date;
  reversedBy?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    organizationId: { type: String, required: true, default: 'org_pixelflames_001' },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    invoiceNumber: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    customerName: { type: String, required: true },
    paymentNumber: { type: String, required: true, unique: true, index: true },
    sequenceNumber: { type: Number, required: true },
    paymentDate: { type: String, required: true },
    paymentMethodId: { type: Schema.Types.ObjectId, ref: 'PaymentMethod', required: true },
    paymentMethodName: { type: String, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, default: 'AED' },
    exchangeRate: { type: Number, default: 1.0 },
    referenceNumber: String,
    notes: String,
    paymentProofUrl: String,
    paymentProofName: String,
    status: {
      type: String,
      enum: ['RECORDED', 'REVERSED'],
      default: 'RECORDED',
      index: true,
    },
    reversalReason: String,
    reversedAt: Date,
    reversedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

PaymentSchema.index({ paymentNumber: 'text', invoiceNumber: 'text', customerName: 'text', referenceNumber: 'text' });

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
