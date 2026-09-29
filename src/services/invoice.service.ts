import {
  Invoice,
  InvoiceStatus,
  LineItem,
  DiscountType,
  VatRate,
  Customer,
  Payment,
  CreditNote,
  VatTreatment,
} from '@/types/database';
import { PaginatedResult, ServiceResponse } from '@/types/service';
import { db } from '@/lib/db/repository';
import { VatCalculator, LineItemInput, CalculationResult } from '@/lib/vat/calculator';
import { ValidationRules } from '@/lib/validation/rules';
import { creditNoteService } from './credit-note.service';

export interface InvoiceQuery {
  search?: string;
  status?: InvoiceStatus | 'ALL';
  customerId?: string | 'ALL';
  paymentStatus?: 'ALL' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface InvoiceLineItemInput {
  id?: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_type?: DiscountType;
  discount_value?: number;
  vat_rate_id: string;
  vat_treatment?: VatTreatment;
}

export interface InvoiceInput {
  customer_id: string;
  invoice_date: string;
  supply_date: string;
  due_date: string;
  payment_terms_days?: number;
  reference_number?: string;
  po_number?: string;
  items: InvoiceLineItemInput[];
  discount_type?: DiscountType;
  discount_value?: number;
  notes?: string;
  terms?: string;
  status?: 'DRAFT' | 'ISSUED';
  currency?: string;
}

export interface RecordPaymentInput {
  invoice_id: string;
  payment_method_id: string;
  amount: number;
  payment_date?: string;
  reference_number?: string;
  notes?: string;
}

export interface CreditNoteItemInput {
  invoice_item_id: string;
  quantity_to_credit: number;
  unit_price?: number;
  reason?: string;
}

export interface CreateCreditNoteInput {
  invoice_id: string;
  items: CreditNoteItemInput[];
  reason: string;
  allocation_type?: 'INVOICE_OFFSET' | 'CASH_REFUND';
}

class InvoiceService {
  /**
   * Calculates high-precision mathematical totals for an invoice and its line items.
   */
  public calculateInvoiceTotals(
    items: InvoiceLineItemInput[],
    discountType?: DiscountType,
    discountValue: number = 0
  ): CalculationResult {
    const vatRates = db.getVatRates();

    const calcInputs: LineItemInput[] = items.map((it) => {
      const vat = vatRates.find((v) => v.id === it.vat_rate_id);
      return {
        quantity: Number(it.quantity) || 0,
        unit_price: Number(it.unit_price) || 0,
        discount_type: it.discount_type || 'PERCENTAGE',
        discount_value: Number(it.discount_value) || 0,
        vat_rate_percentage: vat?.rate_percentage ?? 5.0,
        vat_treatment: it.vat_treatment || vat?.treatment || 'STANDARD_RATED',
      };
    });

    return VatCalculator.calculateDocument(calcInputs, discountType, discountValue);
  }

  /**
   * Validates invoice input fields.
   */
  public validateInvoice(data: Partial<InvoiceInput>): Record<string, string> {
    const errors: Record<string, string> = {};

    // Customer
    if (!data.customer_id) {
      errors.customer_id = 'Please select a recipient customer.';
    }

    // Dates
    if (!data.invoice_date) {
      errors.invoice_date = 'Invoice date of issue is required.';
    }
    if (!data.supply_date) {
      errors.supply_date = 'Date of supply is mandatory for UAE FTA VAT compliance.';
    }
    if (data.invoice_date && data.supply_date) {
      const invTime = new Date(data.invoice_date).getTime();
      const supplyTime = new Date(data.supply_date).getTime();
      const diffDays = Math.floor((invTime - supplyTime) / (1000 * 3600 * 24));
      if (diffDays > 14) {
        errors.invoice_date =
          'Under UAE VAT Law (Article 67), a Tax Invoice must be issued within 14 calendar days of the date of supply.';
      }
    }
    if (!data.due_date) {
      errors.due_date = 'Payment due date is required.';
    }

    // Line items
    if (!data.items || data.items.length === 0) {
      errors.items = 'An invoice must contain at least one line item.';
    } else {
      data.items.forEach((it, idx) => {
        if (!it.description || !it.description.trim()) {
          errors[`item_${idx}_description`] = `Line item #${idx + 1} requires a valid description.`;
        }
        if (Number(it.quantity) <= 0) {
          errors[`item_${idx}_quantity`] = `Line item #${idx + 1} quantity must be greater than zero.`;
        }
        if (Number(it.unit_price) < 0) {
          errors[`item_${idx}_unit_price`] = `Line item #${idx + 1} unit price cannot be negative.`;
        }
        if (it.discount_value && Number(it.discount_value) < 0) {
          errors[`item_${idx}_discount`] = `Line item #${idx + 1} discount cannot be negative.`;
        }
      });
    }

    // Invoice-level discount
    if (data.discount_value && Number(data.discount_value) < 0) {
      errors.discount_value = 'Document discount value cannot be negative.';
    }

    return errors;
  }

  /**
   * Fetches invoices matching filter criteria, with pagination and search.
   */
  public getInvoices(query: InvoiceQuery = {}): PaginatedResult<Invoice> {
    const {
      search = '',
      status = 'ALL',
      customerId = 'ALL',
      paymentStatus = 'ALL',
      startDate,
      endDate,
      page = 1,
      pageSize = 10,
    } = query;

    let items = db.getInvoices();

    // 1. Status Filter
    if (status && status !== 'ALL') {
      if (status === 'OVERDUE') {
        const todayStr = new Date().toISOString().split('T')[0];
        items = items.filter(
          (inv) =>
            inv.balance_due > 0 &&
            inv.due_date < todayStr &&
            inv.status !== 'CANCELLED' &&
            inv.status !== 'DRAFT'
        );
      } else {
        items = items.filter((inv) => inv.status === status);
      }
    }

    // 2. Customer Filter
    if (customerId && customerId !== 'ALL') {
      items = items.filter((inv) => inv.customer_id === customerId);
    }

    // 3. Payment Status Filter
    if (paymentStatus && paymentStatus !== 'ALL') {
      const todayStr = new Date().toISOString().split('T')[0];
      switch (paymentStatus) {
        case 'UNPAID':
          items = items.filter(
            (inv) =>
              inv.amount_paid === 0 &&
              inv.status !== 'CANCELLED' &&
              inv.status !== 'DRAFT'
          );
          break;
        case 'PARTIALLY_PAID':
          items = items.filter((inv) => inv.status === 'PARTIALLY_PAID');
          break;
        case 'PAID':
          items = items.filter((inv) => inv.status === 'PAID');
          break;
        case 'OVERDUE':
          items = items.filter(
            (inv) =>
              inv.balance_due > 0 &&
              inv.due_date < todayStr &&
              inv.status !== 'CANCELLED' &&
              inv.status !== 'DRAFT'
          );
          break;
      }
    }

    // 4. Date Range Filter (invoice_date)
    if (startDate) {
      items = items.filter((inv) => inv.invoice_date >= startDate);
    }
    if (endDate) {
      items = items.filter((inv) => inv.invoice_date <= endDate);
    }

    // 5. Keyword Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter((inv) => {
        const numMatch = inv.invoice_number.toLowerCase().includes(q);
        const custNameMatch = (
          inv.customer_snapshot.company_name ||
          inv.customer_snapshot.contact_person ||
          ''
        )
          .toLowerCase()
          .includes(q);
        const trnMatch = (inv.customer_snapshot.trn || '').toLowerCase().includes(q);
        const refMatch = (inv.reference_number || '').toLowerCase().includes(q);
        const poMatch = (inv.po_number || '').toLowerCase().includes(q);
        return numMatch || custNameMatch || trnMatch || refMatch || poMatch;
      });
    }

    // Sort descending by invoice date and creation
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
   * Fetches an invoice by ID.
   */
  public getInvoiceById(id: string): Invoice | undefined {
    return db.getInvoiceById(id);
  }

  /**
   * Creates a new invoice (either DRAFT or directly ISSUED).
   */
  public createInvoice(input: InvoiceInput): ServiceResponse<Invoice> {
    const errors = this.validateInvoice(input);
    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        error: Object.values(errors)[0],
      };
    }

    try {
      const vatRates = db.getVatRates();
      const totals = this.calculateInvoiceTotals(
        input.items,
        input.discount_type,
        input.discount_value
      );

      const lineItems: LineItem[] = input.items.map((it, idx) => {
        const lineCalc = totals.items[idx];
        const vat = vatRates.find((v) => v.id === it.vat_rate_id);
        const treatment = it.vat_treatment || vat?.treatment || 'STANDARD_RATED';

        return {
          id: it.id || `inv-item-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
          product_id: it.product_id,
          item_order: idx + 1,
          description: it.description,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          unit: it.unit || 'Unit',
          discount_type: it.discount_type || 'PERCENTAGE',
          discount_value: Number(it.discount_value || 0),
          discount_amount: lineCalc.discount_amount,
          subtotal_net: lineCalc.subtotal_net,
          vat_rate_id: it.vat_rate_id,
          vat_rate_percentage: vat?.rate_percentage ?? 5.0,
          vat_treatment: treatment,
          vat_amount: lineCalc.vat_amount,
          total_gross: lineCalc.total_gross,
        };
      });

      const invoice = db.saveInvoice({
        customer_id: input.customer_id,
        invoice_date: input.invoice_date,
        supply_date: input.supply_date,
        due_date: input.due_date,
        payment_terms_days: input.payment_terms_days,
        reference_number: input.reference_number || input.po_number || '',
        po_number: input.po_number || '',
        status: input.status || 'DRAFT',
        subtotal_net: totals.subtotal_net,
        discount_type: input.discount_type,
        discount_value: input.discount_value || 0,
        discount_amount: totals.invoice_discount_amount,
        vat_total: totals.vat_total,
        grand_total: totals.grand_total,
        notes: input.notes || '',
        terms: input.terms || '',
        items: lineItems,
      });

      return {
        success: true,
        data: invoice,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || 'Failed to create invoice',
      };
    }
  }

  /**
   * Updates an existing DRAFT invoice.
   * STRICT AUDIT GUARD: Prohibits destructive editing if invoice has been issued or cancelled.
   */
  public updateDraftInvoice(id: string, input: Partial<InvoiceInput>): ServiceResponse<Invoice> {
    const existing = db.getInvoiceById(id);
    if (!existing) {
      return { success: false, error: 'Invoice not found.' };
    }

    if (existing.status !== 'DRAFT') {
      return {
        success: false,
        error:
          'Issued or finalized invoices are locked for audit integrity. Destructive editing is strictly prohibited. Please use a Credit Note for financial corrections.',
      };
    }

    const mergedInput: InvoiceInput = {
      customer_id: input.customer_id ?? existing.customer_id,
      invoice_date: input.invoice_date ?? existing.invoice_date,
      supply_date: input.supply_date ?? existing.supply_date,
      due_date: input.due_date ?? existing.due_date,
      payment_terms_days: input.payment_terms_days ?? existing.payment_terms_days,
      reference_number: input.reference_number ?? existing.reference_number,
      po_number: input.po_number ?? existing.po_number,
      discount_type: input.discount_type ?? existing.discount_type,
      discount_value: input.discount_value ?? existing.discount_value,
      notes: input.notes ?? existing.notes,
      terms: input.terms ?? existing.terms,
      items: input.items ?? existing.items.map((it) => ({
        id: it.id,
        product_id: it.product_id,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        discount_type: it.discount_type,
        discount_value: it.discount_value,
        vat_rate_id: it.vat_rate_id,
        vat_treatment: it.vat_treatment,
      })),
    };

    const errors = this.validateInvoice(mergedInput);
    if (Object.keys(errors).length > 0) {
      return { success: false, error: Object.values(errors)[0] };
    }

    try {
      const vatRates = db.getVatRates();
      const totals = this.calculateInvoiceTotals(
        mergedInput.items,
        mergedInput.discount_type,
        mergedInput.discount_value
      );

      const lineItems: LineItem[] = mergedInput.items.map((it, idx) => {
        const lineCalc = totals.items[idx];
        const vat = vatRates.find((v) => v.id === it.vat_rate_id);
        const treatment = it.vat_treatment || vat?.treatment || 'STANDARD_RATED';

        return {
          id: it.id || `inv-item-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
          product_id: it.product_id,
          item_order: idx + 1,
          description: it.description,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          unit: it.unit || 'Unit',
          discount_type: it.discount_type || 'PERCENTAGE',
          discount_value: Number(it.discount_value || 0),
          discount_amount: lineCalc.discount_amount,
          subtotal_net: lineCalc.subtotal_net,
          vat_rate_id: it.vat_rate_id,
          vat_rate_percentage: vat?.rate_percentage ?? 5.0,
          vat_treatment: treatment,
          vat_amount: lineCalc.vat_amount,
          total_gross: lineCalc.total_gross,
        };
      });

      const updated = db.saveInvoice({
        id: existing.id,
        customer_id: mergedInput.customer_id,
        invoice_date: mergedInput.invoice_date,
        supply_date: mergedInput.supply_date,
        due_date: mergedInput.due_date,
        payment_terms_days: mergedInput.payment_terms_days,
        reference_number: mergedInput.reference_number || '',
        po_number: mergedInput.po_number || '',
        subtotal_net: totals.subtotal_net,
        discount_type: mergedInput.discount_type,
        discount_value: mergedInput.discount_value || 0,
        discount_amount: totals.invoice_discount_amount,
        vat_total: totals.vat_total,
        grand_total: totals.grand_total,
        balance_due: totals.grand_total,
        notes: mergedInput.notes || '',
        terms: mergedInput.terms || '',
        items: lineItems,
      });

      return { success: true, data: updated };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to update invoice.' };
    }
  }

  /**
   * Issues an official invoice from DRAFT state.
   * Permanently assigns sequential legal invoice number (INV-YYYY-XXXX).
   */
  public issueInvoice(id: string): ServiceResponse<Invoice> {
    try {
      const issued = db.issueInvoice(id);
      return { success: true, data: issued };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to issue invoice.' };
    }
  }

  /**
   * Duplicates an existing invoice into a brand new DRAFT invoice.
   */
  public duplicateInvoice(id: string): ServiceResponse<Invoice> {
    const existing = db.getInvoiceById(id);
    if (!existing) {
      return { success: false, error: 'Source invoice not found.' };
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const customer = db.getCustomerById(existing.customer_id);
      const termsDays = existing.payment_terms_days || customer?.payment_terms_days || 30;
      const dueDate = new Date(Date.now() + termsDays * 86400000).toISOString().split('T')[0];

      const clonedItems: InvoiceLineItemInput[] = existing.items.map((it) => ({
        product_id: it.product_id,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        discount_type: it.discount_type,
        discount_value: it.discount_value,
        vat_rate_id: it.vat_rate_id,
        vat_treatment: it.vat_treatment,
      }));

      const cloned = this.createInvoice({
        customer_id: existing.customer_id,
        invoice_date: today,
        supply_date: today,
        due_date: dueDate,
        payment_terms_days: termsDays,
        reference_number: existing.reference_number ? `Copy of ${existing.reference_number}` : '',
        po_number: existing.po_number || '',
        items: clonedItems,
        discount_type: existing.discount_type,
        discount_value: existing.discount_value,
        notes: existing.notes || '',
        terms: existing.terms || '',
        status: 'DRAFT',
      });

      return cloned;
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to duplicate invoice.' };
    }
  }

  /**
   * Cancels an issued or draft invoice.
   * Retains the invoice in the database permanently.
   * Permanent invoice numbers are NEVER reused.
   */
  public cancelInvoice(id: string, reason: string): ServiceResponse<Invoice> {
    if (!reason || !reason.trim()) {
      return {
        success: false,
        error: 'A detailed cancellation reason is required for UAE tax audit compliance.',
      };
    }

    const existing = db.getInvoiceById(id);
    if (!existing) {
      return { success: false, error: 'Invoice not found.' };
    }

    if (existing.status === 'CANCELLED') {
      return { success: false, error: 'Invoice is already cancelled.' };
    }

    if (existing.amount_paid > 0) {
      return {
        success: false,
        error:
          'Cannot cancel an invoice with recorded payments. Please reverse payments or issue a Credit Note first.',
      };
    }

    try {
      const cancelled = db.cancelInvoice(id, reason.trim());
      return { success: true, data: cancelled };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to cancel invoice.' };
    }
  }

  /**
   * Records a payment against an invoice.
   * Enforces anti-overpayment constraint and transitions status to PARTIALLY_PAID or PAID.
   */
  public recordPayment(input: RecordPaymentInput): ServiceResponse<Payment> {
    if (!input.amount || Number(input.amount) <= 0) {
      return { success: false, error: 'Payment amount must be greater than zero.' };
    }
    if (!input.payment_method_id) {
      return { success: false, error: 'Please select a valid payment method.' };
    }

    try {
      const payment = db.recordPayment({
        invoice_id: input.invoice_id,
        payment_method_id: input.payment_method_id,
        amount: Number(input.amount),
        payment_date: input.payment_date,
        reference_number: input.reference_number,
        notes: input.notes,
      });

      return { success: true, data: payment };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to record payment.' };
    }
  }

  /**
   * Reverses a recorded payment.
   */
  public reversePayment(paymentId: string, reason: string): ServiceResponse<Payment> {
    if (!reason || !reason.trim()) {
      return { success: false, error: 'A valid reversal reason is required.' };
    }

    try {
      const reversed = db.reversePayment(paymentId, reason.trim());
      return { success: true, data: reversed };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to reverse payment.' };
    }
  }

  /**
   * Issues a Credit Note against an issued invoice.
   */
  public createCreditNote(input: CreateCreditNoteInput): ServiceResponse<CreditNote> {
    return creditNoteService.createCreditNote(input);
  }
}

export const invoiceService = new InvoiceService();
