"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PM_PRESETS = void 0;
exports.serializePayment = serializePayment;
exports.getPayments = getPayments;
exports.recordPayment = recordPayment;
exports.reversePayment = reversePayment;
const mongoose_1 = __importDefault(require("mongoose"));
const Payment_js_1 = require("../models/Payment.js");
const Invoice_js_1 = require("../models/Invoice.js");
const PaymentMethod_js_1 = require("../models/PaymentMethod.js");
const CompanySettings_js_1 = require("../models/CompanySettings.js");
const AuditLog_js_1 = require("../models/AuditLog.js");
exports.PM_PRESETS = {
    'pm-001': { code: 'BANK_TRANSFER', name: 'Bank Transfer (EFT)' },
    'pm-002': { code: 'CHEQUE', name: 'Cheque' },
    'pm-003': { code: 'CREDIT_CARD', name: 'Credit Card' },
    'pm-004': { code: 'DEBIT_CARD', name: 'Debit Card' },
    'pm-005': { code: 'CASH', name: 'Cash' },
    'pm-006': { code: 'OTHER', name: 'Other' },
};
function serializePayment(doc) {
    if (!doc)
        return null;
    const obj = doc.toObject ? doc.toObject() : doc;
    const id = obj._id ? obj._id.toString() : obj.id;
    return {
        ...obj,
        id,
        _id: id,
        invoice_id: obj.invoiceId ? obj.invoiceId.toString() : obj.invoice_id,
        invoiceId: obj.invoiceId ? obj.invoiceId.toString() : obj.invoice_id,
        invoice_number: obj.invoiceNumber || obj.invoice_number,
        invoiceNumber: obj.invoiceNumber || obj.invoice_number,
        customer_id: obj.customerId ? obj.customerId.toString() : obj.customer_id,
        customerId: obj.customerId ? obj.customerId.toString() : obj.customer_id,
        customer_name: obj.customerName || obj.customer_name,
        customerName: obj.customerName || obj.customer_name,
        payment_number: obj.paymentNumber || obj.payment_number,
        paymentNumber: obj.paymentNumber || obj.payment_number,
        sequence_number: obj.sequenceNumber ?? obj.sequence_number ?? 1,
        sequenceNumber: obj.sequenceNumber ?? obj.sequence_number ?? 1,
        payment_date: obj.paymentDate || obj.payment_date,
        paymentDate: obj.paymentDate || obj.payment_date,
        payment_method_id: obj.paymentMethodId ? obj.paymentMethodId.toString() : obj.payment_method_id,
        paymentMethodId: obj.paymentMethodId ? obj.paymentMethodId.toString() : obj.payment_method_id,
        payment_method_name: obj.paymentMethodName || obj.payment_method_name,
        paymentMethodName: obj.paymentMethodName || obj.payment_method_name,
        amount: Number(obj.amount || 0),
        currency: obj.currency || 'AED',
        reference_number: obj.referenceNumber ?? obj.reference_number ?? '',
        referenceNumber: obj.referenceNumber ?? obj.reference_number ?? '',
        notes: obj.notes || '',
        status: obj.status,
        created_at: obj.createdAt ? new Date(obj.createdAt).toISOString() : new Date().toISOString(),
        updated_at: obj.updatedAt ? new Date(obj.updatedAt).toISOString() : new Date().toISOString(),
    };
}
async function getPayments(req, res) {
    try {
        const { search, status, paymentMethodId, customerId, invoiceId, startDate, endDate, page = '1', pageSize = '10', } = req.query;
        const query = {};
        if (status && status !== 'ALL')
            query.status = status;
        if (paymentMethodId && paymentMethodId !== 'ALL') {
            const pmStr = String(paymentMethodId);
            const preset = exports.PM_PRESETS[pmStr];
            const orClauses = [];
            if (mongoose_1.default.Types.ObjectId.isValid(pmStr)) {
                orClauses.push({ paymentMethodId: new mongoose_1.default.Types.ObjectId(pmStr) });
            }
            if (preset) {
                orClauses.push({ paymentMethodName: preset.name });
            }
            else {
                orClauses.push({ paymentMethodName: pmStr });
            }
            query.$and = query.$and || [];
            query.$and.push({ $or: orClauses });
        }
        if (customerId && customerId !== 'ALL')
            query.customerId = customerId;
        if (invoiceId)
            query.invoiceId = invoiceId;
        if (startDate || endDate) {
            query.paymentDate = {};
            if (startDate)
                query.paymentDate.$gte = startDate;
            if (endDate)
                query.paymentDate.$lte = endDate;
        }
        if (search && typeof search === 'string' && search.trim()) {
            const q = search.trim();
            query.$or = [
                { paymentNumber: { $regex: q, $options: 'i' } },
                { invoiceNumber: { $regex: q, $options: 'i' } },
                { customerName: { $regex: q, $options: 'i' } },
                { referenceNumber: { $regex: q, $options: 'i' } },
                { notes: { $regex: q, $options: 'i' } },
            ];
        }
        const p = Math.max(1, parseInt(page, 10));
        const limit = Math.max(1, Math.min(1000, parseInt(pageSize, 10)));
        const skip = (p - 1) * limit;
        const [rawItems, totalItems] = await Promise.all([
            Payment_js_1.Payment.find(query).sort({ sequenceNumber: -1, createdAt: -1 }).skip(skip).limit(limit),
            Payment_js_1.Payment.countDocuments(query),
        ]);
        const items = rawItems.map(serializePayment);
        const totalPages = Math.ceil(totalItems / limit) || 1;
        res.json({
            success: true,
            items,
            totalItems,
            currentPage: p,
            pageSize: limit,
            totalPages,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
async function recordPayment(req, res) {
    try {
        const body = req.body;
        const invoiceId = body.invoiceId || body.invoice_id;
        const paymentMethodId = body.paymentMethodId || body.payment_method_id;
        const amount = body.amount;
        const paymentDate = body.paymentDate || body.payment_date;
        const referenceNumber = body.referenceNumber || body.reference_number;
        const notes = body.notes;
        const paymentProofUrl = body.paymentProofUrl || body.payment_proof_url;
        const paymentProofName = body.paymentProofName || body.payment_proof_name;
        const allowDuplicate = body.allowDuplicate ?? body.allow_duplicate ?? false;
        const payAmount = Number(amount);
        if (isNaN(payAmount) || payAmount <= 0) {
            res.status(400).json({ success: false, error: 'Payment amount must be greater than zero.' });
            return;
        }
        let invoice = null;
        if (mongoose_1.default.Types.ObjectId.isValid(invoiceId)) {
            invoice = await Invoice_js_1.Invoice.findById(invoiceId);
        }
        if (!invoice && invoiceId) {
            invoice = await Invoice_js_1.Invoice.findOne({
                $or: [{ invoiceNumber: invoiceId }, { referenceNumber: invoiceId }],
            });
        }
        if (!invoice) {
            res.status(404).json({ success: false, error: 'Target tax invoice not found in system.' });
            return;
        }
        if (invoice.status === 'CANCELLED' || invoice.status === 'DRAFT') {
            res.status(400).json({
                success: false,
                error: `Cannot record payment against an invoice with status "${invoice.status}".`,
            });
            return;
        }
        if (payAmount > invoice.balanceDue) {
            res.status(400).json({
                success: false,
                error: `Payment amount (AED ${payAmount.toFixed(2)}) exceeds invoice outstanding balance (AED ${invoice.balanceDue.toFixed(2)}).`,
            });
            return;
        }
        let paymentMethod = null;
        if (mongoose_1.default.Types.ObjectId.isValid(paymentMethodId)) {
            paymentMethod = await PaymentMethod_js_1.PaymentMethod.findById(paymentMethodId);
        }
        const preset = exports.PM_PRESETS[paymentMethodId];
        if (!paymentMethod && preset) {
            paymentMethod = await PaymentMethod_js_1.PaymentMethod.findOne({
                $or: [{ code: preset.code }, { name: preset.name }],
            });
            if (!paymentMethod) {
                paymentMethod = await PaymentMethod_js_1.PaymentMethod.create({
                    organizationId: invoice.organizationId || 'org_pixelflames_001',
                    name: preset.name,
                    code: preset.code,
                    isActive: true,
                });
            }
        }
        if (!paymentMethod && paymentMethodId) {
            paymentMethod = await PaymentMethod_js_1.PaymentMethod.findOne({
                $or: [{ code: paymentMethodId }, { name: paymentMethodId }],
            });
        }
        if (!paymentMethod) {
            paymentMethod = await PaymentMethod_js_1.PaymentMethod.findOne();
        }
        if (!paymentMethod) {
            paymentMethod = await PaymentMethod_js_1.PaymentMethod.create({
                organizationId: invoice.organizationId || 'org_pixelflames_001',
                name: 'Bank Transfer (EFT)',
                code: 'BANK_TRANSFER',
                isActive: true,
            });
        }
        // Duplicate payment check
        if (!allowDuplicate) {
            const activePayments = await Payment_js_1.Payment.find({ invoiceId: invoice._id, status: 'RECORDED' });
            const targetDate = paymentDate || new Date().toISOString().split('T')[0];
            if (referenceNumber && referenceNumber.trim()) {
                const refMatch = activePayments.find((p) => p.referenceNumber?.toLowerCase() === referenceNumber.trim().toLowerCase());
                if (refMatch) {
                    res.status(409).json({
                        success: false,
                        error: `Potential duplicate payment detected: An active receipt (#${refMatch.paymentNumber}) with reference "${referenceNumber}" for AED ${refMatch.amount.toFixed(2)} was already recorded on ${refMatch.paymentDate}.`,
                    });
                    return;
                }
            }
            const sameAmountDate = activePayments.find((p) => p.amount === payAmount && p.paymentDate === targetDate);
            if (sameAmountDate) {
                res.status(409).json({
                    success: false,
                    error: `Potential duplicate payment detected: A payment of AED ${payAmount.toFixed(2)} was already recorded today (${targetDate}) under receipt #${sameAmountDate.paymentNumber}. Confirm duplicate override if intentional.`,
                });
                return;
            }
        }
        const company = await CompanySettings_js_1.CompanySettings.findOne();
        const prefix = company?.paymentPrefix || 'PAY';
        const lastPayment = await Payment_js_1.Payment.findOne().sort({ sequenceNumber: -1 });
        const nextSeq = (lastPayment?.sequenceNumber || 0) + 1;
        const year = new Date().getFullYear();
        const paymentNumber = `${prefix}-${year}-${String(nextSeq).padStart(4, '0')}`;
        const customerDisplayName = invoice.customerSnapshot?.companyName ||
            invoice.customerSnapshot?.contactPerson ||
            'Customer';
        const newPayment = await Payment_js_1.Payment.create({
            organizationId: invoice.organizationId,
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            customerId: invoice.customerId,
            customerName: customerDisplayName,
            paymentNumber,
            sequenceNumber: nextSeq,
            paymentDate: paymentDate || new Date().toISOString().split('T')[0],
            paymentMethodId: paymentMethod._id,
            paymentMethodName: paymentMethod.name,
            amount: payAmount,
            currency: 'AED',
            referenceNumber: referenceNumber?.trim(),
            notes: notes?.trim(),
            paymentProofUrl,
            paymentProofName,
            status: 'RECORDED',
            createdBy: req.user?.userId && mongoose_1.default.Types.ObjectId.isValid(req.user.userId)
                ? new mongoose_1.default.Types.ObjectId(req.user.userId)
                : undefined,
        });
        // Update invoice paid & balance due
        const newPaid = Number((invoice.amountPaid + payAmount).toFixed(2));
        const newBalance = Number(Math.max(0, invoice.grandTotal - newPaid).toFixed(2));
        invoice.amountPaid = newPaid;
        invoice.balanceDue = newBalance;
        invoice.status = newBalance === 0 ? 'PAID' : 'PARTIALLY_PAID';
        await invoice.save();
        await AuditLog_js_1.AuditLog.create({
            organizationId: invoice.organizationId,
            entityType: 'PAYMENT',
            entityId: newPayment._id.toString(),
            action: 'RECORDED',
            performedByName: req.user?.name || 'System User',
            newValues: { paymentNumber, amount: payAmount, invoiceNumber: invoice.invoiceNumber },
        });
        res.status(201).json({ success: true, data: serializePayment(newPayment) });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
async function reversePayment(req, res) {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        if (!reason || !reason.trim()) {
            res.status(400).json({
                success: false,
                error: 'A detailed reason is mandatory to reverse a payment in the accounting ledger.',
            });
            return;
        }
        let payment = null;
        if (mongoose_1.default.Types.ObjectId.isValid(id)) {
            payment = await Payment_js_1.Payment.findById(id);
        }
        if (!payment) {
            payment = await Payment_js_1.Payment.findOne({ paymentNumber: id });
        }
        if (!payment) {
            res.status(404).json({ success: false, error: 'Payment not found.' });
            return;
        }
        if (payment.status === 'REVERSED') {
            res.status(400).json({ success: false, error: 'Payment has already been reversed.' });
            return;
        }
        payment.status = 'REVERSED';
        payment.reversalReason = reason.trim();
        payment.reversedAt = new Date();
        payment.reversedBy = req.user?.userId && mongoose_1.default.Types.ObjectId.isValid(req.user.userId)
            ? new mongoose_1.default.Types.ObjectId(req.user.userId)
            : undefined;
        await payment.save();
        // Reopen invoice balance
        const invoice = await Invoice_js_1.Invoice.findById(payment.invoiceId);
        if (invoice) {
            const newPaid = Number(Math.max(0, invoice.amountPaid - payment.amount).toFixed(2));
            const newBalance = Number((invoice.grandTotal - newPaid).toFixed(2));
            invoice.amountPaid = newPaid;
            invoice.balanceDue = newBalance;
            const isOverdue = new Date(invoice.dueDate) < new Date();
            if (newBalance === 0) {
                invoice.status = 'PAID';
            }
            else if (newPaid > 0) {
                invoice.status = 'PARTIALLY_PAID';
            }
            else {
                invoice.status = isOverdue ? 'OVERDUE' : 'ISSUED';
            }
            await invoice.save();
        }
        await AuditLog_js_1.AuditLog.create({
            organizationId: payment.organizationId,
            entityType: 'PAYMENT',
            entityId: payment._id.toString(),
            action: 'REVERSED',
            performedByName: req.user?.name || 'System User',
            newValues: { status: 'REVERSED', reason: reason.trim() },
        });
        res.json({ success: true, data: serializePayment(payment) });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
