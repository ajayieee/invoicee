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
import { apiClient } from '@/lib/api/client';

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
   * Validates invoice data against statutory UAE FTA VAT requirements.
   */
  public validateInvoice(input: Partial<InvoiceInput>): Record<string, string> {
    const errors: Record<string, string> = {};

    const custCheck = ValidationRules.required(input.customer_id, 'Customer');
    if (!custCheck.isValid && custCheck.error) errors.customer_id = custCheck.error;

    const dateCheck = ValidationRules.required(input.invoice_date, 'Invoice Date');
    if (!dateCheck.isValid && dateCheck.error) errors.invoice_date = dateCheck.error;

    const supplyCheck = ValidationRules.required(input.supply_date, 'Date of Supply');
    if (!supplyCheck.isValid && supplyCheck.error) errors.supply_date = supplyCheck.error;

    const dueCheck = ValidationRules.required(input.due_date, 'Due Date');
    if (!dueCheck.isValid && dueCheck.error) errors.due_date = dueCheck.error;

    if (input.invoice_date && input.due_date && input.due_date < input.invoice_date) {
      errors.due_date = 'Payment due date cannot precede the invoice issue date.';
    }

    if (!input.items || input.items.length === 0) {
      errors.items = 'At least one line item is required on a UAE VAT invoice.';
    } else {
      input.items.forEach((item, index) => {
        if (!item.description || !item.description.trim()) {
          errors[`item_${index}_description`] = `Item #${index + 1}: Description is required.`;
        }
        if (item.quantity === undefined || Number(item.quantity) <= 0) {
          errors[`item_${index}_quantity`] = `Item #${index + 1}: Quantity must be greater than zero.`;
        }
        if (item.unit_price === undefined || Number(item.unit_price) < 0) {
          errors[`item_${index}_unit_price`] = `Item #${index + 1}: Unit price cannot be negative.`;
        }
        if (!item.vat_rate_id) {
          errors[`item_${index}_vat_rate_id`] = `Item #${index + 1}: VAT rate is required.`;
        }
      });
    }

    return errors;
  }

  /**
   * Synchronize all invoices from MongoDB Atlas Express API into local cache.
   */
  public async syncInvoices(): Promise<Invoice[]> {
    try {
      const res = await apiClient.get<{ success: boolean; items: Invoice[] }>('/invoices', {
        pageSize: 1000,
      });

      if (res && res.success && Array.isArray(res.items)) {
        res.items.forEach((inv) => {
          db.upsertInvoice(inv);
        });
        return res.items;
      }
    } catch (err) {
      console.warn('[InvoiceService] Failed to sync invoices from MongoDB Atlas:', err);
    }
    return db.getInvoices();
  }

  /**
   * Retrieves paginated invoices with comprehensive filtering.
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
          inv.customer_snapshot?.company_name ||
          inv.customer_snapshot?.contact_person ||
          (inv as any).customerSnapshot?.companyName ||
          (inv as any).customerSnapshot?.contactPerson ||
          ''
        )
          .toLowerCase()
          .includes(q);
        const trnMatch = (inv.customer_snapshot?.trn || (inv as any).customerSnapshot?.trn || '').toLowerCase().includes(q);
        const refMatch = (inv.reference_number || '').toLowerCase().includes(q);
        const poMatch = (inv.po_number || '').toLowerCase().includes(q);
        return numMatch || custNameMatch || trnMatch || refMatch || poMatch;
      });
    }

    // Sort descending by sequence/date
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
   * Creates a new invoice directly in MongoDB Atlas and synchronizes locally.
   */
  public async createInvoice(input: InvoiceInput): Promise<ServiceResponse<Invoice>> {
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

      const customer = db.getCustomerById(input.customer_id);

      const payload = {
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
        customer_snapshot: customer
          ? {
              company_name: customer.company_name,
              contact_person: customer.contact_person,
              email: customer.email,
              phone: customer.phone,
              trn: customer.trn,
              billing_address_line_1: customer.billing_address_line_1,
              billing_city: customer.billing_city,
              billing_emirate: customer.billing_emirate,
            }
          : undefined,
      };

      try {
        const res = await apiClient.post<{ success: boolean; data: Invoice }>('/invoices', payload);
        if (res && res.success && res.data) {
          const saved = db.upsertInvoice(res.data);
          return {
            success: true,
            data: saved,
          };
        }
      } catch (apiErr: any) {
        console.warn('[InvoiceService] Direct Atlas post failed, saving locally:', apiErr.message);
      }

      // Local fallback
      const invoice = db.saveInvoice(payload);
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
   * Updates an existing DRAFT invoice in MongoDB Atlas.
   */
  public async updateDraftInvoice(id: string, input: Partial<InvoiceInput>): Promise<ServiceResponse<Invoice>> {
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

      const payload = {
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
      };

      try {
        const res = await apiClient.put<{ success: boolean; data: Invoice }>(`/invoices/${id}`, payload);
        if (res && res.success && res.data) {
          const updated = db.upsertInvoice(res.data);
          return { success: true, data: updated };
        }
      } catch (apiErr: any) {
        console.warn('[InvoiceService] Direct Atlas put failed, updating locally:', apiErr.message);
      }

      const updated = db.saveInvoice({ id: existing.id, ...payload });
      return { success: true, data: updated };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to update invoice.' };
    }
  }

  /**
   * Issues an official invoice from DRAFT state directly in MongoDB Atlas.
   */
  public async issueInvoice(id: string): Promise<ServiceResponse<Invoice>> {
    try {
      try {
        const res = await apiClient.post<{ success: boolean; data: Invoice }>(`/invoices/${id}/issue`);
        if (res && res.success && res.data) {
          const issued = db.upsertInvoice(res.data);
          return { success: true, data: issued };
        }
      } catch (apiErr: any) {
        console.warn('[InvoiceService] Direct Atlas issue failed, issuing locally:', apiErr.message);
      }

      const issued = db.issueInvoice(id);
      return { success: true, data: issued };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to issue invoice.' };
    }
  }

  /**
   * Duplicates an existing invoice into a brand new DRAFT invoice.
   */
  public async duplicateInvoice(id: string): Promise<ServiceResponse<Invoice>> {
    try {
      try {
        const res = await apiClient.post<{ success: boolean; data: Invoice }>(`/invoices/${id}/duplicate`);
        if (res && res.success && res.data) {
          const cloned = db.upsertInvoice(res.data);
          return { success: true, data: cloned };
        }
      } catch (apiErr: any) {
        console.warn('[InvoiceService] Direct Atlas duplicate failed, duplicating locally:', apiErr.message);
      }

      const existing = db.getInvoiceById(id);
      if (!existing) {
        return { success: false, error: 'Source invoice not found.' };
      }

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

      return await this.createInvoice({
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
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to duplicate invoice.' };
    }
  }

  /**
   * Cancels an issued or draft invoice directly in MongoDB Atlas.
   */
  public async cancelInvoice(id: string, reason: string): Promise<ServiceResponse<Invoice>> {
    if (!reason || !reason.trim()) {
      return {
        success: false,
        error: 'A detailed cancellation reason is required for UAE tax audit compliance.',
      };
    }

    try {
      try {
        const res = await apiClient.post<{ success: boolean; data: Invoice }>(`/invoices/${id}/cancel`, {
          reason: reason.trim(),
        });
        if (res && res.success && res.data) {
          const cancelled = db.upsertInvoice(res.data);
          return { success: true, data: cancelled };
        }
      } catch (apiErr: any) {
        console.warn('[InvoiceService] Direct Atlas cancel failed, cancelling locally:', apiErr.message);
      }

      const cancelled = db.cancelInvoice(id, reason.trim());
      return { success: true, data: cancelled };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to cancel invoice.' };
    }
  }

  /**
   * Records a payment against an invoice directly in MongoDB Atlas.
   */
  public async recordPayment(input: RecordPaymentInput): Promise<ServiceResponse<Payment>> {
    if (!input.amount || Number(input.amount) <= 0) {
      return { success: false, error: 'Payment amount must be greater than zero.' };
    }
    if (!input.payment_method_id) {
      return { success: false, error: 'Please select a valid payment method.' };
    }

    try {
      try {
        const res = await apiClient.post<{ success: boolean; data: Payment }>('/payments', {
          invoice_id: input.invoice_id,
          payment_method_id: input.payment_method_id,
          amount: Number(input.amount),
          payment_date: input.payment_date,
          reference_number: input.reference_number,
          notes: input.notes,
        });

        if (res && res.success && res.data) {
          // Re-sync invoice state from API
          await this.syncInvoices();
          return { success: true, data: res.data };
        }
      } catch (apiErr: any) {
        console.warn('[InvoiceService] Direct Atlas payment post failed, recording locally:', apiErr.message);
      }

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
  public async reversePayment(paymentId: string, reason: string): Promise<ServiceResponse<Payment>> {
    if (!reason || !reason.trim()) {
      return { success: false, error: 'A valid reversal reason is required.' };
    }

    try {
      try {
        const res = await apiClient.post<{ success: boolean; data: Payment }>(
          `/payments/${paymentId}/reverse`,
          { reason: reason.trim() }
        );
        if (res && res.success && res.data) {
          await this.syncInvoices();
          return { success: true, data: res.data };
        }
      } catch (apiErr: any) {
        console.warn('[InvoiceService] Direct Atlas payment reversal failed, reversing locally:', apiErr.message);
      }

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
