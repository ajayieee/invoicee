"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeQuote = serializeQuote;
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
function serializeQuote(doc) {
    if (!doc)
        return null;
    const obj = doc.toObject ? doc.toObject() : doc;
    const id = obj._id ? obj._id.toString() : obj.id;
    const items = Array.isArray(obj.items)
        ? obj.items.map((it, idx) => ({
            id: it._id ? it._id.toString() : it.id || `item-${idx}`,
            product_id: it.productId ? it.productId.toString() : it.product_id,
            productId: it.productId ? it.productId.toString() : it.product_id,
            item_order: it.itemOrder ?? it.item_order ?? idx + 1,
            itemOrder: it.itemOrder ?? it.item_order ?? idx + 1,
            description: it.description || '',
            quantity: Number(it.quantity || 1),
            unit: it.unit || 'Unit',
            unit_price: Number(it.unitPrice ?? it.unit_price ?? 0),
            unitPrice: Number(it.unitPrice ?? it.unit_price ?? 0),
            discount_type: it.discountType || it.discount_type || 'PERCENTAGE',
            discountType: it.discountType || it.discount_type || 'PERCENTAGE',
            discount_value: Number(it.discountValue ?? it.discount_value ?? 0),
            discountValue: Number(it.discountValue ?? it.discount_value ?? 0),
            discount_amount: Number(it.discountAmount ?? it.discount_amount ?? 0),
            discountAmount: Number(it.discountAmount ?? it.discount_amount ?? 0),
            subtotal_net: Number(it.subtotalNet ?? it.subtotal_net ?? 0),
            subtotalNet: Number(it.subtotalNet ?? it.subtotal_net ?? 0),
            vat_rate_id: it.vatRateId ? it.vatRateId.toString() : it.vat_rate_id || 'vat-001',
            vatRateId: it.vatRateId ? it.vatRateId.toString() : it.vat_rate_id || 'vat-001',
            vat_rate_percentage: Number(it.vatRatePercentage ?? it.vat_rate_percentage ?? 5.0),
            vatRatePercentage: Number(it.vatRatePercentage ?? it.vat_rate_percentage ?? 5.0),
            vat_amount: Number(it.vatAmount ?? it.vat_amount ?? 0),
            vatAmount: Number(it.vatAmount ?? it.vat_amount ?? 0),
            total_gross: Number(it.totalGross ?? it.total_gross ?? 0),
            totalGross: Number(it.totalGross ?? it.total_gross ?? 0),
        }))
        : [];
    const customerId = obj.customerId ? (obj.customerId._id ? obj.customerId._id.toString() : obj.customerId.toString()) : obj.customer_id;
    const customerName = obj.customerSnapshot?.companyName ||
        obj.customerSnapshot?.contactPerson ||
        obj.customer_name ||
        'Client';
    return {
        ...obj,
        id,
        _id: id,
        organization_id: obj.organizationId || obj.organization_id || 'org_pixelflames_001',
        organizationId: obj.organizationId || obj.organization_id || 'org_pixelflames_001',
        customer_id: customerId,
        customerId,
        customer_name: customerName,
        customerName,
        customer_email: obj.customerSnapshot?.email || obj.customer_email,
        customerEmail: obj.customerSnapshot?.email || obj.customer_email,
        customer_trn: obj.customerSnapshot?.trn || obj.customer_trn,
        customerTrn: obj.customerSnapshot?.trn || obj.customer_trn,
        quote_number: obj.quoteNumber || obj.quote_number,
        quoteNumber: obj.quoteNumber || obj.quote_number,
        quote_date: obj.quoteDate ? new Date(obj.quoteDate).toISOString().split('T')[0] : obj.quote_date,
        quoteDate: obj.quoteDate ? new Date(obj.quoteDate).toISOString().split('T')[0] : obj.quote_date,
        expiry_date: obj.validUntil ? new Date(obj.validUntil).toISOString().split('T')[0] : (obj.expiry_date || obj.validUntil),
        validUntil: obj.validUntil ? new Date(obj.validUntil).toISOString().split('T')[0] : (obj.expiry_date || obj.validUntil),
        status: obj.status || 'DRAFT',
        currency: obj.currency || 'AED',
        exchange_rate: Number(obj.exchangeRate ?? obj.exchange_rate ?? 1.0),
        exchangeRate: Number(obj.exchangeRate ?? obj.exchange_rate ?? 1.0),
        subtotal_net: Number(obj.subtotalNet ?? obj.subtotal_net ?? 0),
        subtotalNet: Number(obj.subtotalNet ?? obj.subtotal_net ?? 0),
        discount_type: obj.discountType || obj.discount_type || 'PERCENTAGE',
        discountType: obj.discountType || obj.discount_type || 'PERCENTAGE',
        discount_value: Number(obj.discountValue ?? obj.discount_value ?? 0),
        discountValue: Number(obj.discountValue ?? obj.discount_value ?? 0),
        discount_amount: Number(obj.discountAmount ?? obj.discount_amount ?? 0),
        discountAmount: Number(obj.discountAmount ?? obj.discount_amount ?? 0),
        vat_total: Number(obj.vatTotal ?? obj.vat_total ?? 0),
        vatTotal: Number(obj.vatTotal ?? obj.vat_total ?? 0),
        grand_total: Number(obj.grandTotal ?? obj.grand_total ?? 0),
        grandTotal: Number(obj.grandTotal ?? obj.grand_total ?? 0),
        notes: obj.notes,
        terms: obj.terms,
        items,
        created_at: obj.createdAt ? new Date(obj.createdAt).toISOString() : new Date().toISOString(),
        updated_at: obj.updatedAt ? new Date(obj.updatedAt).toISOString() : new Date().toISOString(),
    };
}
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
        const limit = Math.max(1, Math.min(1000, parseInt(pageSize, 10)));
        const skip = (p - 1) * limit;
        const [rawItems, totalItems] = await Promise.all([
            Quote_js_1.Quote.find(query).sort({ sequenceNumber: -1, createdAt: -1 }).skip(skip).limit(limit),
            Quote_js_1.Quote.countDocuments(query),
        ]);
        const items = rawItems.map(serializeQuote);
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
        res.json({ success: true, data: serializeQuote(quote) });
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
        res.status(201).json({ success: true, data: serializeQuote(newQuote) });
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
