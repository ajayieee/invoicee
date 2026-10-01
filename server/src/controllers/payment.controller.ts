import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Payment } from '../models/Payment.js';
import { Invoice } from '../models/Invoice.js';
import { PaymentMethod } from '../models/PaymentMethod.js';
import { CompanySettings } from '../models/CompanySettings.js';
import { AuditLog } from '../models/AuditLog.js';

export async function getPayments(req: Request, res: Response): Promise<void> {
  try {
    const {
      search,
      status,
      paymentMethodId,
      customerId,
      invoiceId,
      startDate,
      endDate,
      page = '1',
      pageSize = '10',
    } = req.query;

    const query: any = {};

    if (status && status !== 'ALL') query.status = status;
    if (paymentMethodId && paymentMethodId !== 'ALL') query.paymentMethodId = paymentMethodId;
    if (customerId && customerId !== 'ALL') query.customerId = customerId;
    if (invoiceId) query.invoiceId = invoiceId;

    if (startDate || endDate) {
      query.paymentDate = {};
      if (startDate) query.paymentDate.$gte = startDate;
      if (endDate) query.paymentDate.$lte = endDate;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      query.$or = [
        { paymentNumber: { $regex: q, $options: 'i' } },
        { invoiceNumber: { $regex: q, $options: 'i' } },
        { customerName: { $regex: q, $options: 'i' } },
        { referenceNumber: { $regex: q, $options: 'i' } },
        { notes: { $regex: q, $options: 'i' } },
      ];
    }

    const p = Math.max(1, parseInt(page as string, 10));
    const limit = Math.max(1, Math.min(100, parseInt(pageSize as string, 10)));
    const skip = (p - 1) * limit;

    const [items, totalItems] = await Promise.all([
      Payment.find(query).sort({ sequenceNumber: -1, createdAt: -1 }).skip(skip).limit(limit),
      Payment.countDocuments(query),
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

export async function recordPayment(req: Request, res: Response): Promise<void> {
  try {
    const {
      invoiceId,
      paymentMethodId,
      amount,
      paymentDate,
      referenceNumber,
      notes,
      paymentProofUrl,
      paymentProofName,
      allowDuplicate,
    } = req.body;

    const payAmount = Number(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      res.status(400).json({ success: false, error: 'Payment amount must be greater than zero.' });
      return;
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found.' });
      return;
    }

    if (invoice.status === 'CANCELLED' || invoice.status === 'DRAFT') {
      res.status(400).json({
        success: false,
        error: `Cannot record payment against an invoice with status "${invoice.status}".`,
      });
      return;
    }

    if (payAmount > invoice.balanceDue) {
      res.status(400).json({
        success: false,
        error: `Payment amount (AED ${payAmount.toFixed(2)}) exceeds invoice outstanding balance (AED ${invoice.balanceDue.toFixed(2)}).`,
      });
      return;
    }

    const paymentMethod = await PaymentMethod.findById(paymentMethodId);
    if (!paymentMethod) {
      res.status(404).json({ success: false, error: 'Payment method not found.' });
      return;
    }

    // Duplicate payment check
    if (!allowDuplicate) {
      const activePayments = await Payment.find({ invoiceId, status: 'RECORDED' });
      const targetDate = paymentDate || new Date().toISOString().split('T')[0];

      if (referenceNumber && referenceNumber.trim()) {
        const refMatch = activePayments.find(
          (p) => p.referenceNumber?.toLowerCase() === referenceNumber.trim().toLowerCase()
        );
        if (refMatch) {
          res.status(409).json({
            success: false,
            error: `Potential duplicate payment detected: An active receipt (#${refMatch.paymentNumber}) with reference "${referenceNumber}" for AED ${refMatch.amount.toFixed(2)} was already recorded on ${refMatch.paymentDate}.`,
          });
          return;
        }
      }

      const sameAmountDate = activePayments.find(
        (p) => p.amount === payAmount && p.paymentDate === targetDate
      );
      if (sameAmountDate) {
        res.status(409).json({
          success: false,
          error: `Potential duplicate payment detected: A payment of AED ${payAmount.toFixed(2)} was already recorded today (${targetDate}) under receipt #${sameAmountDate.paymentNumber}. Confirm duplicate override if intentional.`,
        });
        return;
      }
    }

    const company = await CompanySettings.findOne();
    const prefix = company?.paymentPrefix || 'PAY';
    const lastPayment = await Payment.findOne().sort({ sequenceNumber: -1 });
    const nextSeq = (lastPayment?.sequenceNumber || 0) + 1;
    const year = new Date().getFullYear();
    const paymentNumber = `${prefix}-${year}-${String(nextSeq).padStart(5, '0')}`;

    const newPayment = await Payment.create({
      organizationId: invoice.organizationId,
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      customerName: invoice.customerSnapshot.companyName || invoice.customerSnapshot.contactPerson,
      paymentNumber,
      sequenceNumber: nextSeq,
      paymentDate: paymentDate || new Date().toISOString().split('T')[0],
      paymentMethodId: paymentMethod._id,
      paymentMethodName: paymentMethod.name,
      amount: payAmount,
      currency: 'AED',
      referenceNumber: referenceNumber?.trim(),
      notes: notes?.trim(),
      paymentProofUrl,
      paymentProofName,
      status: 'RECORDED',
      createdBy: req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : undefined,
    });

    // Update invoice paid & balance due
    const newPaid = Number((invoice.amountPaid + payAmount).toFixed(2));
    const newBalance = Number(Math.max(0, invoice.grandTotal - newPaid).toFixed(2));

    invoice.amountPaid = newPaid;
    invoice.balanceDue = newBalance;
    invoice.status = newBalance === 0 ? 'PAID' : 'PARTIALLY_PAID';
    await invoice.save();

    await AuditLog.create({
      organizationId: invoice.organizationId,
      entityType: 'PAYMENT',
      entityId: newPayment._id.toString(),
      action: 'RECORDED',
      performedByName: req.user?.name || 'System User',
      newValues: { paymentNumber, amount: payAmount, invoiceNumber: invoice.invoiceNumber },
    });

    res.status(201).json({ success: true, data: newPayment });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function reversePayment(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({
        success: false,
        error: 'A detailed reason is mandatory to reverse a payment in the accounting ledger.',
      });
      return;
    }

    const payment = await Payment.findById(id);
    if (!payment) {
      res.status(404).json({ success: false, error: 'Payment not found.' });
      return;
    }

    if (payment.status === 'REVERSED') {
      res.status(400).json({ success: false, error: 'Payment has already been reversed.' });
      return;
    }

    payment.status = 'REVERSED';
    payment.reversalReason = reason.trim();
    payment.reversedAt = new Date();
    payment.reversedBy = req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : undefined;
    await payment.save();

    // Reopen invoice balance
    const invoice = await Invoice.findById(payment.invoiceId);
    if (invoice) {
      const newPaid = Number(Math.max(0, invoice.amountPaid - payment.amount).toFixed(2));
      const newBalance = Number((invoice.grandTotal - newPaid).toFixed(2));
      invoice.amountPaid = newPaid;
      invoice.balanceDue = newBalance;

      const isOverdue = new Date(invoice.dueDate) < new Date();
      if (newBalance === 0) {
        invoice.status = 'PAID';
      } else if (newPaid > 0) {
        invoice.status = 'PARTIALLY_PAID';
      } else {
        invoice.status = isOverdue ? 'OVERDUE' : 'ISSUED';
      }
      await invoice.save();
    }

    await AuditLog.create({
      organizationId: payment.organizationId,
      entityType: 'PAYMENT',
      entityId: payment._id.toString(),
      action: 'REVERSED',
      performedByName: req.user?.name || 'System User',
      newValues: { status: 'REVERSED', reason: reason.trim() },
    });

    res.json({ success: true, data: payment });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
