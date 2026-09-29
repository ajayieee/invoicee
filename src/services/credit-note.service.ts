import {
  CreditNote,
  CreditNoteType,
  RefundStatus,
  CreditReasonCode,
  Invoice,
} from '@/types/database';
import { ServiceResponse } from '@/types/service';
import { db } from '@/lib/db/repository';

export interface CreditNoteItemInput {
  invoice_item_id: string;
  quantity_to_credit: number;
  unit_price?: number;
  amount_to_credit?: number;
  reason?: string;
  description?: string;
}

export interface CreateCreditNoteInput {
  invoice_id: string;
  items: CreditNoteItemInput[];
  reason: string;
  credit_type?: CreditNoteType;
  credit_reason_code?: CreditReasonCode;
  allocation_type?: 'INVOICE_OFFSET' | 'CASH_REFUND' | 'BANK_REFUND' | 'CREDIT_ON_ACCOUNT';
  performed_by_name?: string;
}

export interface CreditNoteQuery {
  search?: string;
  status?: string;
  refundStatus?: string;
  customerId?: string;
  invoiceId?: string;
}

export class CreditNoteService {
  public getCreditNotes(query: CreditNoteQuery = {}): CreditNote[] {
    let list = db.getCreditNotes();

    if (query.status && query.status !== 'ALL') {
      list = list.filter((cn) => cn.status === query.status);
    }

    if (query.refundStatus && query.refundStatus !== 'ALL') {
      list = list.filter((cn) => cn.refund_status === query.refundStatus);
    }

    if (query.customerId) {
      list = list.filter((cn) => cn.customer_id === query.customerId);
    }

    if (query.invoiceId) {
      list = list.filter((cn) => cn.invoice_id === query.invoiceId);
    }

    if (query.search?.trim()) {
      const q = query.search.toLowerCase().trim();
      list = list.filter((cn) => {
        const matchNum = cn.credit_note_number.toLowerCase().includes(q);
        const matchInv = cn.invoice_number?.toLowerCase().includes(q);
        const matchCust = cn.customer_name?.toLowerCase().includes(q);
        const matchReason = cn.reason.toLowerCase().includes(q);
        return matchNum || matchInv || matchCust || matchReason;
      });
    }

    return list;
  }

  public getCreditNoteById(id: string): CreditNote | undefined {
    return db.getCreditNoteById(id);
  }

  public getEligibleInvoices(): Invoice[] {
    return db
      .getInvoices()
      .filter((inv) => inv.status !== 'CANCELLED' && inv.status !== 'DRAFT');
  }

  public createCreditNote(input: CreateCreditNoteInput): ServiceResponse<CreditNote> {
    if (!input.invoice_id) {
      return { success: false, error: 'Originating invoice must be selected.' };
    }
    if (!input.reason || !input.reason.trim()) {
      return { success: false, error: 'A mandatory reason is required for issuing a UAE tax credit note.' };
    }
    if (!input.items || input.items.length === 0) {
      return { success: false, error: 'Please select at least one line item to credit.' };
    }

    try {
      const creditNote = db.createCreditNoteFromInvoice(
        input.invoice_id,
        input.items.map((it) => ({
          invoice_item_id: it.invoice_item_id,
          quantity_to_credit: Number(it.quantity_to_credit),
          unit_price: it.unit_price !== undefined ? Number(it.unit_price) : undefined,
          amount_to_credit: it.amount_to_credit !== undefined ? Number(it.amount_to_credit) : undefined,
          reason: it.reason,
          description: it.description,
        })),
        input.reason.trim(),
        input.allocation_type || 'INVOICE_OFFSET',
        input.credit_type,
        input.credit_reason_code || 'RE_OTHER',
        input.performed_by_name || 'Current User'
      );

      return { success: true, data: creditNote };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to issue credit note.' };
    }
  }

  public processRefund(
    creditNoteId: string,
    refundMethod: 'CASH' | 'BANK',
    refundReference?: string,
    notes?: string,
    performedByName: string = 'Current User'
  ): ServiceResponse<CreditNote> {
    try {
      const updated = db.processCreditNoteRefund(
        creditNoteId,
        refundMethod,
        refundReference,
        notes,
        performedByName
      );
      return { success: true, data: updated };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to process refund.' };
    }
  }

  public cancelCreditNote(
    creditNoteId: string,
    reason: string,
    performedByName: string = 'Current User'
  ): ServiceResponse<CreditNote> {
    if (!reason || !reason.trim()) {
      return { success: false, error: 'A documented reason is mandatory when cancelling a credit note.' };
    }

    try {
      const updated = db.cancelCreditNote(creditNoteId, reason.trim(), performedByName);
      return { success: true, data: updated };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to cancel credit note.' };
    }
  }

  public async submitToAsp(creditNoteId: string): Promise<ServiceResponse<CreditNote>> {
    try {
      const updated = await db.submitCreditNoteToAsp(creditNoteId);
      return { success: true, data: updated };
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to submit credit note to ASP.' };
    }
  }

  public getSummaryMetrics() {
    const list = db.getCreditNotes();
    const active = list.filter((cn) => cn.status !== 'CANCELLED');

    const totalCreditedAmount = active.reduce((s, cn) => s + cn.grand_total, 0);
    const totalVatAdjusted = active.reduce((s, cn) => s + cn.vat_total, 0);
    const totalNetCredited = active.reduce((s, cn) => s + cn.subtotal_net, 0);

    return {
      totalCount: list.length,
      activeCount: active.length,
      totalCreditedAmount: Number(totalCreditedAmount.toFixed(2)),
      totalVatAdjusted: Number(totalVatAdjusted.toFixed(2)),
      totalNetCredited: Number(totalNetCredited.toFixed(2)),
    };
  }
}

export const creditNoteService = new CreditNoteService();
