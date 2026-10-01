import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Quote } from '../models/Quote.js';
import { Customer } from '../models/Customer.js';
import { Invoice } from '../models/Invoice.js';
import { CompanySettings } from '../models/CompanySettings.js';
import { AuditLog } from '../models/AuditLog.js';
import { ServerVatCalculator } from '../utils/vatCalculator.js';

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
    const limit = Math.max(1, Math.min(100, parseInt(pageSize as string, 10)));
    const skip = (p - 1) * limit;

    const [items, totalItems] = await Promise.all([
      Quote.find(query).sort({ sequenceNumber: -1, createdAt: -1 }).skip(skip).limit(limit),
      Quote.countDocuments(query),
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
    res.json({ success: true, data: quote });
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

    const customer = await Customer.findById(customerId);
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

    const calc = ServerVatCalculator.calculateDocument(items, discountType, discountValue);

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
      productId: items[idx]?.productId ? new mongoose.Types.ObjectId(items[idx].productId) : undefined,
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
      discountValue: discountValue || 0,
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

    res.status(201).json({ success: true, data: newQuote });
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

    res.status(201).json({ success: true, data: invoice });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
