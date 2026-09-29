import { db } from '@/lib/db/repository';
import { VatCalculator } from '@/lib/vat/calculator';
import {
  Invoice,
  Payment,
  CreditNote,
  Customer,
  VatTreatment,
  InvoiceStatus,
  PaymentStatus,
  CreditNoteStatus,
} from '@/types/database';

export interface ReportFilterOptions {
  startDate?: string;
  endDate?: string;
  customerId?: string; // specific customer ID or 'ALL'
  status?: string; // specific status or 'ALL'
  vatTreatment?: VatTreatment | 'ALL';
  paymentStatus?: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'OVERDUE' | 'ALL';
  search?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary?: Record<string, number | string>;
}

// 1. Sales Report Row
export interface SalesReportRow {
  date: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  reference?: string;
  vat_treatment: string;
  subtotal_net: number;
  discount_amount: number;
  vat_total: number;
  grand_total: number;
  status: InvoiceStatus;
  payment_status: string;
}

// 2. Invoice Report Row
export interface InvoiceReportRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  supply_date: string;
  due_date: string;
  customer_id: string;
  customer_name: string;
  trn?: string;
  vat_treatment: string;
  subtotal_net: number;
  discount_amount: number;
  vat_total: number;
  grand_total: number;
  amount_paid: number;
  balance_due: number;
  status: InvoiceStatus;
  payment_status: string;
}

// 3. Payment Report Row
export interface PaymentReportRow {
  payment_number: string;
  payment_date: string;
  invoice_number?: string;
  customer_id: string;
  customer_name: string;
  payment_method: string;
  reference_number?: string;
  amount: number;
  notes?: string;
  status: PaymentStatus;
}

// 4. Outstanding Report Row
export interface OutstandingReportRow {
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  customer_id: string;
  customer_name: string;
  phone?: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  days_open: number;
  status: InvoiceStatus;
}

// 5. Overdue Report Row
export interface OverdueReportRow {
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  customer_id: string;
  customer_name: string;
  phone?: string;
  days_overdue: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: InvoiceStatus;
}

// 6. VAT Return 201 Row & Summary
export interface VatReturnItemRow {
  date: string;
  document_type: 'Tax Invoice' | 'Credit Note';
  document_number: string;
  customer_name: string;
  trn?: string;
  vat_treatment: VatTreatment;
  vat_rate_percentage: number;
  taxable_subtotal: number;
  vat_amount: number;
  grand_total: number;
}

export interface VatEmirateBox {
  emirate: string;
  boxNumber: string;
  grossSales: number;
  creditAdjustments: number;
  netTaxable: number;
  vatAmount: number;
}

export interface VatReportSummary {
  standardRatedSales: number;
  standardRatedVat: number;
  creditNotesStandardAdjustment: number;
  creditNotesVatAdjustment: number;
  netStandardRatedSales: number;
  netStandardRatedVat: number;
  zeroRatedSales: number;
  exemptSales: number;
  outOfScopeSales: number;
  totalSuppliesNet: number;
  netVatPayable: number;
  emirateBoxes: VatEmirateBox[];
}

// 7. Credit Note Report Row
export interface CreditNoteReportRow {
  credit_note_number: string;
  credit_note_date: string;
  invoice_number?: string;
  invoice_date?: string;
  customer_id: string;
  customer_name: string;
  reason: string;
  credit_type: string;
  subtotal_net: number;
  vat_total: number;
  grand_total: number;
  remaining_balance: number;
  refund_status: string;
  status: CreditNoteStatus;
  e_invoice_status: string;
}

// 8. Customer Statement Result
export interface StatementLedgerRow {
  date: string;
  type: 'Tax Invoice' | 'Payment' | 'Credit Note' | 'Opening Balance';
  reference: string;
  description: string;
  debit: number;
  credit: number;
  running_balance: number;
}

export interface CustomerStatementResult {
  customer?: Customer;
  openingBalance: number;
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
  ledger: StatementLedgerRow[];
}

// 9. Revenue by Customer Row
export interface RevenueByCustomerRow {
  customer_id: string;
  customer_name: string;
  trn?: string;
  emirate?: string;
  invoices_count: number;
  gross_invoiced: number;
  credit_deductions: number;
  net_revenue: number;
  payments_collected: number;
  outstanding_balance: number;
}

// 10. Revenue by Product Row
export interface RevenueByProductRow {
  product_name: string;
  quantity_sold: number;
  unit: string;
  net_revenue: number;
  vat_amount: number;
  total_gross: number;
  percentage_of_sales: number;
}

// 11. Receivables Ageing Row & Summary
export interface AgeingReportRow {
  customer_name: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  days_overdue: number;
  current: number; // 0 - 30 days
  days31_60: number;
  days61_90: number;
  days90_plus: number;
  total_due: number;
}

export interface AgeingReportSummary {
  buckets: {
    current: number;
    days31_60: number;
    days61_90: number;
    days90_plus: number;
  };
  totalReceivables: number;
}

class ReportService {
  /**
   * Helper: Filter invoices according to common filter options.
   * Ensures business logic parity by using identical criteria as invoice modules.
   */
  private filterInvoices(invoices: Invoice[], filters: ReportFilterOptions): Invoice[] {
    const today = new Date();

    return invoices.filter((inv) => {
      // 1. Date range filter
      if (filters.startDate && inv.invoice_date < filters.startDate) return false;
      if (filters.endDate && inv.invoice_date > filters.endDate) return false;

      // 2. Customer filter
      if (filters.customerId && filters.customerId !== 'ALL' && inv.customer_id !== filters.customerId) {
        return false;
      }

      // 3. Status filter
      if (filters.status && filters.status !== 'ALL' && inv.status !== filters.status) {
        return false;
      }

      // 4. VAT treatment filter
      if (filters.vatTreatment && filters.vatTreatment !== 'ALL') {
        const hasTreatment = inv.items.some((item) => {
          const treatment = item.vat_treatment || (item.vat_rate_percentage > 0 ? 'STANDARD_RATED' : 'ZERO_RATED');
          return treatment === filters.vatTreatment;
        });
        if (!hasTreatment) return false;
      }

      // 5. Payment status filter
      if (filters.paymentStatus && filters.paymentStatus !== 'ALL') {
        if (filters.paymentStatus === 'PAID' && inv.status !== 'PAID') return false;
        if (filters.paymentStatus === 'PARTIALLY_PAID' && inv.status !== 'PARTIALLY_PAID') return false;
        if (filters.paymentStatus === 'UNPAID' && inv.amount_paid > 0) return false;
        if (filters.paymentStatus === 'OVERDUE') {
          const isOverdue = inv.status === 'OVERDUE' || (inv.balance_due > 0 && new Date(inv.due_date) < today);
          if (!isOverdue) return false;
        }
      }

      return true;
    });
  }

  /**
   * Helper: Generic in-memory search, sorting, and pagination
   */
  private paginateAndSort<T>(
    items: T[],
    filters: ReportFilterOptions,
    searchFields: (keyof T)[],
    summary?: Record<string, number | string>
  ): PaginatedResult<T> {
    let result = [...items];

    // Search filter
    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      result = result.filter((row) =>
        searchFields.some((field) => {
          const val = row[field];
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(q);
        })
      );
    }

    // Sorting
    if (filters.sortBy) {
      const dir = filters.sortDirection === 'desc' ? -1 : 1;
      const key = filters.sortBy as keyof T;
      result.sort((a, b) => {
        const valA = a[key];
        const valB = b[key];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return (valA - valB) * dir;
        }
        return String(valA || '').localeCompare(String(valB || '')) * dir;
      });
    }

    const total = result.length;
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.max(1, filters.pageSize || 10);
    const totalPages = Math.ceil(total / pageSize) || 1;
    const startIdx = (page - 1) * pageSize;
    const data = result.slice(startIdx, startIdx + pageSize);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
      summary,
    };
  }

  /**
   * Helper: Determine payment status string
   */
  private getPaymentStatusString(inv: Invoice): string {
    if (inv.status === 'PAID') return 'Paid';
    if (inv.status === 'PARTIALLY_PAID') return 'Partially Paid';
    if (new Date(inv.due_date) < new Date() && inv.balance_due > 0) return 'Overdue';
    if (inv.amount_paid === 0) return 'Unpaid';
    return inv.status;
  }

  // ==========================================
  // 1. Sales Report
  // ==========================================
  public getSalesReport(filters: ReportFilterOptions = {}): PaginatedResult<SalesReportRow> {
    const rawInvoices = db.getInvoices().filter((i) => i.status !== 'CANCELLED');
    const filteredInvoices = this.filterInvoices(rawInvoices, filters);

    const rows: SalesReportRow[] = filteredInvoices.map((inv) => {
      const primaryTreatment = inv.items[0]?.vat_treatment || (inv.vat_total > 0 ? 'STANDARD_RATED' : 'ZERO_RATED');
      return {
        date: inv.invoice_date,
        invoice_number: inv.invoice_number,
        customer_id: inv.customer_id,
        customer_name: inv.customer_snapshot?.company_name || inv.customer_snapshot?.contact_person || 'Client',
        reference: inv.reference_number || inv.po_number || '-',
        vat_treatment: primaryTreatment,
        subtotal_net: inv.subtotal_net,
        discount_amount: inv.discount_amount,
        vat_total: inv.vat_total,
        grand_total: inv.grand_total,
        status: inv.status,
        payment_status: this.getPaymentStatusString(inv),
      };
    });

    const totalNet = rows.reduce((s, r) => s + r.subtotal_net, 0);
    const totalDiscount = rows.reduce((s, r) => s + r.discount_amount, 0);
    const totalVat = rows.reduce((s, r) => s + r.vat_total, 0);
    const totalGrand = rows.reduce((s, r) => s + r.grand_total, 0);

    return this.paginateAndSort(
      rows,
      filters,
      ['invoice_number', 'customer_name', 'reference', 'vat_treatment'],
      {
        totalNet: Number(totalNet.toFixed(2)),
        totalDiscount: Number(totalDiscount.toFixed(2)),
        totalVat: Number(totalVat.toFixed(2)),
        totalGrand: Number(totalGrand.toFixed(2)),
      }
    );
  }

  // ==========================================
  // 2. Invoice Report
  // ==========================================
  public getInvoiceReport(filters: ReportFilterOptions = {}): PaginatedResult<InvoiceReportRow> {
    const rawInvoices = db.getInvoices();
    const filteredInvoices = this.filterInvoices(rawInvoices, filters);

    const rows: InvoiceReportRow[] = filteredInvoices.map((inv) => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      supply_date: inv.supply_date,
      due_date: inv.due_date,
      customer_id: inv.customer_id,
      customer_name: inv.customer_snapshot?.company_name || inv.customer_snapshot?.contact_person || 'Client',
      trn: inv.customer_snapshot?.trn || '-',
      vat_treatment: inv.items[0]?.vat_treatment || (inv.vat_total > 0 ? 'STANDARD_RATED' : 'ZERO_RATED'),
      subtotal_net: inv.subtotal_net,
      discount_amount: inv.discount_amount,
      vat_total: inv.vat_total,
      grand_total: inv.grand_total,
      amount_paid: inv.amount_paid,
      balance_due: inv.balance_due,
      status: inv.status,
      payment_status: this.getPaymentStatusString(inv),
    }));

    const totalGrand = rows.reduce((s, r) => s + r.grand_total, 0);
    const totalPaid = rows.reduce((s, r) => s + r.amount_paid, 0);
    const totalDue = rows.reduce((s, r) => s + r.balance_due, 0);

    return this.paginateAndSort(
      rows,
      filters,
      ['invoice_number', 'customer_name', 'trn', 'status'],
      {
        totalGrand: Number(totalGrand.toFixed(2)),
        totalPaid: Number(totalPaid.toFixed(2)),
        totalDue: Number(totalDue.toFixed(2)),
      }
    );
  }

  // ==========================================
  // 3. Payment Report
  // ==========================================
  public getPaymentReport(filters: ReportFilterOptions = {}): PaginatedResult<PaymentReportRow> {
    const rawPayments = db.getPayments();

    const filteredPayments = rawPayments.filter((p) => {
      if (filters.startDate && p.payment_date < filters.startDate) return false;
      if (filters.endDate && p.payment_date > filters.endDate) return false;
      if (filters.customerId && filters.customerId !== 'ALL' && p.customer_id !== filters.customerId) {
        return false;
      }
      if (filters.status && filters.status !== 'ALL' && p.status !== filters.status) {
        return false;
      }
      return true;
    });

    const rows: PaymentReportRow[] = filteredPayments.map((p) => ({
      payment_number: p.payment_number,
      payment_date: p.payment_date,
      invoice_number: p.invoice_number || '-',
      customer_id: p.customer_id,
      customer_name: p.customer_name || 'Client',
      payment_method: p.payment_method_name || 'Bank Transfer',
      reference_number: p.reference_number || '-',
      amount: p.amount,
      notes: p.notes,
      status: p.status,
    }));

    const totalCollected = rows
      .filter((r) => r.status === 'RECORDED')
      .reduce((s, r) => s + r.amount, 0);

    return this.paginateAndSort(
      rows,
      filters,
      ['payment_number', 'invoice_number', 'customer_name', 'payment_method', 'reference_number'],
      {
        totalCollected: Number(totalCollected.toFixed(2)),
        recordedCount: rows.filter((r) => r.status === 'RECORDED').length,
      }
    );
  }

  // ==========================================
  // 4. Outstanding Report
  // ==========================================
  public getOutstandingReport(filters: ReportFilterOptions = {}): PaginatedResult<OutstandingReportRow> {
    const rawInvoices = db.getInvoices().filter((i) => i.status !== 'CANCELLED' && i.balance_due > 0);
    const filteredInvoices = this.filterInvoices(rawInvoices, filters);
    const today = new Date();

    const rows: OutstandingReportRow[] = filteredInvoices.map((inv) => {
      const daysOpen = Math.max(0, Math.ceil((today.getTime() - new Date(inv.invoice_date).getTime()) / (1000 * 3600 * 24)));
      return {
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        due_date: inv.due_date,
        customer_id: inv.customer_id,
        customer_name: inv.customer_snapshot?.company_name || inv.customer_snapshot?.contact_person || 'Client',
        phone: inv.customer_snapshot?.phone || inv.customer_snapshot?.mobile || '-',
        total_amount: inv.grand_total,
        amount_paid: inv.amount_paid,
        balance_due: inv.balance_due,
        days_open: daysOpen,
        status: inv.status,
      };
    });

    const totalOutstanding = rows.reduce((s, r) => s + r.balance_due, 0);

    return this.paginateAndSort(
      rows,
      filters,
      ['invoice_number', 'customer_name', 'phone'],
      {
        totalOutstanding: Number(totalOutstanding.toFixed(2)),
      }
    );
  }

  // ==========================================
  // 5. Overdue Report
  // ==========================================
  public getOverdueReport(filters: ReportFilterOptions = {}): PaginatedResult<OverdueReportRow> {
    const today = new Date();
    const rawInvoices = db.getInvoices().filter(
      (i) => i.status !== 'CANCELLED' && i.balance_due > 0 && (i.status === 'OVERDUE' || new Date(i.due_date) < today)
    );
    const filteredInvoices = this.filterInvoices(rawInvoices, filters);

    const rows: OverdueReportRow[] = filteredInvoices.map((inv) => {
      const diffDays = Math.max(0, Math.ceil((today.getTime() - new Date(inv.due_date).getTime()) / (1000 * 3600 * 24)));
      return {
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        due_date: inv.due_date,
        customer_id: inv.customer_id,
        customer_name: inv.customer_snapshot?.company_name || inv.customer_snapshot?.contact_person || 'Client',
        phone: inv.customer_snapshot?.phone || inv.customer_snapshot?.mobile || '-',
        days_overdue: diffDays,
        total_amount: inv.grand_total,
        amount_paid: inv.amount_paid,
        balance_due: inv.balance_due,
        status: inv.status,
      };
    });

    const totalOverdue = rows.reduce((s, r) => s + r.balance_due, 0);

    return this.paginateAndSort(
      rows,
      filters,
      ['invoice_number', 'customer_name', 'phone'],
      {
        totalOverdue: Number(totalOverdue.toFixed(2)),
      }
    );
  }

  // ==========================================
  // 6. UAE VAT Return 201 Report
  // ==========================================
  public getVatReport(filters: ReportFilterOptions = {}): {
    summary: VatReportSummary;
    transactions: PaginatedResult<VatReturnItemRow>;
  } {
    const invoices = this.filterInvoices(
      db.getInvoices().filter((i) => i.status !== 'CANCELLED'),
      filters
    );

    const activeCreditNotes = db.getCreditNotes().filter((cn) => {
      if (cn.status === 'CANCELLED') return false;
      if (filters.startDate && cn.credit_note_date < filters.startDate) return false;
      if (filters.endDate && cn.credit_note_date > filters.endDate) return false;
      if (filters.customerId && filters.customerId !== 'ALL' && cn.customer_id !== filters.customerId) {
        return false;
      }
      return true;
    });

    // Compute VAT 201 boxes directly from underlying line items
    let standardRatedSales = 0;
    let standardRatedVat = 0;
    let zeroRatedSales = 0;
    let exemptSales = 0;
    let outOfScopeSales = 0;

    const transactionRows: VatReturnItemRow[] = [];

    invoices.forEach((inv) => {
      inv.items.forEach((item) => {
        const treatment = item.vat_treatment || (item.vat_rate_percentage > 0 ? 'STANDARD_RATED' : 'ZERO_RATED');

        if (treatment === 'STANDARD_RATED') {
          standardRatedSales += item.subtotal_net;
          standardRatedVat += item.vat_amount;
        } else if (treatment === 'ZERO_RATED') {
          zeroRatedSales += item.subtotal_net;
        } else if (treatment === 'EXEMPT') {
          exemptSales += item.subtotal_net;
        } else if (treatment === 'OUT_OF_SCOPE') {
          outOfScopeSales += item.subtotal_net;
        }

        transactionRows.push({
          date: inv.invoice_date,
          document_type: 'Tax Invoice',
          document_number: inv.invoice_number,
          customer_name: inv.customer_snapshot?.company_name || inv.customer_snapshot?.contact_person || 'Client',
          trn: inv.customer_snapshot?.trn,
          vat_treatment: treatment,
          vat_rate_percentage: item.vat_rate_percentage,
          taxable_subtotal: item.subtotal_net,
          vat_amount: item.vat_amount,
          grand_total: item.total_gross,
        });
      });
    });

    // Credit Note adjustments
    let creditNotesStandardAdjustment = 0;
    let creditNotesVatAdjustment = 0;

    activeCreditNotes.forEach((cn) => {
      creditNotesStandardAdjustment += cn.subtotal_net;
      creditNotesVatAdjustment += cn.vat_total;

      transactionRows.push({
        date: cn.credit_note_date,
        document_type: 'Credit Note',
        document_number: cn.credit_note_number,
        customer_name: cn.customer_name || 'Client',
        trn: cn.customer_snapshot?.trn,
        vat_treatment: 'STANDARD_RATED',
        vat_rate_percentage: 5,
        taxable_subtotal: -cn.subtotal_net,
        vat_amount: -cn.vat_total,
        grand_total: -cn.grand_total,
      });
    });

    const netStandardRatedSales = Math.max(0, standardRatedSales - creditNotesStandardAdjustment);
    const netStandardRatedVat = Math.max(0, standardRatedVat - creditNotesVatAdjustment);
    const totalSuppliesNet = netStandardRatedSales + zeroRatedSales + exemptSales + outOfScopeSales;

    // Form VAT 201 Box 1 Breakdown across the 7 Emirates
    const emiratesList = [
      { name: 'Abu Dhabi', box: 'Box 1a' },
      { name: 'Dubai', box: 'Box 1b' },
      { name: 'Sharjah', box: 'Box 1c' },
      { name: 'Ajman', box: 'Box 1d' },
      { name: 'Umm Al Quwain', box: 'Box 1e' },
      { name: 'Ras Al Khaimah', box: 'Box 1f' },
      { name: 'Fujairah', box: 'Box 1g' },
    ];

    const emirateMap: Record<string, { grossSales: number; creditAdjustments: number; vatCollected: number; vatCredited: number }> = {};
    emiratesList.forEach((e) => {
      emirateMap[e.name] = { grossSales: 0, creditAdjustments: 0, vatCollected: 0, vatCredited: 0 };
    });

    invoices.forEach((inv) => {
      const rawEmirate = inv.customer_snapshot?.billing_emirate || 'Dubai';
      const targetEmirate = emirateMap[rawEmirate] ? rawEmirate : 'Dubai';
      inv.items.forEach((item) => {
        const treatment = item.vat_treatment || (item.vat_rate_percentage > 0 ? 'STANDARD_RATED' : 'ZERO_RATED');
        if (treatment === 'STANDARD_RATED') {
          emirateMap[targetEmirate].grossSales += item.subtotal_net;
          emirateMap[targetEmirate].vatCollected += item.vat_amount;
        }
      });
    });

    activeCreditNotes.forEach((cn) => {
      const rawEmirate = cn.customer_snapshot?.billing_emirate || 'Dubai';
      const targetEmirate = emirateMap[rawEmirate] ? rawEmirate : 'Dubai';
      emirateMap[targetEmirate].creditAdjustments += cn.subtotal_net;
      emirateMap[targetEmirate].vatCredited += cn.vat_total;
    });

    const emirateBoxes: VatEmirateBox[] = emiratesList.map((e) => {
      const d = emirateMap[e.name];
      const netTaxable = Math.max(0, d.grossSales - d.creditAdjustments);
      const vatAmount = Math.max(0, d.vatCollected - d.vatCredited);
      return {
        emirate: e.name,
        boxNumber: e.box,
        grossSales: Number(d.grossSales.toFixed(2)),
        creditAdjustments: Number(d.creditAdjustments.toFixed(2)),
        netTaxable: Number(netTaxable.toFixed(2)),
        vatAmount: Number(vatAmount.toFixed(2)),
      };
    });

    const summary: VatReportSummary = {
      standardRatedSales: Number(standardRatedSales.toFixed(2)),
      standardRatedVat: Number(standardRatedVat.toFixed(2)),
      creditNotesStandardAdjustment: Number(creditNotesStandardAdjustment.toFixed(2)),
      creditNotesVatAdjustment: Number(creditNotesVatAdjustment.toFixed(2)),
      netStandardRatedSales: Number(netStandardRatedSales.toFixed(2)),
      netStandardRatedVat: Number(netStandardRatedVat.toFixed(2)),
      zeroRatedSales: Number(zeroRatedSales.toFixed(2)),
      exemptSales: Number(exemptSales.toFixed(2)),
      outOfScopeSales: Number(outOfScopeSales.toFixed(2)),
      totalSuppliesNet: Number(totalSuppliesNet.toFixed(2)),
      netVatPayable: Number(netStandardRatedVat.toFixed(2)),
      emirateBoxes,
    };

    const paginatedTransactions = this.paginateAndSort(
      transactionRows,
      filters,
      ['document_number', 'customer_name', 'trn', 'vat_treatment'],
      {
        totalTaxable: Number(totalSuppliesNet.toFixed(2)),
        netVatPayable: summary.netVatPayable,
      }
    );

    return {
      summary,
      transactions: paginatedTransactions,
    };
  }

  // ==========================================
  // 7. Credit Note Report
  // ==========================================
  public getCreditNoteReport(filters: ReportFilterOptions = {}): PaginatedResult<CreditNoteReportRow> {
    const rawCreditNotes = db.getCreditNotes();

    const filtered = rawCreditNotes.filter((cn) => {
      if (filters.startDate && cn.credit_note_date < filters.startDate) return false;
      if (filters.endDate && cn.credit_note_date > filters.endDate) return false;
      if (filters.customerId && filters.customerId !== 'ALL' && cn.customer_id !== filters.customerId) {
        return false;
      }
      if (filters.status && filters.status !== 'ALL' && cn.status !== filters.status) {
        return false;
      }
      return true;
    });

    const rows: CreditNoteReportRow[] = filtered.map((cn) => ({
      credit_note_number: cn.credit_note_number,
      credit_note_date: cn.credit_note_date,
      invoice_number: cn.invoice_number,
      invoice_date: cn.invoice_date,
      customer_id: cn.customer_id,
      customer_name: cn.customer_name || 'Client',
      reason: cn.reason,
      credit_type: cn.credit_type,
      subtotal_net: cn.subtotal_net,
      vat_total: cn.vat_total,
      grand_total: cn.grand_total,
      remaining_balance: cn.remaining_balance,
      refund_status: cn.refund_status,
      status: cn.status,
      e_invoice_status: cn.e_invoice_status,
    }));

    const totalCredited = rows.reduce((s, r) => s + r.grand_total, 0);
    const totalVat = rows.reduce((s, r) => s + r.vat_total, 0);

    return this.paginateAndSort(
      rows,
      filters,
      ['credit_note_number', 'invoice_number', 'customer_name', 'reason'],
      {
        totalCredited: Number(totalCredited.toFixed(2)),
        totalVat: Number(totalVat.toFixed(2)),
      }
    );
  }

  // ==========================================
  // 8. Customer Statement
  // ==========================================
  public getCustomerStatementReport(
    customerId?: string,
    filters: ReportFilterOptions = {}
  ): CustomerStatementResult {
    const customers = db.getCustomers();
    const effectiveCustId =
      customerId && customerId !== 'ALL' ? customerId : filters.customerId && filters.customerId !== 'ALL' ? filters.customerId : customers[0]?.id;

    const customer = effectiveCustId ? db.getCustomerById(effectiveCustId) : undefined;
    if (!customer) {
      return {
        customer: undefined,
        openingBalance: 0,
        closingBalance: 0,
        totalDebits: 0,
        totalCredits: 0,
        ledger: [],
      };
    }

    const allInvoices = db.getInvoices().filter((i) => i.customer_id === customer.id && i.status !== 'CANCELLED');
    const allPayments = db.getPayments().filter((p) => p.customer_id === customer.id && p.status === 'RECORDED');
    const allCreditNotes = db.getCreditNotes().filter((cn) => cn.customer_id === customer.id && cn.status !== 'CANCELLED');

    // 1. Calculate opening balance if startDate is specified
    let openingBalance = 0;
    if (filters.startDate) {
      const priorInvoices = allInvoices.filter((i) => i.invoice_date < filters.startDate!);
      const priorPayments = allPayments.filter((p) => p.payment_date < filters.startDate!);
      const priorCreditNotes = allCreditNotes.filter((cn) => cn.credit_note_date < filters.startDate!);

      const priorDebits = priorInvoices.reduce((s, i) => s + i.grand_total, 0);
      const priorCredits =
        priorPayments.reduce((s, p) => s + p.amount, 0) + priorCreditNotes.reduce((s, cn) => s + cn.grand_total, 0);

      openingBalance = Number((priorDebits - priorCredits).toFixed(2));
    }

    // 2. Filter transactions within date window
    const inScopeInvoices = allInvoices.filter((i) => {
      if (filters.startDate && i.invoice_date < filters.startDate) return false;
      if (filters.endDate && i.invoice_date > filters.endDate) return false;
      return true;
    });

    const inScopePayments = allPayments.filter((p) => {
      if (filters.startDate && p.payment_date < filters.startDate) return false;
      if (filters.endDate && p.payment_date > filters.endDate) return false;
      return true;
    });

    const inScopeCreditNotes = allCreditNotes.filter((cn) => {
      if (filters.startDate && cn.credit_note_date < filters.startDate) return false;
      if (filters.endDate && cn.credit_note_date > filters.endDate) return false;
      return true;
    });

    // 3. Assemble and sort ledger
    interface RawLedgerEntry {
      date: string;
      type: 'Tax Invoice' | 'Payment' | 'Credit Note';
      reference: string;
      description: string;
      debit: number;
      credit: number;
    }

    const rawEntries: RawLedgerEntry[] = [];

    inScopeInvoices.forEach((i) => {
      rawEntries.push({
        date: i.invoice_date,
        type: 'Tax Invoice',
        reference: i.invoice_number,
        description: `Tax Invoice #${i.invoice_number} (Due: ${i.due_date})`,
        debit: i.grand_total,
        credit: 0,
      });
    });

    inScopePayments.forEach((p) => {
      rawEntries.push({
        date: p.payment_date,
        type: 'Payment',
        reference: p.payment_number,
        description: `Payment Receipt (${p.payment_method_name || 'Bank wire'} - Ref: ${p.reference_number || '-'})`,
        debit: 0,
        credit: p.amount,
      });
    });

    inScopeCreditNotes.forEach((cn) => {
      rawEntries.push({
        date: cn.credit_note_date,
        type: 'Credit Note',
        reference: cn.credit_note_number,
        description: `Credit Note #${cn.credit_note_number} (${cn.reason})`,
        debit: 0,
        credit: cn.grand_total,
      });
    });

    rawEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = openingBalance;
    const ledger: StatementLedgerRow[] = [];

    if (openingBalance !== 0 || filters.startDate) {
      ledger.push({
        date: filters.startDate || (rawEntries[0]?.date ?? new Date().toISOString().split('T')[0]),
        type: 'Opening Balance',
        reference: 'START',
        description: 'Opening Balance Brought Forward',
        debit: openingBalance > 0 ? openingBalance : 0,
        credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
        running_balance: openingBalance,
      });
    }

    let totalDebits = 0;
    let totalCredits = 0;

    rawEntries.forEach((e) => {
      running += e.debit - e.credit;
      totalDebits += e.debit;
      totalCredits += e.credit;

      ledger.push({
        date: e.date,
        type: e.type,
        reference: e.reference,
        description: e.description,
        debit: e.debit,
        credit: e.credit,
        running_balance: Number(running.toFixed(2)),
      });
    });

    return {
      customer,
      openingBalance,
      closingBalance: Number(running.toFixed(2)),
      totalDebits: Number(totalDebits.toFixed(2)),
      totalCredits: Number(totalCredits.toFixed(2)),
      ledger,
    };
  }

  // ==========================================
  // 9. Revenue by Customer Report
  // ==========================================
  public getRevenueByCustomerReport(filters: ReportFilterOptions = {}): PaginatedResult<RevenueByCustomerRow> {
    const rawInvoices = db.getInvoices().filter((i) => i.status !== 'CANCELLED');
    const filteredInvoices = this.filterInvoices(rawInvoices, filters);
    const activeCreditNotes = db.getCreditNotes().filter((cn) => {
      if (cn.status === 'CANCELLED') return false;
      if (filters.startDate && cn.credit_note_date < filters.startDate) return false;
      if (filters.endDate && cn.credit_note_date > filters.endDate) return false;
      return true;
    });

    const custMap: Record<string, RevenueByCustomerRow> = {};

    filteredInvoices.forEach((inv) => {
      const id = inv.customer_id;
      const name = inv.customer_snapshot?.company_name || inv.customer_snapshot?.contact_person || 'Client';
      if (!custMap[id]) {
        custMap[id] = {
          customer_id: id,
          customer_name: name,
          trn: inv.customer_snapshot?.trn || '-',
          emirate: inv.customer_snapshot?.billing_emirate || 'Dubai',
          invoices_count: 0,
          gross_invoiced: 0,
          credit_deductions: 0,
          net_revenue: 0,
          payments_collected: 0,
          outstanding_balance: 0,
        };
      }
      custMap[id].invoices_count += 1;
      custMap[id].gross_invoiced += inv.grand_total;
      custMap[id].payments_collected += inv.amount_paid;
      custMap[id].outstanding_balance += inv.balance_due;
    });

    activeCreditNotes.forEach((cn) => {
      if (custMap[cn.customer_id]) {
        custMap[cn.customer_id].credit_deductions += cn.grand_total;
      }
    });

    const rows = Object.values(custMap).map((r) => ({
      ...r,
      gross_invoiced: Number(r.gross_invoiced.toFixed(2)),
      credit_deductions: Number(r.credit_deductions.toFixed(2)),
      net_revenue: Number(Math.max(0, r.gross_invoiced - r.credit_deductions).toFixed(2)),
      payments_collected: Number(r.payments_collected.toFixed(2)),
      outstanding_balance: Number(r.outstanding_balance.toFixed(2)),
    }));

    const totalNetRevenue = rows.reduce((s, r) => s + r.net_revenue, 0);
    const totalCollected = rows.reduce((s, r) => s + r.payments_collected, 0);
    const totalOutstanding = rows.reduce((s, r) => s + r.outstanding_balance, 0);

    return this.paginateAndSort(
      rows,
      filters,
      ['customer_name', 'trn', 'emirate'],
      {
        totalNetRevenue: Number(totalNetRevenue.toFixed(2)),
        totalCollected: Number(totalCollected.toFixed(2)),
        totalOutstanding: Number(totalOutstanding.toFixed(2)),
      }
    );
  }

  // ==========================================
  // 10. Revenue by Product/Service Report
  // ==========================================
  public getRevenueByProductReport(filters: ReportFilterOptions = {}): PaginatedResult<RevenueByProductRow> {
    const rawInvoices = db.getInvoices().filter((i) => i.status !== 'CANCELLED');
    const filteredInvoices = this.filterInvoices(rawInvoices, filters);

    const prodMap: Record<string, { quantity: number; unit: string; revenue: number; vat: number; gross: number }> =
      {};

    let grandTotalRevenue = 0;

    filteredInvoices.forEach((inv) => {
      inv.items.forEach((item) => {
        const name = item.description || 'Service Item';
        if (!prodMap[name]) {
          prodMap[name] = {
            quantity: 0,
            unit: item.unit || 'unit',
            revenue: 0,
            vat: 0,
            gross: 0,
          };
        }
        prodMap[name].quantity += item.quantity;
        prodMap[name].revenue += item.subtotal_net;
        prodMap[name].vat += item.vat_amount;
        prodMap[name].gross += item.total_gross;
        grandTotalRevenue += item.subtotal_net;
      });
    });

    const rows: RevenueByProductRow[] = Object.entries(prodMap).map(([name, data]) => {
      const pct = grandTotalRevenue > 0 ? (data.revenue / grandTotalRevenue) * 100 : 0;
      return {
        product_name: name,
        quantity_sold: data.quantity,
        unit: data.unit,
        net_revenue: Number(data.revenue.toFixed(2)),
        vat_amount: Number(data.vat.toFixed(2)),
        total_gross: Number(data.gross.toFixed(2)),
        percentage_of_sales: Number(pct.toFixed(1)),
      };
    });

    const totalNet = rows.reduce((s, r) => s + r.net_revenue, 0);
    const totalVat = rows.reduce((s, r) => s + r.vat_amount, 0);
    const totalGross = rows.reduce((s, r) => s + r.total_gross, 0);

    return this.paginateAndSort(
      rows,
      filters,
      ['product_name', 'unit'],
      {
        totalNet: Number(totalNet.toFixed(2)),
        totalVat: Number(totalVat.toFixed(2)),
        totalGross: Number(totalGross.toFixed(2)),
      }
    );
  }

  // ==========================================
  // 11. Receivables Ageing Schedule Report
  // ==========================================
  public getAgeingReport(filters: ReportFilterOptions = {}): {
    summary: AgeingReportSummary;
    records: PaginatedResult<AgeingReportRow>;
  } {
    const today = new Date();
    const rawInvoices = db.getInvoices().filter((i) => i.status !== 'CANCELLED' && i.balance_due > 0);
    const filteredInvoices = this.filterInvoices(rawInvoices, filters);

    const buckets = {
      current: 0,
      days31_60: 0,
      days61_90: 0,
      days90_plus: 0,
    };

    const rows: AgeingReportRow[] = filteredInvoices.map((inv) => {
      const diffDays = Math.max(0, Math.ceil((today.getTime() - new Date(inv.due_date).getTime()) / (1000 * 3600 * 24)));
      let bCurrent = 0,
        b31 = 0,
        b61 = 0,
        b90 = 0;

      if (diffDays <= 30) {
        bCurrent = inv.balance_due;
        buckets.current += inv.balance_due;
      } else if (diffDays <= 60) {
        b31 = inv.balance_due;
        buckets.days31_60 += inv.balance_due;
      } else if (diffDays <= 90) {
        b61 = inv.balance_due;
        buckets.days61_90 += inv.balance_due;
      } else {
        b90 = inv.balance_due;
        buckets.days90_plus += inv.balance_due;
      }

      return {
        customer_name: inv.customer_snapshot?.company_name || inv.customer_snapshot?.contact_person || 'Client',
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        due_date: inv.due_date,
        days_overdue: diffDays,
        current: Number(bCurrent.toFixed(2)),
        days31_60: Number(b31.toFixed(2)),
        days61_90: Number(b61.toFixed(2)),
        days90_plus: Number(b90.toFixed(2)),
        total_due: inv.balance_due,
      };
    });

    const summary: AgeingReportSummary = {
      buckets: {
        current: Number(buckets.current.toFixed(2)),
        days31_60: Number(buckets.days31_60.toFixed(2)),
        days61_90: Number(buckets.days61_90.toFixed(2)),
        days90_plus: Number(buckets.days90_plus.toFixed(2)),
      },
      totalReceivables: Number(
        (buckets.current + buckets.days31_60 + buckets.days61_90 + buckets.days90_plus).toFixed(2)
      ),
    };

    const paginated = this.paginateAndSort(
      rows,
      filters,
      ['customer_name', 'invoice_number'],
      {
        totalReceivables: summary.totalReceivables,
      }
    );

    return {
      summary,
      records: paginated,
    };
  }

  // ==========================================
  // Universal Export Utilities
  // ==========================================

  /**
   * Export dataset to RFC 4180 compliant CSV with UTF-8 BOM
   */
  public exportToCSV(filename: string, headers: { label: string; key: string }[], rows: any[]): void {
    if (typeof window === 'undefined') return;

    const csvRows: string[] = [];

    // Header row
    csvRows.push(headers.map((h) => `"${h.label.replace(/"/g, '""')}"`).join(','));

    // Data rows
    rows.forEach((row) => {
      const line = headers.map((h) => {
        const val = row[h.key];
        if (val === null || val === undefined) return '""';
        if (typeof val === 'number') return val.toString();
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      });
      csvRows.push(line.join(','));
    });

    const csvString = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Export dataset to Excel XML Spreadsheet (.xls format)
   */
  public exportToExcel(reportTitle: string, headers: { label: string; key: string }[], rows: any[]): void {
    if (typeof window === 'undefined') return;

    let tableRows = `<tr>${headers
      .map(
        (h) =>
          `<th style="background-color:#0f172a;color:#ffffff;font-weight:bold;padding:8px;border:1px solid #cbd5e1;">${h.label}</th>`
      )
      .join('')}</tr>`;

    rows.forEach((row, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const cells = headers
        .map((h) => {
          const val = row[h.key];
          const isNum = typeof val === 'number';
          const align = isNum ? 'right' : 'left';
          const formatted = isNum ? val.toLocaleString(undefined, { minimumFractionDigits: 2 }) : val ?? '';
          return `<td style="background-color:${bg};padding:6px;border:1px solid #e2e8f0;text-align:${align};">${formatted}</td>`;
        })
        .join('');
      tableRows += `<tr>${cells}</tr>`;
    });

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>${reportTitle.slice(0, 31)}</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
      </head>
      <body>
        <h2 style="font-family:sans-serif;color:#0f172a;">${reportTitle}</h2>
        <p style="font-family:sans-serif;color:#64748b;font-size:12px;">Generated on: ${new Date().toLocaleString()} (UAE Standard Time)</p>
        <table style="border-collapse:collapse;font-family:sans-serif;font-size:12px;" border="1">
          ${tableRows}
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const reportService = new ReportService();
