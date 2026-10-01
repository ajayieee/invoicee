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
exports.CreditNote = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const CreditNoteItemSchema = new mongoose_1.Schema({
    invoiceItemId: String,
    productId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Product' },
    itemOrder: { type: Number, required: true },
    description: { type: String, required: true },
    originalInvoicedQuantity: { type: Number, required: true },
    originalUnitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    unit: { type: String, default: 'Unit' },
    subtotalNet: { type: Number, required: true },
    vatRatePercentage: { type: Number, default: 5.0 },
    vatAmount: { type: Number, required: true },
    totalGross: { type: Number, required: true },
    adjustmentType: { type: String, enum: ['LINE', 'QUANTITY', 'AMOUNT'], default: 'LINE' },
});
const CreditNoteSchema = new mongoose_1.Schema({
    organizationId: { type: String, required: true, default: 'org_pixelflames_001' },
    invoiceId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    invoiceNumber: { type: String, required: true },
    invoiceDate: { type: String, required: true },
    creditNoteNumber: { type: String, required: true, unique: true, index: true },
    sequenceNumber: { type: Number, required: true },
    creditNoteDate: { type: String, required: true },
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    customerSnapshot: {
        companyName: String,
        contactPerson: { type: String, required: true },
        trn: String,
        billingAddressLine1: String,
        billingCity: String,
        billingEmirate: String,
    },
    reason: { type: String, required: true },
    reasonCode: {
        type: String,
        enum: ['RE_CORRECTION', 'RE_RETURN', 'RE_DISCOUNT', 'RE_PRICE_REDUCTION', 'RE_CANCELLATION', 'RE_DEFECT', 'RE_OTHER'],
        default: 'RE_OTHER',
    },
    creditType: {
        type: String,
        enum: ['FULL', 'PARTIAL', 'LINE_SELECTION', 'QUANTITY_ADJUSTMENT', 'AMOUNT_ADJUSTMENT'],
        default: 'PARTIAL',
    },
    items: [CreditNoteItemSchema],
    subtotalNet: { type: Number, required: true },
    vatTotal: { type: Number, required: true },
    grandTotal: { type: Number, required: true },
    remainingBalance: { type: Number, default: 0 },
    refundStatus: {
        type: String,
        enum: ['APPLIED_TO_INVOICE', 'REFUNDED_CASH', 'REFUNDED_BANK', 'CREDIT_ON_ACCOUNT', 'PENDING'],
        default: 'APPLIED_TO_INVOICE',
    },
    status: {
        type: String,
        enum: ['DRAFT', 'ISSUED', 'APPLIED', 'REFUNDED', 'CANCELLED'],
        default: 'ISSUED',
        index: true,
    },
    currency: { type: String, default: 'AED' },
    eInvoiceStatus: { type: String, default: 'NOT_APPLICABLE' },
    eInvoiceUuid: String,
    qrCode: String,
    documentHash: String,
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
CreditNoteSchema.index({ creditNoteNumber: 'text', invoiceNumber: 'text', 'customerSnapshot.companyName': 'text' });
exports.CreditNote = mongoose_1.default.model('CreditNote', CreditNoteSchema);
