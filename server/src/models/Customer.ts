import mongoose, { Schema, Document } from 'mongoose';

export type CustomerType = 'COMPANY' | 'INDIVIDUAL';
export type CustomerRelation = 'CUSTOMER' | 'LEAD' | 'VENDOR';
export type UAEEmirate =
  | 'ABU_DHABI'
  | 'DUBAI'
  | 'SHARJAH'
  | 'AJMAN'
  | 'UMM_AL_QUWAIN'
  | 'RAS_AL_KHAIMAH'
  | 'FUJAIRAH';

export interface ICustomer extends Document {
  organizationId: string;
  customerType: CustomerType;
  relationType: CustomerRelation;
  companyName?: string;
  contactPerson: string;
  email?: string;
  phone?: string;
  mobile?: string;
  trn?: string;
  billingEmirate: UAEEmirate;
  billingAddressLine1?: string;
  billingAddressLine2?: string;
  billingCity: string;
  billingPoBox?: string;
  paymentTermsDays: number;
  currency: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    organizationId: { type: String, required: true, default: 'org_pixelflames_001' },
    customerType: { type: String, enum: ['COMPANY', 'INDIVIDUAL'], default: 'COMPANY' },
    relationType: { type: String, enum: ['CUSTOMER', 'LEAD', 'VENDOR'], default: 'CUSTOMER' },
    companyName: { type: String, trim: true },
    contactPerson: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    mobile: { type: String, trim: true },
    trn: { type: String, trim: true },
    billingEmirate: {
      type: String,
      enum: [
        'ABU_DHABI',
        'DUBAI',
        'SHARJAH',
        'AJMAN',
        'UMM_AL_QUWAIN',
        'RAS_AL_KHAIMAH',
        'FUJAIRAH',
      ],
      default: 'DUBAI',
    },
    billingAddressLine1: String,
    billingAddressLine2: String,
    billingCity: { type: String, default: 'Dubai' },
    billingPoBox: String,
    paymentTermsDays: { type: Number, default: 30 },
    currency: { type: String, default: 'AED' },
    notes: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CustomerSchema.index({ companyName: 'text', contactPerson: 'text', trn: 'text', email: 'text' });

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);
