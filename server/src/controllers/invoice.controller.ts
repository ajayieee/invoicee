import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Invoice } from '../models/Invoice.js';
import { Customer } from '../models/Customer.js';
import { CompanySettings } from '../models/CompanySettings.js';
import { AuditLog } from '../models/AuditLog.js';
import { ServerVatCalculator } from '../utils/vatCalculator.js';

export function serializeInvoice(doc: any) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  const id = obj._id ? obj._id.toString() : obj.id;
  const customerId = obj.customerId
    ? (obj.customerId._id ? obj.customerId._id.toString() : obj.customerId.toString())
    : '';

  const items = (obj.items || []).map((it: any, idx: number) => ({
    id: it._id ? it._id.toString() : (it.id || `item-${idx}`),
    _id: it._id ? it._id.toString() : (it.id || `item-${idx}`),
    item_order: it.itemOrder ?? it.item_order ?? idx + 1,
    itemOrder: it.itemOrder ?? it.item_order ?? idx + 1,
    description: it.description || '',
    quantity: Number(it.quantity ?? 1),
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
    vat_rate_percentage: Number(it.vatRatePercentage ?? it.vat_rate_percentage ?? 5.0),
    vatRatePercentage: Number(it.vatRatePercentage ?? it.vat_rate_percentage ?? 5.0),
    vat_rate_id: it.vatRateId || it.vat_rate_id || 'vat-standard',
    vat_treatment: it.vatTreatment || it.vat_treatment || 'STANDARD_RATED',
    vatTreatment: it.vatTreatment || it.vat_treatment || 'STANDARD_RATED',
    vat_amount: Number(it.vatAmount ?? it.vat_amount ?? 0),
    vatAmount: Number(it.vatAmount ?? it.vat_amount ?? 0),
    total_gross: Number(it.totalGross ?? it.total_gross ?? 0),
    totalGross: Number(it.totalGross ?? it.total_gross ?? 0),
    product_id: it.productId ? it.productId.toString() : it.product_id,
    productId: it.productId ? it.productId.toString() : it.product_id,
  }));

  const customerSnapshot = obj.customerSnapshot || {};
  const serializedSnapshot = {
    ...customerSnapshot,
    company_name: customerSnapshot.companyName || customerSnapshot.company_name || '',
    companyName: customerSnapshot.companyName || customerSnapshot.company_name || '',
    contact_person: customerSnapshot.contactPerson || customerSnapshot.contact_person || '',
    contactPerson: customerSnapshot.contactPerson || customerSnapshot.contact_person || '',
    email: customerSnapshot.email || '',
    phone: customerSnapshot.phone || '',
    trn: customerSnapshot.trn || '',
    billing_address_line_1: customerSnapshot.billingAddressLine1 || customerSnapshot.billing_address_line_1 || '',
    billingAddressLine1: customerSnapshot.billingAddressLine1 || customerSnapshot.billing_address_line_1 || '',
    billing_city: customerSnapshot.billingCity || customerSnapshot.billing_city || 'Dubai',
    billingCity: customerSnapshot.billingCity || customerSnapshot.billing_city || 'Dubai',
    billing_emirate: customerSnapshot.billingEmirate || customerSnapshot.billing_emirate || 'DUBAI',
    billingEmirate: customerSnapshot.billingEmirate || customerSnapshot.billing_emirate || 'DUBAI',
    billing_country: customerSnapshot.billingCountry || customerSnapshot.billing_country || 'United Arab Emirates',
    billingCountry: customerSnapshot.billingCountry || customerSnapshot.billing_country || 'United Arab Emirates',
  };

  return {
    ...obj,
    id,
    _id: id,
    customer_id: customerId,
    customerId,
    invoice_number: obj.invoiceNumber || obj.invoice_number,
    invoiceNumber: obj.invoiceNumber || obj.invoice_number,
    sequence_number: obj.sequenceNumber ?? obj.sequence_number ?? 1,
    sequenceNumber: obj.sequenceNumber ?? obj.sequence_number ?? 1,
    invoice_date: obj.invoiceDate || obj.invoice_date,
    invoiceDate: obj.invoiceDate || obj.invoice_date,
    supply_date: obj.supplyDate || obj.supply_date,
    supplyDate: obj.supplyDate || obj.supply_date,
    due_date: obj.dueDate || obj.due_date,
    dueDate: obj.dueDate || obj.due_date,
    payment_terms_days: obj.paymentTermsDays ?? obj.payment_terms_days ?? 30,
    paymentTermsDays: obj.paymentTermsDays ?? obj.payment_terms_days ?? 30,
    reference_number: obj.referenceNumber ?? obj.reference_number ?? '',
    referenceNumber: obj.referenceNumber ?? obj.reference_number ?? '',
    po_number: obj.poNumber ?? obj.po_number ?? '',
    poNumber: obj.poNumber ?? obj.po_number ?? '',
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
    amount_paid: Number(obj.amountPaid ?? obj.amount_paid ?? 0),
    amountPaid: Number(obj.amountPaid ?? obj.amount_paid ?? 0),
    balance_due: Number(obj.balanceDue ?? obj.balance_due ?? 0),
    balanceDue: Number(obj.balanceDue ?? obj.balance_due ?? 0),
    status: obj.status,
    currency: obj.currency || 'AED',
    exchange_rate: obj.exchangeRate ?? obj.exchange_rate ?? 1.0,
    notes: obj.notes || '',
    terms: obj.terms || '',
    e_invoice_status: obj.eInvoiceStatus || obj.e_invoice_status || 'NOT_APPLICABLE',
    customer_snapshot: serializedSnapshot,
    customerSnapshot: serializedSnapshot,
    items,
    created_at: obj.createdAt ? new Date(obj.createdAt).toISOString() : new Date().toISOString(),
    updated_at: obj.updatedAt ? new Date(obj.updatedAt).toISOString() : new Date().toISOString(),
  };
}

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
      if (mongoose.Types.ObjectId.isValid(customerId as string)) {
        query.customerId = customerId;
      }
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
    const limit = Math.max(1, Math.min(1000, parseInt(pageSize as string, 10)));
    const skip = (p - 1) * limit;

    const [rawItems, totalItems] = await Promise.all([
      Invoice.find(query).sort({ sequenceNumber: -1, createdAt: -1 }).skip(skip).limit(limit),
      Invoice.countDocuments(query),
    ]);

    const items = rawItems.map(serializeInvoice);
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
    let invoice = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      invoice = await Invoice.findById(id).populate('customerId');
    }
    if (!invoice) {
      invoice = await Invoice.findOne({ invoiceNumber: id }).populate('customerId');
    }

    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found.' });
      return;
    }
    res.json({ success: true, data: serializeInvoice(invoice) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function createInvoice(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body;
    const customerId = body.customerId || body.customer_id;
    const invoiceDate = body.invoiceDate || body.invoice_date;
    const supplyDate = body.supplyDate || body.supply_date;
    const dueDate = body.dueDate || body.due_date;
    const paymentTermsDays = Number(body.paymentTermsDays ?? body.payment_terms_days ?? 30);
    const referenceNumber = body.referenceNumber || body.reference_number || '';
    const poNumber = body.poNumber || body.po_number || '';
    const items = body.items;
    const discountType = body.discountType || body.discount_type || 'PERCENTAGE';
    const discountValue = Number(body.discountValue ?? body.discount_value ?? 0);
    const notes = body.notes || '';
    const terms = body.terms || '';
    const status = body.status === 'ISSUED' ? 'ISSUED' : 'DRAFT';

    if (!customerId || !invoiceDate || !supplyDate || !items || !items.length) {
      res.status(400).json({
        success: false,
        error: 'Customer, Invoice Date, Supply Date, and line items are required.',
      });
      return;
    }

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

    // Auto-create or resolve customer from snapshot if provided
    if (!customer && (body.customerSnapshot || body.customer_snapshot)) {
      const snap = body.customerSnapshot || body.customer_snapshot;
      customer = await Customer.create({
        organizationId: req.user?.organizationId || 'org_pixelflames_001',
        customerType: snap.customerType || snap.customer_type || 'COMPANY',
        companyName: snap.companyName || snap.company_name,
        contactPerson: snap.contactPerson || snap.contact_person || 'Client',
        email: snap.email,
        phone: snap.phone,
        trn: snap.trn,
        billingEmirate: snap.billingEmirate || snap.billing_emirate || 'DUBAI',
        billingAddressLine1: snap.billingAddressLine1 || snap.billing_address_line_1,
        billingCity: snap.billingCity || snap.billing_city || 'Dubai',
        paymentTermsDays: snap.paymentTermsDays || snap.payment_terms_days || 30,
      });
    }

    if (!customer) {
      // Create fallback customer so invoice creation never fails
      customer = await Customer.create({
        organizationId: req.user?.organizationId || 'org_pixelflames_001',
        customerType: 'COMPANY',
        companyName: typeof customerId === 'string' ? customerId : 'Registered Customer',
        contactPerson: 'Accounts Payable',
        billingEmirate: 'DUBAI',
        billingCity: 'Dubai',
        paymentTermsDays: 30,
      });
    }

    // Allocate sequential invoice number
    const company = await CompanySettings.findOne();
    const prefix = company?.invoicePrefix || 'INV';
    const year = new Date(invoiceDate).getFullYear();

    const lastInvoice = await Invoice.findOne().sort({ sequenceNumber: -1 });
    const nextSeq = (lastInvoice?.sequenceNumber || 0) + 1;
    const invoiceNumber = `${prefix}-${year}-${String(nextSeq).padStart(4, '0')}`;

    // Normalize line items for server VAT calculation
    const calcInputs = items.map((it: any) => ({
      quantity: Number(it.quantity ?? 1),
      unitPrice: Number(it.unitPrice ?? it.unit_price ?? 0),
      discountType: it.discountType || it.discount_type || 'PERCENTAGE',
      discountValue: Number(it.discountValue ?? it.discount_value ?? 0),
      vatRatePercentage: Number(it.vatRatePercentage ?? it.vat_rate_percentage ?? 5.0),
      vatTreatment: it.vatTreatment || it.vat_treatment || 'STANDARD_RATED',
    }));

    const calc = ServerVatCalculator.calculateDocument(calcInputs, discountType, discountValue);

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
      productId: items[idx]?.productId || items[idx]?.product_id
        ? (mongoose.Types.ObjectId.isValid(items[idx].productId || items[idx].product_id)
            ? new mongoose.Types.ObjectId(items[idx].productId || items[idx].product_id)
            : undefined)
        : undefined,
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
      discountType,
      discountValue,
      discountAmount: calc.discountAmount,
      vatTotal: calc.vatTotal,
      grandTotal: calc.grandTotal,
      amountPaid: 0,
      balanceDue: calc.grandTotal,
      status,
      referenceNumber,
      poNumber,
      notes,
      terms,
      createdBy: req.user?.userId && mongoose.Types.ObjectId.isValid(req.user.userId)
        ? new mongoose.Types.ObjectId(req.user.userId)
        : undefined,
    });

    await AuditLog.create({
      organizationId: req.user?.organizationId || 'org_pixelflames_001',
      entityType: 'INVOICE',
      entityId: newInvoice._id.toString(),
      action: status === 'ISSUED' ? 'ISSUED' : 'CREATED_DRAFT',
      performedByName: req.user?.name || 'System User',
      newValues: { invoiceNumber, grandTotal: calc.grandTotal, status },
    });

    res.status(201).json({ success: true, data: serializeInvoice(newInvoice) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateDraftInvoice(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    let invoice = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      invoice = await Invoice.findById(id);
    }
    if (!invoice) {
      invoice = await Invoice.findOne({ invoiceNumber: id });
    }

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

    const body = req.body;
    const customerId = body.customerId || body.customer_id;
    const invoiceDate = body.invoiceDate || body.invoice_date;
    const supplyDate = body.supplyDate || body.supply_date;
    const dueDate = body.dueDate || body.due_date;
    const paymentTermsDays = body.paymentTermsDays ?? body.payment_terms_days;
    const referenceNumber = body.referenceNumber || body.reference_number;
    const poNumber = body.poNumber || body.po_number;
    const items = body.items;
    const discountType = body.discountType || body.discount_type || invoice.discountType;
    const discountValue = body.discountValue !== undefined ? Number(body.discountValue) : invoice.discountValue;
    const notes = body.notes !== undefined ? body.notes : invoice.notes;
    const terms = body.terms !== undefined ? body.terms : invoice.terms;

    let customer = invoice.customerSnapshot;
    let customerIdObj = invoice.customerId;
    if (customerId && customerId !== invoice.customerId.toString()) {
      let custDoc = null;
      if (mongoose.Types.ObjectId.isValid(customerId)) {
        custDoc = await Customer.findById(customerId);
      }
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

    const targetItems = items || invoice.items;
    const calcInputs = targetItems.map((it: any) => ({
      quantity: Number(it.quantity ?? 1),
      unitPrice: Number(it.unitPrice ?? it.unit_price ?? 0),
      discountType: it.discountType || it.discount_type || 'PERCENTAGE',
      discountValue: Number(it.discountValue ?? it.discount_value ?? 0),
      vatRatePercentage: Number(it.vatRatePercentage ?? it.vat_rate_percentage ?? 5.0),
      vatTreatment: it.vatTreatment || it.vat_treatment || 'STANDARD_RATED',
    }));

    const calc = ServerVatCalculator.calculateDocument(calcInputs, discountType, discountValue);

    invoice.customerId = customerIdObj;
    invoice.customerSnapshot = customer;
    if (invoiceDate) invoice.invoiceDate = invoiceDate;
    if (supplyDate) invoice.supplyDate = supplyDate;
    if (dueDate) invoice.dueDate = dueDate;
    if (paymentTermsDays !== undefined) invoice.paymentTermsDays = Number(paymentTermsDays);
    if (referenceNumber !== undefined) invoice.referenceNumber = referenceNumber;
    if (poNumber !== undefined) invoice.poNumber = poNumber;
    if (notes !== undefined) invoice.notes = notes;
    if (terms !== undefined) invoice.terms = terms;

    invoice.items = calc.items.map((it, idx) => ({
      itemOrder: idx + 1,
      description: targetItems[idx]?.description || 'Item',
      quantity: it.quantity,
      unit: targetItems[idx]?.unit || 'Unit',
      unitPrice: it.unitPrice,
      discountType: it.discountType,
      discountValue: it.discountValue,
      discountAmount: it.discountAmount,
      subtotalNet: it.subtotalNet,
      vatRatePercentage: it.vatRatePercentage,
      vatTreatment: it.vatTreatment as any,
      vatAmount: it.vatAmount,
      totalGross: it.totalGross,
      productId: targetItems[idx]?.productId || targetItems[idx]?.product_id
        ? (mongoose.Types.ObjectId.isValid(targetItems[idx].productId || targetItems[idx].product_id)
            ? new mongoose.Types.ObjectId(targetItems[idx].productId || targetItems[idx].product_id)
            : undefined)
        : undefined,
    })) as any;

    invoice.subtotalNet = calc.subtotalNet;
    invoice.discountType = discountType;
    invoice.discountValue = discountValue;
    invoice.discountAmount = calc.discountAmount;
    invoice.vatTotal = calc.vatTotal;
    invoice.grandTotal = calc.grandTotal;
    invoice.balanceDue = calc.grandTotal - invoice.amountPaid;

    await invoice.save();
    res.json({ success: true, data: serializeInvoice(invoice) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function issueInvoice(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    let invoice = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      invoice = await Invoice.findById(id);
    }
    if (!invoice) {
      invoice = await Invoice.findOne({ invoiceNumber: id });
    }

    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found.' });
      return;
    }

    if (invoice.status !== 'DRAFT') {
      res.json({ success: true, data: serializeInvoice(invoice) });
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

    res.json({ success: true, data: serializeInvoice(invoice) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function duplicateInvoice(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    let orig = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      orig = await Invoice.findById(id);
    }
    if (!orig) {
      orig = await Invoice.findOne({ invoiceNumber: id });
    }

    if (!orig) {
      res.status(404).json({ success: false, error: 'Original invoice not found.' });
      return;
    }

    const company = await CompanySettings.findOne();
    const prefix = company?.invoicePrefix || 'INV';
    const year = new Date().getFullYear();

    const lastInvoice = await Invoice.findOne().sort({ sequenceNumber: -1 });
    const nextSeq = (lastInvoice?.sequenceNumber || 0) + 1;
    const invoiceNumber = `${prefix}-${year}-${String(nextSeq).padStart(4, '0')}`;

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
      createdBy: req.user?.userId && mongoose.Types.ObjectId.isValid(req.user.userId)
        ? new mongoose.Types.ObjectId(req.user.userId)
        : undefined,
    });

    res.status(201).json({ success: true, data: serializeInvoice(cloned) });
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

    let invoice = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      invoice = await Invoice.findById(id);
    }
    if (!invoice) {
      invoice = await Invoice.findOne({ invoiceNumber: id });
    }

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

    res.json({ success: true, data: serializeInvoice(invoice) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
