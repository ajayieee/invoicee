"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeCustomer = serializeCustomer;
exports.normalizeCustomerInput = normalizeCustomerInput;
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
function serializeCustomer(doc) {
    if (!doc)
        return null;
    const obj = doc.toObject ? doc.toObject() : doc;
    const id = obj._id ? obj._id.toString() : obj.id;
    return {
        ...obj,
        id,
        _id: id,
        customer_type: obj.customerType || obj.customer_type || 'COMPANY',
        customerType: obj.customerType || obj.customer_type || 'COMPANY',
        relation_type: obj.relationType || obj.relation_type || 'CUSTOMER',
        relationType: obj.relationType || obj.relation_type || 'CUSTOMER',
        company_name: obj.companyName ?? obj.company_name,
        companyName: obj.companyName ?? obj.company_name,
        contact_person: obj.contactPerson || obj.contact_person || '',
        contactPerson: obj.contactPerson || obj.contact_person || '',
        email: obj.email,
        phone: obj.phone,
        mobile: obj.mobile,
        trn: obj.trn,
        billing_emirate: obj.billingEmirate || obj.billing_emirate || 'DUBAI',
        billingEmirate: obj.billingEmirate || obj.billing_emirate || 'DUBAI',
        billing_address_line_1: obj.billingAddressLine1 ?? obj.billing_address_line_1,
        billingAddressLine1: obj.billingAddressLine1 ?? obj.billing_address_line_1,
        billing_address_line_2: obj.billingAddressLine2 ?? obj.billing_address_line_2,
        billingAddressLine2: obj.billingAddressLine2 ?? obj.billing_address_line_2,
        billing_city: obj.billingCity || obj.billing_city || 'Dubai',
        billingCity: obj.billingCity || obj.billing_city || 'Dubai',
        billing_country: obj.billingCountry || obj.billing_country || 'United Arab Emirates',
        billingCountry: obj.billingCountry || obj.billing_country || 'United Arab Emirates',
        billing_po_box: obj.billingPoBox ?? obj.billing_po_box,
        billingPoBox: obj.billingPoBox ?? obj.billing_po_box,
        payment_terms_days: obj.paymentTermsDays ?? obj.payment_terms_days ?? 30,
        paymentTermsDays: obj.paymentTermsDays ?? obj.payment_terms_days ?? 30,
        currency: obj.currency || 'AED',
        notes: obj.notes,
        is_active: obj.isActive ?? obj.is_active ?? true,
        isActive: obj.isActive ?? obj.is_active ?? true,
        created_at: obj.createdAt ? new Date(obj.createdAt).toISOString() : new Date().toISOString(),
        updated_at: obj.updatedAt ? new Date(obj.updatedAt).toISOString() : new Date().toISOString(),
    };
}
function normalizeCustomerInput(raw) {
    return {
        customerType: raw.customerType || raw.customer_type || 'COMPANY',
        relationType: raw.relationType || raw.relation_type || 'CUSTOMER',
        companyName: (raw.companyName ?? raw.company_name)?.trim() || undefined,
        contactPerson: (raw.contactPerson ?? raw.contact_person)?.trim() || '',
        email: raw.email?.trim() || undefined,
        phone: raw.phone?.trim() || undefined,
        mobile: raw.mobile?.trim() || undefined,
        trn: raw.trn?.trim() || undefined,
        billingEmirate: raw.billingEmirate || raw.billing_emirate || 'DUBAI',
        billingAddressLine1: (raw.billingAddressLine1 ?? raw.billing_address_line_1)?.trim() || undefined,
        billingAddressLine2: (raw.billingAddressLine2 ?? raw.billing_address_line_2)?.trim() || undefined,
        billingCity: (raw.billingCity ?? raw.billing_city)?.trim() || 'Dubai',
        billingPoBox: (raw.billingPoBox ?? raw.billing_po_box)?.trim() || undefined,
        paymentTermsDays: Number(raw.paymentTermsDays ?? raw.payment_terms_days) || 30,
        currency: raw.currency || 'AED',
        notes: raw.notes?.trim() || undefined,
        isActive: raw.isActive !== undefined ? raw.isActive : (raw.is_active !== undefined ? raw.is_active : true),
    };
}
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
        const limit = Math.max(1, Math.min(1000, parseInt(pageSize, 10)));
        const skip = (p - 1) * limit;
        const [rawItems, totalItems] = await Promise.all([
            Customer_js_1.Customer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
            Customer_js_1.Customer.countDocuments(query),
        ]);
        const items = rawItems.map(serializeCustomer);
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
        res.json({ success: true, data: serializeCustomer(customer) });
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
                customer: serializeCustomer(customer),
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
        const raw = req.body;
        const contactPerson = (raw.contactPerson ?? raw.contact_person)?.trim();
        const customerType = raw.customerType || raw.customer_type || 'COMPANY';
        const companyName = (raw.companyName ?? raw.company_name)?.trim();
        if (!contactPerson) {
            res.status(400).json({ success: false, error: 'Contact person is required.' });
            return;
        }
        if (customerType === 'COMPANY' && !companyName) {
            res.status(400).json({ success: false, error: 'Company name is required for company accounts.' });
            return;
        }
        const normalized = normalizeCustomerInput(raw);
        const customer = await Customer_js_1.Customer.create({
            ...normalized,
            organizationId: req.user?.organizationId || 'org_pixelflames_001',
        });
        res.status(201).json({ success: true, data: serializeCustomer(customer) });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
async function updateCustomer(req, res) {
    try {
        const { id } = req.params;
        const raw = req.body;
        const normalized = normalizeCustomerInput(raw);
        const customer = await Customer_js_1.Customer.findByIdAndUpdate(id, normalized, { new: true, runValidators: true });
        if (!customer) {
            res.status(404).json({ success: false, error: 'Customer not found.' });
            return;
        }
        res.json({ success: true, data: serializeCustomer(customer) });
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
