import {
  Quote,
  QuoteStatus,
  LineItem,
  DiscountType,
  Invoice,
  VatRate,
  Customer,
} from '@/types/database';
import { PaginatedResult, ServiceResponse } from '@/types/service';
import { db } from '@/lib/db/repository';
import { VatCalculator, LineItemInput, CalculationResult } from '@/lib/vat/calculator';
import { ValidationRules } from '@/lib/validation/rules';

export interface QuoteQuery {
  search?: string;
  status?: QuoteStatus | 'ALL';
  customerId?: string | 'ALL';
  page?: number;
  pageSize?: number;
}

export interface QuoteLineItemInput {
  id?: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_type?: DiscountType;
  discount_value?: number;
  vat_rate_id: string;
}

export interface QuoteInput {
  customer_id: string;
  quote_date: string;
  expiry_date: string;
  items: QuoteLineItemInput[];
  discount_type?: DiscountType;
  discount_value?: number;
  notes?: string;
  terms?: string;
  currency?: string;
}

class QuoteService {
  /**
   * Calculates high-precision mathematical totals for a quote and its line items.
   */
  public calculateQuoteTotals(
    items: QuoteLineItemInput[],
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
        vat_treatment: vat?.treatment ?? 'STANDARD_RATED',
      };
    });

    return VatCalculator.calculateDocument(calcInputs, discountType, discountValue);
  }

  /**
   * Validates quote input fields.
   */
  public validateQuote(data: Partial<QuoteInput>): Record<string, string> {
    const errors: Record<string, string> = {};

    // Customer
    if (!data.customer_id) {
      errors.customer_id = 'Please select a recipient customer or prospect.';
    }

    // Dates
    if (!data.quote_date) {
      errors.quote_date = 'Issue date is required.';
    }
    if (!data.expiry_date) {
      errors.expiry_date = 'Valid-until / expiry date is required.';
    }
    if (data.quote_date && data.expiry_date && data.expiry_date < data.quote_date) {
      errors.expiry_date = 'Expiry date cannot precede quotation issue date.';
    }

    // Items
    if (!data.items || data.items.length === 0) {
      errors.items = 'At least one quotation line item is required.';
    } else {
      data.items.forEach((item, idx) => {
        if (!item.description || !item.description.trim()) {
          errors[`item_${idx}_description`] = `Item #${idx + 1}: Description is required.`;
        }
        if (item.quantity === undefined || Number(item.quantity) <= 0) {
          errors[`item_${idx}_quantity`] = `Item #${idx + 1}: Quantity must be greater than zero.`;
        }
        if (item.unit_price === undefined || Number(item.unit_price) < 0) {
          errors[`item_${idx}_unit_price`] = `Item #${idx + 1}: Unit price cannot be negative.`;
        }
        if (!item.vat_rate_id) {
          errors[`item_${idx}_vat`] = `Item #${idx + 1}: Please select UAE VAT rate.`;
        }
      });
    }

    // Document Discount
    if (data.discount_value !== undefined && data.discount_value < 0) {
      errors.discount_value = 'Discount value cannot be negative.';
    }
    if (
      data.discount_type === 'PERCENTAGE' &&
      data.discount_value !== undefined &&
      data.discount_value > 100
    ) {
      errors.discount_value = 'Percentage discount cannot exceed 100%.';
    }

    return errors;
  }

  /**
   * Retrieves quotes with filtering, search, and pagination.
   */
  public getQuotes(query: QuoteQuery = {}): PaginatedResult<Quote> {
    const {
      search = '',
      status = 'ALL',
      customerId = 'ALL',
      page = 1,
      pageSize = 10,
    } = query;

    const allQuotes = db.getQuotes();

    const filtered = allQuotes.filter((q) => {
      // Status filter
      if (status !== 'ALL' && q.status !== status) {
        return false;
      }

      // Customer filter
      if (customerId !== 'ALL' && q.customer_id !== customerId) {
        return false;
      }

      // Search query
      if (search.trim()) {
        const queryTerm = search.toLowerCase();
        const matchNum = q.quote_number.toLowerCase().includes(queryTerm);
        const matchCust = q.customer_name?.toLowerCase().includes(queryTerm);
        const matchTrn = q.customer_trn?.toLowerCase().includes(queryTerm);
        const matchItem = q.items.some((it) => it.description.toLowerCase().includes(queryTerm));

        if (!matchNum && !matchCust && !matchTrn && !matchItem) {
          return false;
        }
      }

      return true;
    });

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const items = filtered.slice(startIndex, startIndex + pageSize);

    return {
      items,
      totalItems,
      currentPage: safePage,
      totalPages,
      pageSize,
    };
  }

  public getQuoteById(id: string): Quote | null {
    return db.getQuoteById(id) || null;
  }

  /**
   * Creates a new quotation.
   */
  public createQuote(data: QuoteInput, performedBy = 'Current User'): ServiceResponse<Quote> {
    const errors = this.validateQuote(data);
    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        errors,
        error: 'Please resolve quotation validation errors before saving.',
      };
    }

    try {
      const vatRates = db.getVatRates();
      const calcResult = this.calculateQuoteTotals(data.items, data.discount_type, data.discount_value);

      // Build prepared line items
      const processedItems: LineItem[] = data.items.map((it, idx) => {
        const vat = vatRates.find((v) => v.id === it.vat_rate_id);
        const lineCalc = calcResult.items[idx];

        return {
          id: it.id || `quo-item-${Date.now()}-${idx}`,
          product_id: it.product_id,
          item_order: idx + 1,
          description: it.description.trim(),
          quantity: Number(it.quantity),
          unit: it.unit || 'Unit',
          unit_price: Number(it.unit_price),
          discount_type: it.discount_type || 'PERCENTAGE',
          discount_value: Number(it.discount_value) || 0,
          discount_amount: lineCalc.discount_amount,
          subtotal_net: lineCalc.subtotal_net,
          vat_rate_id: it.vat_rate_id,
          vat_rate_percentage: vat?.rate_percentage ?? 5.0,
          vat_amount: lineCalc.vat_amount,
          total_gross: lineCalc.total_gross,
        };
      });

      const customer = db.getCustomerById(data.customer_id);

      const saved = db.saveQuote({
        customer_id: data.customer_id,
        customer_name: customer?.company_name || customer?.contact_person || 'Client',
        customer_email: customer?.email,
        customer_trn: customer?.trn,
        quote_date: data.quote_date,
        expiry_date: data.expiry_date,
        status: 'DRAFT',
        currency: data.currency || 'AED',
        exchange_rate: 1.0,
        subtotal_net: calcResult.subtotal_net,
        discount_type: data.discount_type,
        discount_value: Number(data.discount_value) || 0,
        discount_amount: calcResult.invoice_discount_amount,
        vat_total: calcResult.vat_total,
        grand_total: calcResult.grand_total,
        notes: data.notes?.trim() || undefined,
        terms: data.terms?.trim() || undefined,
        items: processedItems,
      });

      return {
        success: true,
        data: saved,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || 'Failed to create quotation.',
      };
    }
  }

  /**
   * Updates an existing quotation.
   * Accounting guard: Only DRAFT quotations can be edited.
   */
  public updateQuote(
    id: string,
    data: QuoteInput,
    performedBy = 'Current User'
  ): ServiceResponse<Quote> {
    const existing = db.getQuoteById(id);
    if (!existing) {
      return { success: false, error: 'Quotation not found.' };
    }

    if (existing.status !== 'DRAFT') {
      return {
        success: false,
        error: `Cannot edit quote: Quotations with status "${existing.status}" are locked for audit integrity. You can duplicate this quote to create a new draft proposal.`,
      };
    }

    const errors = this.validateQuote(data);
    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        errors,
        error: 'Please resolve quotation validation errors before saving.',
      };
    }

    try {
      const vatRates = db.getVatRates();
      const calcResult = this.calculateQuoteTotals(data.items, data.discount_type, data.discount_value);

      const processedItems: LineItem[] = data.items.map((it, idx) => {
        const vat = vatRates.find((v) => v.id === it.vat_rate_id);
        const lineCalc = calcResult.items[idx];

        return {
          id: it.id || `quo-item-${Date.now()}-${idx}`,
          product_id: it.product_id,
          item_order: idx + 1,
          description: it.description.trim(),
          quantity: Number(it.quantity),
          unit: it.unit || 'Unit',
          unit_price: Number(it.unit_price),
          discount_type: it.discount_type || 'PERCENTAGE',
          discount_value: Number(it.discount_value) || 0,
          discount_amount: lineCalc.discount_amount,
          subtotal_net: lineCalc.subtotal_net,
          vat_rate_id: it.vat_rate_id,
          vat_rate_percentage: vat?.rate_percentage ?? 5.0,
          vat_amount: lineCalc.vat_amount,
          total_gross: lineCalc.total_gross,
        };
      });

      const customer = db.getCustomerById(data.customer_id);

      const saved = db.saveQuote({
        id,
        customer_id: data.customer_id,
        customer_name: customer?.company_name || customer?.contact_person || existing.customer_name,
        customer_email: customer?.email,
        customer_trn: customer?.trn,
        quote_date: data.quote_date,
        expiry_date: data.expiry_date,
        status: existing.status,
        currency: data.currency || existing.currency,
        exchange_rate: 1.0,
        subtotal_net: calcResult.subtotal_net,
        discount_type: data.discount_type,
        discount_value: Number(data.discount_value) || 0,
        discount_amount: calcResult.invoice_discount_amount,
        vat_total: calcResult.vat_total,
        grand_total: calcResult.grand_total,
        notes: data.notes?.trim() || undefined,
        terms: data.terms?.trim() || undefined,
        items: processedItems,
      });

      return {
        success: true,
        data: saved,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || 'Failed to update quotation.',
      };
    }
  }

  /**
   * Updates status of quote (DRAFT -> SENT, SENT -> ACCEPTED / REJECTED / EXPIRED).
   */
  public updateQuoteStatus(
    id: string,
    newStatus: QuoteStatus,
    performedBy = 'Current User'
  ): ServiceResponse<Quote> {
    const existing = db.getQuoteById(id);
    if (!existing) {
      return { success: false, error: 'Quotation not found.' };
    }

    if (existing.status === 'CONVERTED') {
      return {
        success: false,
        error: 'Quotation has already been converted to a tax invoice and cannot change state.',
      };
    }

    try {
      const updated = db.updateQuoteStatus(id, newStatus);
      return {
        success: true,
        data: updated,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || 'Failed to update quotation status.',
      };
    }
  }

  /**
   * Duplicates an existing quotation into a new DRAFT proposal.
   */
  public duplicateQuote(id: string, performedBy = 'Current User'): ServiceResponse<Quote> {
    const original = db.getQuoteById(id);
    if (!original) {
      return { success: false, error: 'Quotation to duplicate not found.' };
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const expiry = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

      const clonedItems: QuoteLineItemInput[] = original.items.map((it) => ({
        product_id: it.product_id,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        discount_type: it.discount_type,
        discount_value: it.discount_value,
        vat_rate_id: it.vat_rate_id,
      }));

      const newQuoteRes = this.createQuote(
        {
          customer_id: original.customer_id,
          quote_date: today,
          expiry_date: expiry,
          items: clonedItems,
          discount_type: original.discount_type,
          discount_value: original.discount_value,
          notes: original.notes,
          terms: original.terms,
          currency: original.currency,
        },
        performedBy
      );

      return newQuoteRes;
    } catch (e: any) {
      return {
        success: false,
        error: e.message || 'Failed to duplicate quotation.',
      };
    }
  }

  /**
   * Converts quotation to a tax invoice according to strict UAE accounting rules:
   * - Preserves originating quote ID and number
   * - Copies customer information & snapshot
   * - Copies line items, prices, discounts, and VAT rates
   * - Recalculates totals safely
   * - Sets quote status to CONVERTED and links converted_invoice_id
   * - Original quote content is never mutated or corrupted
   */
  public convertQuoteToInvoice(
    quoteId: string,
    performedBy = 'Current User'
  ): ServiceResponse<Invoice> {
    const quote = db.getQuoteById(quoteId);
    if (!quote) {
      return { success: false, error: 'Quotation not found.' };
    }

    if (quote.status === 'CONVERTED' && quote.converted_invoice_id) {
      const existing = db.getInvoiceById(quote.converted_invoice_id);
      if (existing) {
        return {
          success: true,
          data: existing,
        };
      }
    }

    try {
      const invoice = db.convertQuoteToInvoice(quoteId);
      return {
        success: true,
        data: invoice,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || 'Failed to convert quotation to invoice.',
      };
    }
  }

  /**
   * Deletes a quotation. Guard: only allowed for DRAFT or REJECTED quotes.
   */
  public deleteQuote(id: string, performedBy = 'Current User'): ServiceResponse<boolean> {
    const existing = db.getQuoteById(id);
    if (!existing) {
      return { success: false, error: 'Quotation not found.' };
    }

    if (existing.status === 'CONVERTED') {
      return {
        success: false,
        error: 'Cannot delete quotation: It has been converted to an official UAE Tax Invoice and must remain in the audit trail.',
      };
    }

    if (existing.status === 'ACCEPTED') {
      return {
        success: false,
        error: 'Cannot delete quotation: Client has accepted this proposal. Reject or convert instead.',
      };
    }

    try {
      db.deleteQuote(id);
      return { success: true, data: true };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || 'Failed to delete quotation.',
      };
    }
  }
}

export const quoteService = new QuoteService();
