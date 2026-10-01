import mongoose, { Schema, Document } from 'mongoose';

export interface IBankAccount {
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban: string;
  swiftBic: string;
  currency: string;
  isPrimary: boolean;
}

export interface ICompanySettings extends Document {
  organizationId: string;
  companyNameEn: string;
  companyNameAr?: string;
  trn: string;
  legalForm: string;
  tradeLicenseNumber: string;
  taxRegistrationDate: string;
  email: string;
  phone: string;
  website?: string;
  addressEn: {
    building?: string;
    street?: string;
    area?: string;
    city: string;
    emirate: string;
    poBox?: string;
    country: string;
  };
  addressAr?: {
    building?: string;
    street?: string;
    area?: string;
    city: string;
    emirate: string;
    poBox?: string;
    country: string;
  };
  bankAccounts: IBankAccount[];
  invoicePrefix: string;
  quotePrefix: string;
  creditNotePrefix: string;
  paymentPrefix: string;
  defaultPaymentTermsDays: number;
  defaultNotes?: string;
  defaultTerms?: string;
  logoUrl?: string;
  taxAgencyName?: string;
  taxAgentName?: string;
  taxAgentApprovalNumber?: string;
  peppolEndpointId?: string;
  currency: string;
}

const BankAccountSchema = new Schema<IBankAccount>({
  bankName: { type: String, required: true },
  accountName: { type: String, required: true },
  accountNumber: { type: String, required: true },
  iban: { type: String, required: true },
  swiftBic: { type: String, required: true },
  currency: { type: String, default: 'AED' },
  isPrimary: { type: Boolean, default: false },
});

const AddressSchema = new Schema({
  building: String,
  street: String,
  area: String,
  city: { type: String, default: 'Dubai' },
  emirate: { type: String, default: 'DUBAI' },
  poBox: String,
  country: { type: String, default: 'United Arab Emirates' },
});

const CompanySettingsSchema = new Schema<ICompanySettings>(
  {
    organizationId: { type: String, required: true, unique: true },
    companyNameEn: { type: String, required: true },
    companyNameAr: String,
    trn: { type: String, required: true },
    legalForm: { type: String, default: 'Limited Liability Company (LLC)' },
    tradeLicenseNumber: { type: String, required: true },
    taxRegistrationDate: { type: String, default: '2018-01-01' },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    website: String,
    addressEn: { type: AddressSchema, required: true },
    addressAr: AddressSchema,
    bankAccounts: [BankAccountSchema],
    invoicePrefix: { type: String, default: 'INV' },
    quotePrefix: { type: String, default: 'QUO' },
    creditNotePrefix: { type: String, default: 'CN' },
    paymentPrefix: { type: String, default: 'PAY' },
    defaultPaymentTermsDays: { type: Number, default: 30 },
    defaultNotes: String,
    defaultTerms: String,
    logoUrl: String,
    taxAgencyName: String,
    taxAgentName: String,
    taxAgentApprovalNumber: String,
    peppolEndpointId: String,
    currency: { type: String, default: 'AED' },
  },
  { timestamps: true }
);

export const CompanySettings = mongoose.model<ICompanySettings>(
  'CompanySettings',
  CompanySettingsSchema
);
