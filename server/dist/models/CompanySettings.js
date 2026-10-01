"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanySettings = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const BankAccountSchema = new mongoose_1.Schema({
    bankName: { type: String, required: true },
    accountName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    iban: { type: String, required: true },
    swiftBic: { type: String, required: true },
    currency: { type: String, default: 'AED' },
    isPrimary: { type: Boolean, default: false },
});
const AddressSchema = new mongoose_1.Schema({
    building: String,
    street: String,
    area: String,
    city: { type: String, default: 'Dubai' },
    emirate: { type: String, default: 'DUBAI' },
    poBox: String,
    country: { type: String, default: 'United Arab Emirates' },
});
const CompanySettingsSchema = new mongoose_1.Schema({
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
}, { timestamps: true });
exports.CompanySettings = mongoose_1.default.model('CompanySettings', CompanySettingsSchema);
