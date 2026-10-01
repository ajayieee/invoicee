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
exports.Invoice = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const InvoiceLineItemSchema = new mongoose_1.Schema({
    productId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Product' },
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
const InvoiceSchema = new mongoose_1.Schema({
    organizationId: { type: String, required: true, default: 'org_pixelflames_001' },
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Customer', required: true },
    quoteId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Quote' },
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
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
InvoiceSchema.index({ invoiceNumber: 'text', 'customerSnapshot.companyName': 'text', 'customerSnapshot.trn': 'text', referenceNumber: 'text', poNumber: 'text' });
exports.Invoice = mongoose_1.default.model('Invoice', InvoiceSchema);
