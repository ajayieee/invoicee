import mongoose, { Schema, Document } from 'mongoose';
import { VatTreatment } from './VatRate.js';

export interface IProduct extends Document {
  organizationId: string;
  name: string;
  sku?: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  unitPrice: number;
  costPrice?: number;
  sellingPrice?: number;
  unit: string;
  vatRateId?: string;
  vatRatePercentage?: number;
  vatTreatment: VatTreatment;
  isActive: boolean;
}

const ProductSchema = new Schema<IProduct>(
  {
    organizationId: { type: String, required: true, default: 'org_pixelflames_001' },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    description: String,
    categoryId: String,
    categoryName: String,
    unitPrice: { type: Number, default: 0, min: 0 },
    costPrice: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: 'Unit' },
    vatRateId: { type: String, default: 'vat-001' },
    vatRatePercentage: { type: Number, default: 5 },
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
