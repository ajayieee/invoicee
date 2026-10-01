import mongoose, { Schema, Document } from 'mongoose';
import { VatTreatment } from './VatRate.js';

export interface IProduct extends Document {
  organizationId: string;
  name: string;
  sku?: string;
  description?: string;
  unitPrice: number;
  unit: string;
  vatRateId?: mongoose.Types.ObjectId;
  vatTreatment: VatTreatment;
  isActive: boolean;
}

const ProductSchema = new Schema<IProduct>(
  {
    organizationId: { type: String, required: true, default: 'org_pixelflames_001' },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    description: String,
    unitPrice: { type: Number, required: true, min: 0 },
    unit: { type: String, default: 'Unit' },
    vatRateId: { type: Schema.Types.ObjectId, ref: 'VatRate' },
    vatTreatment: {
      type: String,
      enum: ['STANDARD_RATED', 'ZERO_RATED', 'EXEMPT', 'OUT_OF_SCOPE', 'REVERSE_CHARGE'],
      default: 'STANDARD_RATED',
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ProductSchema.index({ name: 'text', sku: 'text' });

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
