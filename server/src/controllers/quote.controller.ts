import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Quote } from '../models/Quote.js';
import { Customer } from '../models/Customer.js';
import { Invoice } from '../models/Invoice.js';
import { CompanySettings } from '../models/CompanySettings.js';
import { AuditLog } from '../models/AuditLog.js';
import { ServerVatCalculator } from '../utils/vatCalculator.js';
import { serializeInvoice } from './invoice.controller.js';

export function serializeQuote(doc: any) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  const id = obj._id ? obj._id.toString() : obj.id;

  const items = Array.isArray(obj.items)
    ? obj.items.map((it: any, idx: number) => ({
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
  const customerName =
    obj.customerSnapshot?.companyName ||
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

export async function getQuotes(req: Request, res: Response): Promise<void> {
  try {
    const { search, status, customerId, page = '1', pageSize = '10' } = req.query;

    const query: any = {};
    if (status && status !== 'ALL') query.status = status;
    if (customerId && customerId !== 'ALL') query.customerId = customerId;

    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      query.$or = [
        { quoteNumber: { $regex: q, $options: 'i' } },
        { 'customerSnapshot.companyName': { $regex: q, $options: 'i' } },
        { referenceNumber: { $regex: q, $options: 'i' } },
      ];
    }

    const p = Math.max(1, parseInt(page as string, 10));
    const limit = Math.max(1, Math.min(1000, parseInt(pageSize as string, 10)));
    const skip = (p - 1) * limit;

    const [rawItems, totalItems] = await Promise.all([
      Quote.find(query).sort({ sequenceNumber: -1, createdAt: -1 }).skip(skip).limit(limit),
      Quote.countDocuments(query),
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getQuoteById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const quote = await Quote.findById(id).populate('customerId');
    if (!quote) {
      res.status(404).json({ success: false, error: 'Quotation not found.' });
      return;
    }
    res.json({ success: true, data: serializeQuote(quote) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function createQuote(req: Request, res: Response): Promise<void> {
  try {
    const {
      customerId,
      quoteDate,
      validUntil,
      referenceNumber,
      items,
      discountType,
      discountValue,
      notes,
      terms,
      status = 'DRAFT',
    } = req.body;

    let customer: any = null;
    if (mongoose.Types.ObjectId.isValid(customerId)) {
      customer = await Customer.findById(customerId);
    }
    if (!customer) {
      customer = await Customer.findOne({
        $or: [
          { companyName: customerId },
          { contactPerson: customerId },
          { email: customerId },
        ],
      });
    }

    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found.' });
      return;
    }

    const company = await CompanySettings.findOne();
    const prefix = company?.quotePrefix || 'QUO';
    const lastQuote = await Quote.findOne().sort({ sequenceNumber: -1 });
    const nextSeq = (lastQuote?.sequenceNumber || 0) + 1;
    const year = new Date(quoteDate || new Date()).getFullYear();
    const quoteNumber = `${prefix}-${year}-${String(nextSeq).padStart(5, '0')}`;

    // Normalize line items for server VAT calculation
    const calcInputs = (items || []).map((it: any) => ({
      quantity: Number(it.quantity ?? 1),
      unitPrice: Number(it.unitPrice ?? it.unit_price ?? 0),
      discountType: it.discountType || it.discount_type || 'PERCENTAGE',
      discountValue: Number(it.discountValue ?? it.discount_value ?? 0),
      vatRatePercentage: Number(it.vatRatePercentage ?? it.vat_rate_percentage ?? 5.0),
      vatTreatment: it.vatTreatment || it.vat_treatment || 'STANDARD_RATED',
    }));

    const calc = ServerVatCalculator.calculateDocument(calcInputs, discountType, Number(discountValue || 0));

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
      vatTreatment: it.vatTreatment as any,
      vatAmount: it.vatAmount,
      totalGross: it.totalGross,
      productId: items[idx]?.productId && mongoose.Types.ObjectId.isValid(items[idx].productId)
        ? new mongoose.Types.ObjectId(items[idx].productId)
        : undefined,
    }));

    const newQuote = await Quote.create({
      organizationId: (req as any).user?.organizationId || 'org_pixelflames_001',
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
      discountValue: Number(discountValue || 0),
      discountAmount: calc.discountAmount,
      vatTotal: calc.vatTotal,
      grandTotal: calc.grandTotal,
      status: status || 'DRAFT',
      currency: 'AED',
      referenceNumber,
      notes,
      terms,
      createdBy: req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : undefined,
    });

    res.status(201).json({ success: true, data: serializeQuote(newQuote) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateQuote(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const {
      customerId,
      quoteDate,
      validUntil,
      referenceNumber,
      items,
      discountType,
      discountValue,
      notes,
      terms,
      status,
    } = req.body;

    const quote = await Quote.findById(id);
    if (!quote) {
      res.status(404).json({ success: false, error: 'Quotation not found.' });
      return;
    }

    if (quote.status === 'CONVERTED') {
      res.status(400).json({ success: false, error: 'Converted quotations cannot be modified.' });
      return;
    }

    if (customerId) {
      let customer: any = null;
      if (mongoose.Types.ObjectId.isValid(customerId)) {
        customer = await Customer.findById(customerId);
      }
      if (!customer) {
        customer = await Customer.findOne({
          $or: [
            { companyName: customerId },
            { contactPerson: customerId },
            { email: customerId },
          ],
        });
      }
      if (customer) {
        quote.customerId = customer._id;
        quote.customerSnapshot = {
          companyName: customer.companyName,
          contactPerson: customer.contactPerson,
          email: customer.email,
          phone: customer.phone,
          trn: customer.trn,
          billingAddressLine1: customer.billingAddressLine1,
          billingCity: customer.billingCity,
          billingEmirate: customer.billingEmirate,
        };
      }
    }

    if (items && Array.isArray(items)) {
      const calcInputs = items.map((it: any) => ({
        quantity: Number(it.quantity ?? 1),
        unitPrice: Number(it.unitPrice ?? it.unit_price ?? 0),
        discountType: it.discountType || it.discount_type || 'PERCENTAGE',
        discountValue: Number(it.discountValue ?? it.discount_value ?? 0),
        vatRatePercentage: Number(it.vatRatePercentage ?? it.vat_rate_percentage ?? 5.0),
        vatTreatment: it.vatTreatment || it.vat_treatment || 'STANDARD_RATED',
      }));

      const calc = ServerVatCalculator.calculateDocument(
        calcInputs,
        discountType ?? quote.discountType,
        Number(discountValue ?? quote.discountValue)
      );

      quote.items = calc.items.map((it, idx) => ({
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
        vatTreatment: it.vatTreatment as any,
        vatAmount: it.vatAmount,
        totalGross: it.totalGross,
        productId: items[idx]?.productId && mongoose.Types.ObjectId.isValid(items[idx].productId)
          ? new mongoose.Types.ObjectId(items[idx].productId)
          : undefined,
      })) as any;

      quote.subtotalNet = calc.subtotalNet;
      quote.discountType = (discountType ?? quote.discountType) as any;
      quote.discountValue = Number(discountValue ?? quote.discountValue);
      quote.discountAmount = calc.discountAmount;
      quote.vatTotal = calc.vatTotal;
      quote.grandTotal = calc.grandTotal;
    }

    if (quoteDate) quote.quoteDate = quoteDate;
    if (validUntil) quote.validUntil = validUntil;
    if (referenceNumber !== undefined) quote.referenceNumber = referenceNumber;
    if (notes !== undefined) quote.notes = notes;
    if (terms !== undefined) quote.terms = terms;
    if (status) quote.status = status;

    await quote.save();

    await AuditLog.create({
      organizationId: quote.organizationId,
      entityType: 'QUOTE',
      entityId: quote._id.toString(),
      action: 'UPDATED',
      performedByName: req.user?.name || 'System User',
    });

    res.json({ success: true, data: serializeQuote(quote) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateQuoteStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        error: `Invalid status "${status}". Allowed statuses: ${validStatuses.join(', ')}`,
      });
      return;
    }

    const quote = await Quote.findById(id);
    if (!quote) {
      res.status(404).json({ success: false, error: 'Quotation not found.' });
      return;
    }

    if (quote.status === 'CONVERTED') {
      res.status(400).json({
        success: false,
        error: 'Quotation has already been converted to a tax invoice and cannot change state.',
      });
      return;
    }

    const oldStatus = quote.status;
    quote.status = status;
    await quote.save();

    await AuditLog.create({
      organizationId: quote.organizationId,
      entityType: 'QUOTE',
      entityId: quote._id.toString(),
      action: 'STATUS_CHANGE',
      performedByName: req.user?.name || 'System User',
      oldValues: { status: oldStatus },
      newValues: { status },
    });

    res.json({ success: true, data: serializeQuote(quote) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function deleteQuote(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const quote = await Quote.findById(id);
    if (!quote) {
      res.status(404).json({ success: false, error: 'Quotation not found.' });
      return;
    }

    if (quote.status === 'CONVERTED') {
      res.status(400).json({
        success: false,
        error: 'Cannot delete quotation: It has been converted to an official UAE Tax Invoice and must remain in the audit trail.',
      });
      return;
    }

    if (quote.status === 'ACCEPTED') {
      res.status(400).json({
        success: false,
        error: 'Cannot delete quotation: Client has accepted this proposal. Reject or convert instead.',
      });
      return;
    }

    await Quote.findByIdAndDelete(id);

    await AuditLog.create({
      organizationId: quote.organizationId,
      entityType: 'QUOTE',
      entityId: id,
      action: 'DELETED',
      performedByName: req.user?.name || 'System User',
    });

    res.json({ success: true, message: 'Quotation deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function convertQuoteToInvoice(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const quote = await Quote.findById(id);

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

    const company = await CompanySettings.findOne();
    const prefix = company?.invoicePrefix || 'INV';
    const lastInvoice = await Invoice.findOne().sort({ sequenceNumber: -1 });
    const nextSeq = (lastInvoice?.sequenceNumber || 0) + 1;
    const year = new Date().getFullYear();
    const invoiceNumber = `${prefix}-${year}-${String(nextSeq).padStart(5, '0')}`;

    const todayStr = new Date().toISOString().split('T')[0];

    const invoice = await Invoice.create({
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
      items: quote.items.map((it: any) => ({
        ...(it.toObject ? it.toObject() : it),
        _id: new mongoose.Types.ObjectId(),
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
      createdBy: req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : undefined,
    });

    quote.status = 'CONVERTED';
    quote.convertedInvoiceId = invoice._id;
    quote.convertedInvoiceNumber = invoice.invoiceNumber;
    quote.convertedAt = new Date();
    await quote.save();

    await AuditLog.create({
      organizationId: quote.organizationId,
      entityType: 'QUOTE',
      entityId: quote._id.toString(),
      action: 'CONVERTED_TO_INVOICE',
      performedByName: req.user?.name || 'System User',
      newValues: { convertedInvoiceNumber: invoice.invoiceNumber },
    });

    res.status(201).json({ success: true, data: serializeInvoice(invoice) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
