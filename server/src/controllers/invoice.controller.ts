import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Invoice } from '../models/Invoice.js';
import { Customer } from '../models/Customer.js';
import { CompanySettings } from '../models/CompanySettings.js';
import { AuditLog } from '../models/AuditLog.js';
import { ServerVatCalculator } from '../utils/vatCalculator.js';

export async function getInvoices(req: Request, res: Response): Promise<void> {
  try {
    const {
      search,
      status,
      customerId,
      paymentStatus,
      startDate,
      endDate,
      page = '1',
      pageSize = '10',
    } = req.query;

    const query: any = {};

    // 1. Status Filter
    if (status && status !== 'ALL') {
      if (status === 'OVERDUE') {
        const todayStr = new Date().toISOString().split('T')[0];
        query.balanceDue = { $gt: 0 };
        query.dueDate = { $lt: todayStr };
        query.status = { $nin: ['DRAFT', 'CANCELLED'] };
      } else {
        query.status = status;
      }
    }

    // 2. Customer Filter
    if (customerId && customerId !== 'ALL') {
      query.customerId = customerId;
    }

    // 3. Payment Status Filter
    if (paymentStatus && paymentStatus !== 'ALL') {
      const todayStr = new Date().toISOString().split('T')[0];
      if (paymentStatus === 'UNPAID') {
        query.amountPaid = 0;
        query.status = { $nin: ['DRAFT', 'CANCELLED'] };
      } else if (paymentStatus === 'PARTIALLY_PAID') {
        query.status = 'PARTIALLY_PAID';
      } else if (paymentStatus === 'PAID') {
        query.status = 'PAID';
      } else if (paymentStatus === 'OVERDUE') {
        query.balanceDue = { $gt: 0 };
        query.dueDate = { $lt: todayStr };
        query.status = { $nin: ['DRAFT', 'CANCELLED'] };
      }
    }

    // 4. Date Range Filter
    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate) query.invoiceDate.$gte = startDate;
      if (endDate) query.invoiceDate.$lte = endDate;
    }

    // 5. Keyword Search
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      query.$or = [
        { invoiceNumber: { $regex: q, $options: 'i' } },
        { 'customerSnapshot.companyName': { $regex: q, $options: 'i' } },
        { 'customerSnapshot.contactPerson': { $regex: q, $options: 'i' } },
        { 'customerSnapshot.trn': { $regex: q, $options: 'i' } },
        { referenceNumber: { $regex: q, $options: 'i' } },
        { poNumber: { $regex: q, $options: 'i' } },
      ];
    }

    const p = Math.max(1, parseInt(page as string, 10));
    const limit = Math.max(1, Math.min(100, parseInt(pageSize as string, 10)));
    const skip = (p - 1) * limit;

    const [items, totalItems] = await Promise.all([
      Invoice.find(query).sort({ sequenceNumber: -1, createdAt: -1 }).skip(skip).limit(limit),
      Invoice.countDocuments(query),
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

export async function getInvoiceById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findById(id).populate('customerId');
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found.' });
      return;
    }
    res.json({ success: true, data: invoice });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function createInvoice(req: Request, res: Response): Promise<void> {
  try {
    const {
      customerId,
      invoiceDate,
      supplyDate,
      dueDate,
      paymentTermsDays,
      referenceNumber,
      poNumber,
      items,
      discountType,
      discountValue,
      notes,
      terms,
      status = 'DRAFT',
    } = req.body;

    if (!customerId || !invoiceDate || !supplyDate || !items || !items.length) {
      res.status(400).json({
        success: false,
        error: 'Customer, Invoice Date, Supply Date, and line items are required.',
      });
      return;
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      res.status(404).json({ success: false, error: 'Recipient customer entity not found.' });
      return;
    }

    // Allocate sequential invoice number
    const company = await CompanySettings.findOne();
    const prefix = company?.invoicePrefix || 'INV';
    const year = new Date(invoiceDate).getFullYear();

    const lastInvoice = await Invoice.findOne().sort({ sequenceNumber: -1 });
    const nextSeq = (lastInvoice?.sequenceNumber || 0) + 1;
    const invoiceNumber = `${prefix}-${year}-${String(nextSeq).padStart(5, '0')}`;

    // Perform UAE FTA calculation
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

    const newInvoice = await Invoice.create({
      organizationId: req.user?.organizationId || 'org_pixelflames_001',
      customerId: customer._id,
      invoiceNumber,
      sequenceNumber: nextSeq,
      invoiceDate,
      supplyDate,
      dueDate: dueDate || invoiceDate,
      paymentTermsDays: paymentTermsDays || 30,
      customerSnapshot: {
        companyName: customer.companyName,
        contactPerson: customer.contactPerson,
        email: customer.email,
        phone: customer.phone,
        trn: customer.trn,
        billingAddressLine1: customer.billingAddressLine1,
        billingCity: customer.billingCity,
        billingEmirate: customer.billingEmirate,
        billingCountry: 'United Arab Emirates',
      },
      items: docItems,
      subtotalNet: calc.subtotalNet,
      discountType: discountType || 'PERCENTAGE',
      discountValue: discountValue || 0,
      discountAmount: calc.discountAmount,
      vatTotal: calc.vatTotal,
      grandTotal: calc.grandTotal,
      amountPaid: 0,
      balanceDue: calc.grandTotal,
      status: status === 'ISSUED' ? 'ISSUED' : 'DRAFT',
      referenceNumber,
      poNumber,
      notes,
      terms,
      createdBy: req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : undefined,
    });

    await AuditLog.create({
      organizationId: req.user?.organizationId || 'org_pixelflames_001',
      entityType: 'INVOICE',
      entityId: newInvoice._id.toString(),
      action: status === 'ISSUED' ? 'ISSUED' : 'CREATED_DRAFT',
      performedByName: req.user?.name || 'System User',
      newValues: { invoiceNumber, grandTotal: calc.grandTotal, status },
    });

    res.status(201).json({ success: true, data: newInvoice });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateDraftInvoice(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findById(id);

    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found.' });
      return;
    }

    if (invoice.status !== 'DRAFT') {
      res.status(403).json({
        success: false,
        error: `Invoice ${invoice.invoiceNumber} has already been issued with status "${invoice.status}". Non-destructive editing of issued tax invoices is prohibited by UAE FTA. Issue a Credit Note instead.`,
      });
      return;
    }

    const {
      customerId,
      invoiceDate,
      supplyDate,
      dueDate,
      paymentTermsDays,
      referenceNumber,
      poNumber,
      items,
      discountType,
      discountValue,
      notes,
      terms,
    } = req.body;

    let customer = invoice.customerSnapshot;
    let customerIdObj = invoice.customerId;
    if (customerId && customerId !== invoice.customerId.toString()) {
      const custDoc = await Customer.findById(customerId);
      if (custDoc) {
        customerIdObj = custDoc._id;
        customer = {
          companyName: custDoc.companyName,
          contactPerson: custDoc.contactPerson,
          email: custDoc.email,
          phone: custDoc.phone,
          trn: custDoc.trn,
          billingAddressLine1: custDoc.billingAddressLine1,
          billingCity: custDoc.billingCity,
          billingEmirate: custDoc.billingEmirate,
          billingCountry: 'United Arab Emirates',
        };
      }
    }

    const calc = ServerVatCalculator.calculateDocument(items || invoice.items, discountType, discountValue);

    invoice.customerId = customerIdObj;
    invoice.customerSnapshot = customer;
    if (invoiceDate) invoice.invoiceDate = invoiceDate;
    if (supplyDate) invoice.supplyDate = supplyDate;
    if (dueDate) invoice.dueDate = dueDate;
    if (paymentTermsDays) invoice.paymentTermsDays = paymentTermsDays;
    if (referenceNumber !== undefined) invoice.referenceNumber = referenceNumber;
    if (poNumber !== undefined) invoice.poNumber = poNumber;
    if (notes !== undefined) invoice.notes = notes;
    if (terms !== undefined) invoice.terms = terms;

    if (items) {
      invoice.items = calc.items.map((it, idx) => ({
        itemOrder: idx + 1,
        description: items[idx]?.description || 'Item',
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
      })) as any;
    }

    invoice.subtotalNet = calc.subtotalNet;
    invoice.discountType = discountType || invoice.discountType;
    invoice.discountValue = discountValue !== undefined ? discountValue : invoice.discountValue;
    invoice.discountAmount = calc.discountAmount;
    invoice.vatTotal = calc.vatTotal;
    invoice.grandTotal = calc.grandTotal;
    invoice.balanceDue = calc.grandTotal - invoice.amountPaid;

    await invoice.save();
    res.json({ success: true, data: invoice });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function issueInvoice(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findById(id);

    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found.' });
      return;
    }

    if (invoice.status !== 'DRAFT') {
      res.status(400).json({ success: false, error: `Invoice is already ${invoice.status}.` });
      return;
    }

    invoice.status = 'ISSUED';
    await invoice.save();

    await AuditLog.create({
      organizationId: req.user?.organizationId || 'org_pixelflames_001',
      entityType: 'INVOICE',
      entityId: invoice._id.toString(),
      action: 'ISSUED',
      performedByName: req.user?.name || 'System User',
      newValues: { status: 'ISSUED', invoiceNumber: invoice.invoiceNumber },
    });

    res.json({ success: true, data: invoice });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function duplicateInvoice(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const orig = await Invoice.findById(id);

    if (!orig) {
      res.status(404).json({ success: false, error: 'Original invoice not found.' });
      return;
    }

    const company = await CompanySettings.findOne();
    const prefix = company?.invoicePrefix || 'INV';
    const year = new Date().getFullYear();

    const lastInvoice = await Invoice.findOne().sort({ sequenceNumber: -1 });
    const nextSeq = (lastInvoice?.sequenceNumber || 0) + 1;
    const invoiceNumber = `${prefix}-${year}-${String(nextSeq).padStart(5, '0')}`;

    const todayStr = new Date().toISOString().split('T')[0];

    const cloned = await Invoice.create({
      organizationId: orig.organizationId,
      customerId: orig.customerId,
      invoiceNumber,
      sequenceNumber: nextSeq,
      invoiceDate: todayStr,
      supplyDate: todayStr,
      dueDate: todayStr,
      paymentTermsDays: orig.paymentTermsDays,
      customerSnapshot: orig.customerSnapshot,
      items: orig.items.map((it: any) => ({
        ...(it.toObject ? it.toObject() : it),
        _id: new mongoose.Types.ObjectId(),
      })),
      subtotalNet: orig.subtotalNet,
      discountType: orig.discountType,
      discountValue: orig.discountValue,
      discountAmount: orig.discountAmount,
      vatTotal: orig.vatTotal,
      grandTotal: orig.grandTotal,
      amountPaid: 0,
      balanceDue: orig.grandTotal,
      status: 'DRAFT',
      referenceNumber: orig.referenceNumber ? `Copy of ${orig.referenceNumber}` : undefined,
      notes: orig.notes,
      terms: orig.terms,
      createdBy: req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : undefined,
    });

    res.status(201).json({ success: true, data: cloned });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function cancelInvoice(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({
        success: false,
        error: 'A detailed cancellation justification reason is mandatory by UAE FTA regulations.',
      });
      return;
    }

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found.' });
      return;
    }

    if (invoice.status === 'CANCELLED') {
      res.status(400).json({ success: false, error: 'Invoice is already cancelled.' });
      return;
    }

    if (invoice.amountPaid > 0) {
      res.status(400).json({
        success: false,
        error: `Cannot cancel an invoice with active recorded payments (AED ${invoice.amountPaid}). Reverse the payments first or issue a Credit Note.`,
      });
      return;
    }

    const oldStatus = invoice.status;
    invoice.status = 'CANCELLED';
    invoice.cancellationReason = reason.trim();
    invoice.cancelledAt = new Date();
    await invoice.save();

    await AuditLog.create({
      organizationId: req.user?.organizationId || 'org_pixelflames_001',
      entityType: 'INVOICE',
      entityId: invoice._id.toString(),
      action: 'CANCELLED',
      performedByName: req.user?.name || 'System User',
      oldValues: { status: oldStatus },
      newValues: { status: 'CANCELLED', reason: reason.trim() },
    });

    res.json({ success: true, data: invoice });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
