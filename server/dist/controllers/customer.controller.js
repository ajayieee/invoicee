"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCustomers = getCustomers;
exports.getCustomerById = getCustomerById;
exports.getCustomer360 = getCustomer360;
exports.createCustomer = createCustomer;
exports.updateCustomer = updateCustomer;
exports.deleteCustomer = deleteCustomer;
const Customer_js_1 = require("../models/Customer.js");
const Invoice_js_1 = require("../models/Invoice.js");
const Quote_js_1 = require("../models/Quote.js");
const Payment_js_1 = require("../models/Payment.js");
const CreditNote_js_1 = require("../models/CreditNote.js");
async function getCustomers(req, res) {
    try {
        const { search, relationType, emirate, page = '1', pageSize = '10' } = req.query;
        const query = {};
        if (relationType && relationType !== 'ALL')
            query.relationType = relationType;
        if (emirate && emirate !== 'ALL')
            query.billingEmirate = emirate;
        if (search && typeof search === 'string' && search.trim()) {
            const q = search.trim();
            query.$or = [
                { companyName: { $regex: q, $options: 'i' } },
                { contactPerson: { $regex: q, $options: 'i' } },
                { trn: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } },
                { phone: { $regex: q, $options: 'i' } },
            ];
        }
        const p = Math.max(1, parseInt(page, 10));
        const limit = Math.max(1, Math.min(100, parseInt(pageSize, 10)));
        const skip = (p - 1) * limit;
        const [items, totalItems] = await Promise.all([
            Customer_js_1.Customer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
            Customer_js_1.Customer.countDocuments(query),
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
async function getCustomerById(req, res) {
    try {
        const { id } = req.params;
        const customer = await Customer_js_1.Customer.findById(id);
        if (!customer) {
            res.status(404).json({ success: false, error: 'Customer not found.' });
            return;
        }
        res.json({ success: true, data: customer });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
async function getCustomer360(req, res) {
    try {
        const { id } = req.params;
        const customer = await Customer_js_1.Customer.findById(id);
        if (!customer) {
            res.status(404).json({ success: false, error: 'Customer not found.' });
            return;
        }
        const [invoices, quotes, payments, creditNotes] = await Promise.all([
            Invoice_js_1.Invoice.find({ customerId: customer._id }).sort({ invoiceDate: -1 }),
            Quote_js_1.Quote.find({ customerId: customer._id }).sort({ quoteDate: -1 }),
            Payment_js_1.Payment.find({ customerId: customer._id, status: 'RECORDED' }).sort({ paymentDate: -1 }),
            CreditNote_js_1.CreditNote.find({ customerId: customer._id, status: { $ne: 'CANCELLED' } }).sort({
                creditNoteDate: -1,
            }),
        ]);
        let totalInvoiced = 0;
        let totalPaid = 0;
        let totalBalanceDue = 0;
        let overdueCount = 0;
        for (const inv of invoices) {
            if (inv.status !== 'CANCELLED') {
                totalInvoiced += inv.grandTotal;
                totalPaid += inv.amountPaid;
                totalBalanceDue += inv.balanceDue;
                if (inv.status === 'OVERDUE')
                    overdueCount++;
            }
        }
        const totalCredited = creditNotes.reduce((sum, cn) => sum + cn.grandTotal, 0);
        res.json({
            success: true,
            data: {
                customer,
                invoices,
                quotes,
                payments,
                creditNotes,
                totalInvoiced: Math.round(totalInvoiced * 100) / 100,
                totalPaid: Math.round(totalPaid * 100) / 100,
                totalCredited: Math.round(totalCredited * 100) / 100,
                totalBalanceDue: Math.round(totalBalanceDue * 100) / 100,
                overdueCount,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
async function createCustomer(req, res) {
    try {
        const data = req.body;
        if (!data.contactPerson) {
            res.status(400).json({ success: false, error: 'Contact person is required.' });
            return;
        }
        if (data.customerType === 'COMPANY' && !data.companyName) {
            res.status(400).json({ success: false, error: 'Company name is required for company accounts.' });
            return;
        }
        const customer = await Customer_js_1.Customer.create({
            ...data,
            organizationId: req.user?.organizationId || 'org_pixelflames_001',
        });
        res.status(201).json({ success: true, data: customer });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
async function updateCustomer(req, res) {
    try {
        const { id } = req.params;
        const customer = await Customer_js_1.Customer.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
        if (!customer) {
            res.status(404).json({ success: false, error: 'Customer not found.' });
            return;
        }
        res.json({ success: true, data: customer });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
async function deleteCustomer(req, res) {
    try {
        const { id } = req.params;
        const invCount = await Invoice_js_1.Invoice.countDocuments({ customerId: id });
        if (invCount > 0) {
            res.status(400).json({
                success: false,
                error: `Cannot delete entity: ${invCount} tax invoice(s) exist for this account. In accordance with UAE accounting regulations, financial records cannot be orphaned. Deactivate the account instead.`,
            });
            return;
        }
        const quoteCount = await Quote_js_1.Quote.countDocuments({ customerId: id });
        if (quoteCount > 0) {
            res.status(400).json({
                success: false,
                error: `Cannot delete entity: ${quoteCount} quotation(s) are linked to this client. Deactivate the account instead.`,
            });
            return;
        }
        await Customer_js_1.Customer.findByIdAndDelete(id);
        res.json({ success: true, message: 'Customer account deleted successfully.' });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
