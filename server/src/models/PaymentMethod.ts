import mongoose, { Schema, Document } from 'mongoose';

export type PaymentMethodCode = 'BANK_TRANSFER' | 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CHEQUE' | 'OTHER';

export interface IPaymentMethod extends Document {
  organizationId: string;
  code: PaymentMethodCode;
  name: string;
  description?: string;
  requiresReference: boolean;
  isActive: boolean;
}

const PaymentMethodSchema = new Schema<IPaymentMethod>(
  {
    organizationId: { type: String, required: true, default: 'org_pixelflames_001' },
    code: {
      type: String,
      enum: ['BANK_TRANSFER', 'CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'CHEQUE', 'OTHER'],
      required: true,
    },
    name: { type: String, required: true },
    description: String,
    requiresReference: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const PaymentMethod = mongoose.model<IPaymentMethod>('PaymentMethod', PaymentMethodSchema);
