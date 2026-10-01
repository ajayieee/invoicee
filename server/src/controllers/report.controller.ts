import { Request, Response } from 'express';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';
import { CreditNote } from '../models/CreditNote.js';
import { Quote } from '../models/Quote.js';
import { Customer } from '../models/Customer.js';

export async function getDashboardMetrics(req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentYearStr = `${now.getFullYear()}`;
    const todayStr = now.toISOString().split('T')[0];

    const [invoices, payments, quotes] = await Promise.all([
      Invoice.find({ status: { $ne: 'CANCELLED' } }),
      Payment.find({ status: 'RECORDED' }),
      Quote.find(),
    ]);

    let revenueThisMonth = 0;
    let revenueThisYear = 0;
    let outstandingReceivables = 0;
    let overdueReceivables = 0;
    let vatCollected = 0;

    for (const inv of invoices) {
      if (inv.status !== 'DRAFT') {
        if (inv.invoiceDate.startsWith(currentMonthStr)) {
          revenueThisMonth += inv.grandTotal;
        }
        if (inv.invoiceDate.startsWith(currentYearStr)) {
          revenueThisYear += inv.grandTotal;
        }

        outstandingReceivables += inv.balanceDue;

        if (inv.dueDate < todayStr && inv.balanceDue > 0) {
          overdueReceivables += inv.balanceDue;
        }

        vatCollected += inv.vatTotal;
      }
    }

    let paidThisMonth = 0;
    for (const p of payments) {
      if (p.paymentDate.startsWith(currentMonthStr)) {
        paidThisMonth += p.amount;
      }
    }

    const openQuotes = quotes.filter((q) => q.status === 'SENT' || q.status === 'DRAFT');
    const quotationPipelineValue = openQuotes.reduce((s, q) => s + q.grandTotal, 0);

    res.json({
      success: true,
      data: {
        revenueThisMonth: Math.round(revenueThisMonth * 100) / 100,
        revenueThisYear: Math.round(revenueThisYear * 100) / 100,
        outstandingReceivables: Math.round(outstandingReceivables * 100) / 100,
        overdueReceivables: Math.round(overdueReceivables * 100) / 100,
        paidThisMonth: Math.round(paidThisMonth * 100) / 100,
        vatCollected: Math.round(vatCollected * 100) / 100,
        openQuotesCount: openQuotes.length,
        quotationPipelineValue: Math.round(quotationPipelineValue * 100) / 100,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getCustomerStatement(req: Request, res: Response): Promise<void> {
  try {
    const { customerId, startDate, endDate } = req.query;

    if (!customerId) {
      res.status(400).json({ success: false, error: 'Customer ID is required.' });
      return;
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found.' });
      return;
    }

    const [invoices, payments, creditNotes] = await Promise.all([
      Invoice.find({ customerId: customer._id, status: { $nin: ['DRAFT', 'CANCELLED'] } }).sort({
        invoiceDate: 1,
      }),
      Payment.find({ customerId: customer._id, status: 'RECORDED' }).sort({ paymentDate: 1 }),
      CreditNote.find({ customerId: customer._id, status: { $ne: 'CANCELLED' } }).sort({
        creditNoteDate: 1,
      }),
    ]);

    const ledger: Array<{
      date: string;
      type: 'Tax Invoice' | 'Payment' | 'Credit Note';
      reference: string;
      description: string;
      debit: number;
      credit: number;
      runningBalance: number;
    }> = [];

    invoices.forEach((inv) => {
      ledger.push({
        date: inv.invoiceDate,
        type: 'Tax Invoice',
        reference: inv.invoiceNumber,
        description: `Tax Invoice - ${inv.items.length} line item(s)`,
        debit: inv.grandTotal,
        credit: 0,
        runningBalance: 0,
      });
    });

    payments.forEach((p) => {
      ledger.push({
        date: p.paymentDate,
        type: 'Payment',
        reference: p.paymentNumber,
        description: `Payment received via ${p.paymentMethodName} (Inv: ${p.invoiceNumber})`,
        debit: 0,
        credit: p.amount,
        runningBalance: 0,
      });
    });

    creditNotes.forEach((cn) => {
      ledger.push({
        date: cn.creditNoteDate,
        type: 'Credit Note',
        reference: cn.creditNoteNumber,
        description: `Credit Note against ${cn.invoiceNumber}: ${cn.reason}`,
        debit: 0,
        credit: cn.grandTotal,
        runningBalance: 0,
      });
    });

    // Sort chronologically
    ledger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = 0;
    ledger.forEach((row) => {
      running += row.debit - row.credit;
      row.runningBalance = Math.round(running * 100) / 100;
    });

    const totalDebits = ledger.reduce((s, r) => s + r.debit, 0);
    const totalCredits = ledger.reduce((s, r) => s + r.credit, 0);

    res.json({
      success: true,
      data: {
        customer,
        openingBalance: 0,
        closingBalance: Math.round(running * 100) / 100,
        totalDebits: Math.round(totalDebits * 100) / 100,
        totalCredits: Math.round(totalCredits * 100) / 100,
        ledger,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
