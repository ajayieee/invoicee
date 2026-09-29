import { Payment, PaymentMethod, PaymentStatus, Invoice } from '@/types/database';
import { PaginatedResult, ServiceResponse } from '@/types/service';
import { db } from '@/lib/db/repository';

export interface PaymentQuery {
  search?: string;
  status?: PaymentStatus | 'ALL';
  paymentMethodId?: string | 'ALL';
  customerId?: string | 'ALL';
  invoiceId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface RecordPaymentPayload {
  invoice_id: string;
  payment_method_id: string;
  amount: number;
  payment_date?: string;
  reference_number?: string;
  notes?: string;
  payment_proof_url?: string;
  payment_proof_name?: string;
  allow_duplicate?: boolean;
}

class PaymentService {
  /**
   * Fetches active payment methods (Bank Transfer, Cash, Credit Card, Debit Card, Cheque, Other).
   */
  public getPaymentMethods(): PaymentMethod[] {
    return db.getPaymentMethods().filter((p) => p.is_active);
  }

  /**
   * Retrieves payments with search, multi-field filtering, and pagination.
   */
  public getPayments(query: PaymentQuery = {}): PaginatedResult<Payment> {
    const {
      search = '',
      status = 'ALL',
      paymentMethodId = 'ALL',
      customerId = 'ALL',
      invoiceId,
      startDate,
      endDate,
      page = 1,
      pageSize = 10,
    } = query;

    let items = db.getPayments();

    // 1. Status Filter
    if (status && status !== 'ALL') {
      items = items.filter((p) => p.status === status);
    }

    // 2. Payment Method Filter
    if (paymentMethodId && paymentMethodId !== 'ALL') {
      items = items.filter((p) => p.payment_method_id === paymentMethodId);
    }

    // 3. Customer Filter
    if (customerId && customerId !== 'ALL') {
      items = items.filter((p) => p.customer_id === customerId);
    }

    // 4. Invoice Filter
    if (invoiceId) {
      items = items.filter((p) => p.invoice_id === invoiceId);
    }

    // 5. Date Range Filter
    if (startDate) {
      items = items.filter((p) => p.payment_date >= startDate);
    }
    if (endDate) {
      items = items.filter((p) => p.payment_date <= endDate);
    }

    // 6. Search Filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter((p) => {
        const numMatch = p.payment_number.toLowerCase().includes(q);
        const invMatch = (p.invoice_number || '').toLowerCase().includes(q);
        const custMatch = (p.customer_name || '').toLowerCase().includes(q);
        const refMatch = (p.reference_number || '').toLowerCase().includes(q);
        const notesMatch = (p.notes || '').toLowerCase().includes(q);
        return numMatch || invMatch || custMatch || refMatch || notesMatch;
      });
    }

    // Sort descending by payment date and creation
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = items.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const validPage = Math.max(1, Math.min(page, totalPages));
    const startIndex = (validPage - 1) * pageSize;
    const paginatedItems = items.slice(startIndex, startIndex + pageSize);

    return {
      items: paginatedItems,
      totalItems: total,
      currentPage: validPage,
      pageSize,
      totalPages,
    };
  }

  /**
   * Fetches payment by ID.
   */
  public getPaymentById(id: string): Payment | undefined {
    return db.getPayments().find((p) => p.id === id);
  }

  /**
   * Provides payment history on a specific invoice.
   */
  public getPaymentsByInvoice(invoiceId: string): Payment[] {
    return db
      .getPayments()
      .filter((p) => p.invoice_id === invoiceId)
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
  }

  /**
   * Provides payment history for a specific customer.
   */
  public getPaymentsByCustomer(customerId: string): Payment[] {
    return db
      .getPayments()
      .filter((p) => p.customer_id === customerId)
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
  }

  /**
   * Records a payment against an invoice.
   * Includes duplicate payment prevention, anti-overpayment check, and status update.
   */
  public recordPayment(input: RecordPaymentPayload): ServiceResponse<Payment> {
    const inv = db.getInvoiceById(input.invoice_id);
    if (!inv) {
      return { success: false, error: 'Target invoice not found.' };
    }

    if (inv.status === 'CANCELLED') {
      return { success: false, error: 'Cannot record payment against a cancelled invoice.' };
    }

    if (inv.status === 'DRAFT') {
      return { success: false, error: 'Cannot record payment against an unissued draft invoice. Issue the invoice first.' };
    }

    const payAmount = Number(input.amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      return { success: false, error: 'Payment amount must be greater than zero.' };
    }

    if (!input.payment_method_id) {
      return { success: false, error: 'Please select a valid payment method.' };
    }

    // Anti-overpayment guard
    if (payAmount > inv.balance_due) {
      return {
        success: false,
        error: `Payment amount (AED ${payAmount.toFixed(2)}) exceeds invoice outstanding balance (AED ${inv.balance_due.toFixed(2)}). Overpayments are not permitted.`,
      };
    }

    // Duplicate Payment Prevention Guard
    if (!input.allow_duplicate) {
      const activePayments = this.getPaymentsByInvoice(inv.id).filter(
        (p) => p.status === 'RECORDED'
      );

      const cleanRef = input.reference_number?.trim();
      const targetDate = input.payment_date || new Date().toISOString().split('T')[0];

      // Check 1: Matching non-empty reference on same invoice
      if (cleanRef) {
        const refMatch = activePayments.find(
          (p) => p.reference_number?.trim().toLowerCase() === cleanRef.toLowerCase()
        );
        if (refMatch) {
          return {
            success: false,
            error: `Potential duplicate payment detected: An active payment (#${refMatch.payment_number}) with reference '${cleanRef}' for AED ${refMatch.amount.toFixed(2)} was already recorded on ${refMatch.payment_date}.`,
          };
        }
      }

      // Check 2: Exact same amount on the same payment date
      const sameAmountDateMatch = activePayments.find(
        (p) => p.amount === payAmount && p.payment_date === targetDate
      );
      if (sameAmountDateMatch) {
        return {
          success: false,
          error: `Potential duplicate payment detected: A payment of AED ${payAmount.toFixed(2)} was already recorded today (${targetDate}) under receipt #${sameAmountDateMatch.payment_number}. Please confirm duplicate override if intentional.`,
        };
      }
    }

    try {
      const payment = db.recordPayment({
        invoice_id: inv.id,
        payment_method_id: input.payment_method_id,
        amount: payAmount,
        payment_date: input.payment_date,
        reference_number: input.reference_number?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
        payment_proof_url: input.payment_proof_url,
        payment_proof_name: input.payment_proof_name,
      });

      return { success: true, data: payment };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to record payment.' };
    }
  }

  /**
   * Reverses a recorded payment.
   * Reopens invoice balance due and updates invoice status (does not delete record).
   */
  public reversePayment(paymentId: string, reason: string): ServiceResponse<Payment> {
    if (!reason || !reason.trim()) {
      return {
        success: false,
        error: 'A detailed justification reason is mandatory to reverse a payment in the financial ledger.',
      };
    }

    const payment = this.getPaymentById(paymentId);
    if (!payment) {
      return { success: false, error: 'Payment record not found.' };
    }

    if (payment.status === 'REVERSED') {
      return { success: false, error: 'This payment has already been reversed.' };
    }

    try {
      const reversed = db.reversePayment(paymentId, reason.trim());
      return { success: true, data: reversed };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to reverse payment.' };
    }
  }
}

export const paymentService = new PaymentService();
