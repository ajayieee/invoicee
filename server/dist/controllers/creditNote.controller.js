"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCreditNotes = getCreditNotes;
exports.getCreditNoteById = getCreditNoteById;
exports.createCreditNote = createCreditNote;
const mongoose_1 = __importDefault(require("mongoose"));
const CreditNote_js_1 = require("../models/CreditNote.js");
const Invoice_js_1 = require("../models/Invoice.js");
const CompanySettings_js_1 = require("../models/CompanySettings.js");
const AuditLog_js_1 = require("../models/AuditLog.js");
async function getCreditNotes(req, res) {
    try {
        const { search, status, invoiceId, customerId, page = '1', pageSize = '10' } = req.query;
        const query = {};
        if (status && status !== 'ALL')
            query.status = status;
        if (invoiceId)
            query.invoiceId = invoiceId;
        if (customerId && customerId !== 'ALL')
            query.customerId = customerId;
        if (search && typeof search === 'string' && search.trim()) {
            const q = search.trim();
            query.$or = [
                { creditNoteNumber: { $regex: q, $options: 'i' } },
                { invoiceNumber: { $regex: q, $options: 'i' } },
                { 'customerSnapshot.companyName': { $regex: q, $options: 'i' } },
                { reason: { $regex: q, $options: 'i' } },
            ];
        }
        const p = Math.max(1, parseInt(page, 10));
        const limit = Math.max(1, Math.min(100, parseInt(pageSize, 10)));
        const skip = (p - 1) * limit;
        const [items, totalItems] = await Promise.all([
            CreditNote_js_1.CreditNote.find(query).sort({ sequenceNumber: -1, createdAt: -1 }).skip(skip).limit(limit),
            CreditNote_js_1.CreditNote.countDocuments(query),
        ]);
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
async function getCreditNoteById(req, res) {
    try {
        const { id } = req.params;
        const cn = await CreditNote_js_1.CreditNote.findById(id).populate('invoiceId');
        if (!cn) {
            res.status(404).json({ success: false, error: 'Credit Note not found.' });
            return;
        }
        res.json({ success: true, data: cn });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
async function createCreditNote(req, res) {
    try {
        const { invoiceId, itemsToCredit, reason, reasonCode = 'RE_OTHER', allocationType = 'INVOICE_OFFSET', creditType = 'PARTIAL', } = req.body;
        if (!invoiceId || !reason || !itemsToCredit || !itemsToCredit.length) {
            res.status(400).json({
                success: false,
                error: 'Invoice, reason, and items to credit are mandatory.',
            });
            return;
        }
        const invoice = await Invoice_js_1.Invoice.findById(invoiceId);
        if (!invoice) {
            res.status(404).json({ success: false, error: 'Target invoice not found.' });
            return;
        }
        if (invoice.status === 'CANCELLED' || invoice.status === 'DRAFT') {
            res.status(400).json({
                success: false,
                error: `Cannot issue a credit note against an invoice with status "${invoice.status}".`,
            });
            return;
        }
        const company = await CompanySettings_js_1.CompanySettings.findOne();
        const prefix = company?.creditNotePrefix || 'CN';
        const lastCn = await CreditNote_js_1.CreditNote.findOne().sort({ sequenceNumber: -1 });
        const nextSeq = (lastCn?.sequenceNumber || 0) + 1;
        const year = new Date().getFullYear();
        const creditNoteNumber = `${prefix}-${year}-${String(nextSeq).padStart(5, '0')}`;
        let subtotalNet = 0;
        let vatTotal = 0;
        const cnItems = itemsToCredit.map((it, idx) => {
            const origLine = invoice.items.find((line) => line._id?.toString() === it.invoiceItemId);
            const qty = Number(it.quantity) || 1;
            const price = Number(it.unitPrice !== undefined ? it.unitPrice : (origLine?.unitPrice || 0));
            const lineNet = Number((qty * price).toFixed(2));
            const vatRate = origLine?.vatRatePercentage ?? 5.0;
            const vatAmt = Number(((lineNet * vatRate) / 100).toFixed(2));
            const gross = Number((lineNet + vatAmt).toFixed(2));
            subtotalNet += lineNet;
            vatTotal += vatAmt;
            return {
                invoiceItemId: it.invoiceItemId,
                productId: origLine?.productId,
                itemOrder: idx + 1,
                description: it.description || origLine?.description || 'Credit Adjustment',
                originalInvoicedQuantity: origLine?.quantity || qty,
                originalUnitPrice: origLine?.unitPrice || price,
                quantity: qty,
                unitPrice: price,
                unit: origLine?.unit || 'Unit',
                subtotalNet: lineNet,
                vatRatePercentage: vatRate,
                vatAmount: vatAmt,
                totalGross: gross,
                adjustmentType: it.adjustmentType || 'LINE',
            };
        });
        const grandTotal = Number((subtotalNet + vatTotal).toFixed(2));
        // Handle invoice offset
        let refundStatus = 'APPLIED_TO_INVOICE';
        let remainingBalance = 0;
        if (allocationType === 'INVOICE_OFFSET') {
            refundStatus = 'APPLIED_TO_INVOICE';
            const offsetAmount = Math.min(invoice.balanceDue, grandTotal);
            const newBal = Number(Math.max(0, invoice.balanceDue - offsetAmount).toFixed(2));
            invoice.balanceDue = newBal;
            if (newBal === 0 && invoice.status !== 'PAID') {
                invoice.status = 'PAID';
            }
            await invoice.save();
            remainingBalance = Number(Math.max(0, grandTotal - offsetAmount).toFixed(2));
            if (remainingBalance > 0) {
                refundStatus = 'CREDIT_ON_ACCOUNT';
            }
        }
        else if (allocationType === 'CASH_REFUND') {
            refundStatus = 'REFUNDED_CASH';
        }
        else if (allocationType === 'BANK_REFUND') {
            refundStatus = 'REFUNDED_BANK';
        }
        else {
            refundStatus = 'CREDIT_ON_ACCOUNT';
            remainingBalance = grandTotal;
        }
        const todayStr = new Date().toISOString().split('T')[0];
        const newCreditNote = await CreditNote_js_1.CreditNote.create({
            organizationId: invoice.organizationId,
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            invoiceDate: invoice.invoiceDate,
            creditNoteNumber,
            sequenceNumber: nextSeq,
            creditNoteDate: todayStr,
            customerId: invoice.customerId,
            customerSnapshot: invoice.customerSnapshot,
            reason: reason.trim(),
            reasonCode,
            creditType,
            items: cnItems,
            subtotalNet: Number(subtotalNet.toFixed(2)),
            vatTotal: Number(vatTotal.toFixed(2)),
            grandTotal,
            remainingBalance,
            refundStatus,
            status: 'ISSUED',
            currency: 'AED',
            createdBy: req.user?.userId ? new mongoose_1.default.Types.ObjectId(req.user.userId) : undefined,
        });
        await AuditLog_js_1.AuditLog.create({
            organizationId: invoice.organizationId,
            entityType: 'CREDIT_NOTE',
            entityId: newCreditNote._id.toString(),
            action: 'ISSUED',
            performedByName: req.user?.name || 'System User',
            newValues: { creditNoteNumber, grandTotal, invoiceNumber: invoice.invoiceNumber },
        });
        res.status(201).json({ success: true, data: newCreditNote });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
