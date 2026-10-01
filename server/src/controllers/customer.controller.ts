import { Request, Response } from 'express';
import { Customer } from '../models/Customer.js';
import { Invoice } from '../models/Invoice.js';
import { Quote } from '../models/Quote.js';
import { Payment } from '../models/Payment.js';
import { CreditNote } from '../models/CreditNote.js';

export async function getCustomers(req: Request, res: Response): Promise<void> {
  try {
    const { search, relationType, emirate, page = '1', pageSize = '10' } = req.query;

    const query: any = {};
    if (relationType && relationType !== 'ALL') query.relationType = relationType;
    if (emirate && emirate !== 'ALL') query.billingEmirate = emirate;

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

    const p = Math.max(1, parseInt(page as string, 10));
    const limit = Math.max(1, Math.min(100, parseInt(pageSize as string, 10)));
    const skip = (p - 1) * limit;

    const [items, totalItems] = await Promise.all([
      Customer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Customer.countDocuments(query),
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

export async function getCustomerById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const customer = await Customer.findById(id);
    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found.' });
      return;
    }
    res.json({ success: true, data: customer });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getCustomer360(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const customer = await Customer.findById(id);
    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found.' });
      return;
    }

    const [invoices, quotes, payments, creditNotes] = await Promise.all([
      Invoice.find({ customerId: customer._id }).sort({ invoiceDate: -1 }),
      Quote.find({ customerId: customer._id }).sort({ quoteDate: -1 }),
      Payment.find({ customerId: customer._id, status: 'RECORDED' }).sort({ paymentDate: -1 }),
      CreditNote.find({ customerId: customer._id, status: { $ne: 'CANCELLED' } }).sort({
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
        if (inv.status === 'OVERDUE') overdueCount++;
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function createCustomer(req: Request, res: Response): Promise<void> {
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

    const customer = await Customer.create({
      ...data,
      organizationId: (req as any).user?.organizationId || 'org_pixelflames_001',
    });

    res.status(201).json({ success: true, data: customer });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateCustomer(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const customer = await Customer.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found.' });
      return;
    }
    res.json({ success: true, data: customer });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function deleteCustomer(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const invCount = await Invoice.countDocuments({ customerId: id });
    if (invCount > 0) {
      res.status(400).json({
        success: false,
        error: `Cannot delete entity: ${invCount} tax invoice(s) exist for this account. In accordance with UAE accounting regulations, financial records cannot be orphaned. Deactivate the account instead.`,
      });
      return;
    }

    const quoteCount = await Quote.countDocuments({ customerId: id });
    if (quoteCount > 0) {
      res.status(400).json({
        success: false,
        error: `Cannot delete entity: ${quoteCount} quotation(s) are linked to this client. Deactivate the account instead.`,
      });
      return;
    }

    await Customer.findByIdAndDelete(id);
    res.json({ success: true, message: 'Customer account deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
