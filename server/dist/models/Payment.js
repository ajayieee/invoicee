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
exports.Payment = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const PaymentSchema = new mongoose_1.Schema({
    organizationId: { type: String, required: true, default: 'org_pixelflames_001' },
    invoiceId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    invoiceNumber: { type: String, required: true },
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    customerName: { type: String, required: true },
    paymentNumber: { type: String, required: true, unique: true, index: true },
    sequenceNumber: { type: Number, required: true },
    paymentDate: { type: String, required: true },
    paymentMethodId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'PaymentMethod', required: true },
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
    reversedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
PaymentSchema.index({ paymentNumber: 'text', invoiceNumber: 'text', customerName: 'text', referenceNumber: 'text' });
exports.Payment = mongoose_1.default.model('Payment', PaymentSchema);
