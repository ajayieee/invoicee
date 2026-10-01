import mongoose, { Schema, Document } from 'mongoose';

export type VatTreatment =
  | 'STANDARD_RATED'
  | 'ZERO_RATED'
  | 'EXEMPT'
  | 'OUT_OF_SCOPE'
  | 'REVERSE_CHARGE';

export interface IVatRate extends Document {
  organizationId: string;
  name: string;
  ratePercentage: number;
  treatment: VatTreatment;
  ftaCode: string;
  description?: string;
  isDefault: boolean;
  isActive: boolean;
}

const VatRateSchema = new Schema<IVatRate>(
  {
    organizationId: { type: String, required: true, default: 'org_pixelflames_001' },
    name: { type: String, required: true },
    ratePercentage: { type: Number, required: true },
    treatment: {
      type: String,
      enum: ['STANDARD_RATED', 'ZERO_RATED', 'EXEMPT', 'OUT_OF_SCOPE', 'REVERSE_CHARGE'],
      required: true,
    },
    ftaCode: { type: String, required: true },
    description: String,
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const VatRate = mongoose.model<IVatRate>('VatRate', VatRateSchema);
