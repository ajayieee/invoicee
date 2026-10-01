"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQuotes = getQuotes;
exports.getQuoteById = getQuoteById;
exports.createQuote = createQuote;
exports.convertQuoteToInvoice = convertQuoteToInvoice;
const mongoose_1 = __importDefault(require("mongoose"));
const Quote_js_1 = require("../models/Quote.js");
const Customer_js_1 = require("../models/Customer.js");
const Invoice_js_1 = require("../models/Invoice.js");
const CompanySettings_js_1 = require("../models/CompanySettings.js");
const AuditLog_js_1 = require("../models/AuditLog.js");
const vatCalculator_js_1 = require("../utils/vatCalculator.js");
async function getQuotes(req, res) {
    try {
        const { search, status, customerId, page = '1', pageSize = '10' } = req.query;
        const query = {};
        if (status && status !== 'ALL')
            query.status = status;
        if (customerId && customerId !== 'ALL')
            query.customerId = customerId;
        if (search && typeof search === 'string' && search.trim()) {
            const q = search.trim();
            query.$or = [
                { quoteNumber: { $regex: q, $options: 'i' } },
                { 'customerSnapshot.companyName': { $regex: q, $options: 'i' } },
                { referenceNumber: { $regex: q, $options: 'i' } },
            ];
        }
        const p = Math.max(1, parseInt(page, 10));
        const limit = Math.max(1, Math.min(100, parseInt(pageSize, 10)));
        const skip = (p - 1) * limit;
        const [items, totalItems] = await Promise.all([
            Quote_js_1.Quote.find(query).sort({ sequenceNumber: -1, createdAt: -1 }).skip(skip).limit(limit),
            Quote_js_1.Quote.countDocuments(query),
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
async function getQuoteById(req, res) {
    try {
        const { id } = req.params;
        const quote = await Quote_js_1.Quote.findById(id).populate('customerId');
        if (!quote) {
            res.status(404).json({ success: false, error: 'Quotation not found.' });
            return;
        }
        res.json({ success: true, data: quote });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
async function createQuote(req, res) {
    try {
        const { customerId, quoteDate, validUntil, referenceNumber, items, discountType, discountValue, notes, terms, status = 'DRAFT', } = req.body;
        const customer = await Customer_js_1.Customer.findById(customerId);
        if (!customer) {
            res.status(404).json({ success: false, error: 'Customer not found.' });
            return;
        }
        const company = await CompanySettings_js_1.CompanySettings.findOne();
        const prefix = company?.quotePrefix || 'QUO';
        const lastQuote = await Quote_js_1.Quote.findOne().sort({ sequenceNumber: -1 });
        const nextSeq = (lastQuote?.sequenceNumber || 0) + 1;
        const year = new Date(quoteDate || new Date()).getFullYear();
        const quoteNumber = `${prefix}-${year}-${String(nextSeq).padStart(5, '0')}`;
        const calc = vatCalculator_js_1.ServerVatCalculator.calculateDocument(items, discountType, discountValue);
        const docItems = calc.items.map((it, idx) => ({
            itemOrder: idx + 1,
            description: items[idx]?.description || 'Service/Product',
            quantity: it.quantity,
            unit: items[idx]?.unit || 'Unit',
            unitPrice: it.unitPrice,
            discountType: it.discountType,
            discountValue: it.discountValue,
            discountAmount: it.discountAmount,
            subtotalNet: it.subtotalNet,
            vatRatePercentage: it.vatRatePercentage,
            vatTreatment: it.vatTreatment,
            vatAmount: it.vatAmount,
            totalGross: it.totalGross,
            productId: items[idx]?.productId ? new mongoose_1.default.Types.ObjectId(items[idx].productId) : undefined,
        }));
        const newQuote = await Quote_js_1.Quote.create({
            organizationId: req.user?.organizationId || 'org_pixelflames_001',
            customerId: customer._id,
            quoteNumber,
            sequenceNumber: nextSeq,
            quoteDate: quoteDate || new Date().toISOString().split('T')[0],
            validUntil: validUntil || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
            customerSnapshot: {
                companyName: customer.companyName,
                contactPerson: customer.contactPerson,
                email: customer.email,
                phone: customer.phone,
                trn: customer.trn,
                billingAddressLine1: customer.billingAddressLine1,
                billingCity: customer.billingCity,
                billingEmirate: customer.billingEmirate,
            },
            items: docItems,
            subtotalNet: calc.subtotalNet,
            discountType: discountType || 'PERCENTAGE',
            discountValue: discountValue || 0,
            discountAmount: calc.discountAmount,
            vatTotal: calc.vatTotal,
            grandTotal: calc.grandTotal,
            status: status || 'DRAFT',
            currency: 'AED',
            referenceNumber,
            notes,
            terms,
            createdBy: req.user?.userId ? new mongoose_1.default.Types.ObjectId(req.user.userId) : undefined,
        });
        res.status(201).json({ success: true, data: newQuote });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
async function convertQuoteToInvoice(req, res) {
    try {
        const { id } = req.params;
        const quote = await Quote_js_1.Quote.findById(id);
        if (!quote) {
            res.status(404).json({ success: false, error: 'Quotation not found.' });
            return;
        }
        if (quote.status === 'CONVERTED') {
            res.status(400).json({
                success: false,
                error: `Quotation has already been converted to invoice ${quote.convertedInvoiceNumber}.`,
            });
            return;
        }
        const company = await CompanySettings_js_1.CompanySettings.findOne();
        const prefix = company?.invoicePrefix || 'INV';
        const lastInvoice = await Invoice_js_1.Invoice.findOne().sort({ sequenceNumber: -1 });
        const nextSeq = (lastInvoice?.sequenceNumber || 0) + 1;
        const year = new Date().getFullYear();
        const invoiceNumber = `${prefix}-${year}-${String(nextSeq).padStart(5, '0')}`;
        const todayStr = new Date().toISOString().split('T')[0];
        const invoice = await Invoice_js_1.Invoice.create({
            organizationId: quote.organizationId,
            customerId: quote.customerId,
            quoteId: quote._id,
            invoiceNumber,
            sequenceNumber: nextSeq,
            invoiceDate: todayStr,
            supplyDate: todayStr,
            dueDate: todayStr,
            paymentTermsDays: 30,
            customerSnapshot: quote.customerSnapshot,
            items: quote.items.map((it) => ({
                ...(it.toObject ? it.toObject() : it),
                _id: new mongoose_1.default.Types.ObjectId(),
            })),
            subtotalNet: quote.subtotalNet,
            discountType: quote.discountType,
            discountValue: quote.discountValue,
            discountAmount: quote.discountAmount,
            vatTotal: quote.vatTotal,
            grandTotal: quote.grandTotal,
            amountPaid: 0,
            balanceDue: quote.grandTotal,
            status: 'DRAFT',
            referenceNumber: `Quote: ${quote.quoteNumber}`,
            notes: quote.notes,
            terms: quote.terms,
            createdBy: req.user?.userId ? new mongoose_1.default.Types.ObjectId(req.user.userId) : undefined,
        });
        quote.status = 'CONVERTED';
        quote.convertedInvoiceId = invoice._id;
        quote.convertedInvoiceNumber = invoice.invoiceNumber;
        quote.convertedAt = new Date();
        await quote.save();
        await AuditLog_js_1.AuditLog.create({
            organizationId: quote.organizationId,
            entityType: 'QUOTE',
            entityId: quote._id.toString(),
            action: 'CONVERTED_TO_INVOICE',
            performedByName: req.user?.name || 'System User',
            newValues: { convertedInvoiceNumber: invoice.invoiceNumber },
        });
        res.status(201).json({ success: true, data: invoice });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
