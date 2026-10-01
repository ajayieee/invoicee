'use client';

import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Calendar,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  Building,
  DollarSign,
  AlertCircle,
  Clock,
  Layers,
  FileText,
  CreditCard,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/Badge';
import { db } from '@/lib/db/repository';
import { companyService } from '@/services/company.service';
import { reportService, ReportFilterOptions } from '@/services/report.service';
import { formatCurrency, formatDate } from '@/lib/utils';
import { VatTreatment, InvoiceStatus } from '@/types/database';

export type ReportType =
  | 'SALES'
  | 'INVOICES'
  | 'PAYMENTS'
  | 'OUTSTANDING'
  | 'OVERDUE'
  | 'VAT'
  | 'CREDIT_NOTES'
  | 'CUSTOMER_STATEMENT'
  | 'REVENUE_BY_CUSTOMER'
  | 'REVENUE_BY_PRODUCT'
  | 'AGEING';

interface ReportTabConfig {
  id: ReportType;
  label: string;
  category: 'Sales' | 'Receivables' | 'Compliance & Analysis';
  description: string;
}

const REPORT_TABS: ReportTabConfig[] = [
  { id: 'SALES', label: '1. Sales Summary', category: 'Sales', description: 'Net sales, discounts, output VAT, and totals' },
  { id: 'INVOICES', label: '2. Invoices Register', category: 'Sales', description: 'Comprehensive register of all tax invoices' },
  { id: 'PAYMENTS', label: '3. Payments Collections', category: 'Receivables', description: 'Cash, bank wires, cheques, and card receipts' },
  { id: 'OUTSTANDING', label: '4. Outstanding Receivables', category: 'Receivables', description: 'Uncollected balances across active invoices' },
  { id: 'OVERDUE', label: '5. Overdue Invoices', category: 'Receivables', description: 'Invoices exceeding agreed credit payment terms' },
  { id: 'VAT', label: '6. UAE VAT 201 Return', category: 'Compliance & Analysis', description: 'FTA Box 1 supplies and net VAT payable breakdown' },
  { id: 'CREDIT_NOTES', label: '7. Credit Notes Register', category: 'Sales', description: 'Adjustments, line corrections, and refunds' },
  { id: 'CUSTOMER_STATEMENT', label: '8. Customer Statement', category: 'Compliance & Analysis', description: 'Chronological ledger with debits, credits, and balance' },
  { id: 'REVENUE_BY_CUSTOMER', label: '9. Revenue by Customer', category: 'Compliance & Analysis', description: 'Top client volume, collections, and balances' },
  { id: 'REVENUE_BY_PRODUCT', label: '10. Revenue by Product/Service', category: 'Compliance & Analysis', description: 'Product breakdown, units sold, and revenues' },
  { id: 'AGEING', label: '11. Receivables Ageing Schedule', category: 'Receivables', description: 'Standard 0-30, 31-60, 61-90, 90+ days aging' },
];

export function ReportsView() {
  const company = companyService.getSettings();
  const customers = db.getCustomers();

  // Active Report Selection
  const [activeReport, setActiveReport] = useState<ReportType>('SALES');

  // Filter States
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');
  const [vatTreatment, setVatTreatment] = useState<VatTreatment | 'ALL'>('ALL');
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'OVERDUE' | 'ALL'>('ALL');
  const [search, setSearch] = useState<string>('');

  // Pagination & Sorting State
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [sortBy, setSortBy] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Customer Statement specific selection
  const [statementCustomerId, setStatementCustomerId] = useState<string>(customers[0]?.id || '');

  // Reset page when filters or report type change
  const handleFilterChange = (updater: () => void) => {
    updater();
    setPage(1);
  };

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setCustomerId('ALL');
    setStatus('ALL');
    setVatTreatment('ALL');
    setPaymentStatus('ALL');
    setSearch('');
    setSortBy('');
    setPage(1);
  };

  const setDatePreset = (preset: 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_QUARTER' | 'THIS_YEAR' | 'ALL') => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    handleFilterChange(() => {
      switch (preset) {
        case 'THIS_MONTH': {
          const s = new Date(year, month, 1).toISOString().split('T')[0];
          const e = new Date(year, month + 1, 0).toISOString().split('T')[0];
          setStartDate(s);
          setEndDate(e);
          break;
        }
        case 'LAST_MONTH': {
          const s = new Date(year, month - 1, 1).toISOString().split('T')[0];
          const e = new Date(year, month, 0).toISOString().split('T')[0];
          setStartDate(s);
          setEndDate(e);
          break;
        }
        case 'THIS_QUARTER': {
          const q = Math.floor(month / 3);
          const s = new Date(year, q * 3, 1).toISOString().split('T')[0];
          const e = new Date(year, q * 3 + 3, 0).toISOString().split('T')[0];
          setStartDate(s);
          setEndDate(e);
          break;
        }
        case 'THIS_YEAR': {
          setStartDate(`${year}-01-01`);
          setEndDate(`${year}-12-31`);
          break;
        }
        case 'ALL':
        default:
          setStartDate('');
          setEndDate('');
          break;
      }
    });
  };

  const handleSort = (columnKey: string) => {
    if (sortBy === columnKey) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortBy('');
        setSortDirection('asc');
      }
    } else {
      setSortBy(columnKey);
      setSortDirection('asc');
    }
  };

  const filterOptions: ReportFilterOptions = useMemo(
    () => ({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      customerId: customerId === 'ALL' ? undefined : customerId,
      status: status === 'ALL' ? undefined : status,
      vatTreatment: vatTreatment === 'ALL' ? undefined : vatTreatment,
      paymentStatus: paymentStatus === 'ALL' ? undefined : paymentStatus,
      search: search || undefined,
      sortBy: sortBy || undefined,
      sortDirection,
      page,
      pageSize,
    }),
    [startDate, endDate, customerId, status, vatTreatment, paymentStatus, search, sortBy, sortDirection, page, pageSize]
  );

  // Compute Active Report Data
  const reportResult = useMemo(() => {
    switch (activeReport) {
      case 'SALES':
        return reportService.getSalesReport(filterOptions);
      case 'INVOICES':
        return reportService.getInvoiceReport(filterOptions);
      case 'PAYMENTS':
        return reportService.getPaymentReport(filterOptions);
      case 'OUTSTANDING':
        return reportService.getOutstandingReport(filterOptions);
      case 'OVERDUE':
        return reportService.getOverdueReport(filterOptions);
      case 'VAT':
        return reportService.getVatReport(filterOptions);
      case 'CREDIT_NOTES':
        return reportService.getCreditNoteReport(filterOptions);
      case 'CUSTOMER_STATEMENT':
        return reportService.getCustomerStatementReport(
          customerId !== 'ALL' ? customerId : statementCustomerId,
          filterOptions
        );
      case 'REVENUE_BY_CUSTOMER':
        return reportService.getRevenueByCustomerReport(filterOptions);
      case 'REVENUE_BY_PRODUCT':
        return reportService.getRevenueByProductReport(filterOptions);
      case 'AGEING':
        return reportService.getAgeingReport(filterOptions);
      default:
        return null;
    }
  }, [activeReport, filterOptions, customerId, statementCustomerId]);

  // Export handlers
  const handleExportCSV = () => {
    const activeConfig = REPORT_TABS.find((t) => t.id === activeReport);
    const title = activeConfig?.label.replace(/^[0-9.]+\s*/, '') || 'Report';

    // Retrieve all records without pagination for full export
    const fullFilter: ReportFilterOptions = { ...filterOptions, page: 1, pageSize: 10000 };

    if (activeReport === 'SALES') {
      const res = reportService.getSalesReport(fullFilter);
      reportService.exportToCSV(
        `Sales_Report_${new Date().toISOString().split('T')[0]}`,
        [
          { label: 'Date', key: 'date' },
          { label: 'Invoice Number', key: 'invoice_number' },
          { label: 'Customer', key: 'customer_name' },
          { label: 'Reference', key: 'reference' },
          { label: 'Net Subtotal', key: 'subtotal_net' },
          { label: 'Discount', key: 'discount_amount' },
          { label: 'VAT Total', key: 'vat_total' },
          { label: 'Grand Total', key: 'grand_total' },
          { label: 'Status', key: 'status' },
          { label: 'Payment Status', key: 'payment_status' },
        ],
        res.data
      );
    } else if (activeReport === 'INVOICES') {
      const res = reportService.getInvoiceReport(fullFilter);
      reportService.exportToCSV(
        `Invoices_Report_${new Date().toISOString().split('T')[0]}`,
        [
          { label: 'Invoice #', key: 'invoice_number' },
          { label: 'Date', key: 'invoice_date' },
          { label: 'Due Date', key: 'due_date' },
          { label: 'Customer', key: 'customer_name' },
          { label: 'TRN', key: 'trn' },
          { label: 'Subtotal Net', key: 'subtotal_net' },
          { label: 'VAT Amount', key: 'vat_total' },
          { label: 'Grand Total', key: 'grand_total' },
          { label: 'Paid', key: 'amount_paid' },
          { label: 'Balance Due', key: 'balance_due' },
          { label: 'Status', key: 'status' },
        ],
        res.data
      );
    } else if (activeReport === 'PAYMENTS') {
      const res = reportService.getPaymentReport(fullFilter);
      reportService.exportToCSV(
        `Payments_Report_${new Date().toISOString().split('T')[0]}`,
        [
          { label: 'Payment #', key: 'payment_number' },
          { label: 'Date', key: 'payment_date' },
          { label: 'Invoice #', key: 'invoice_number' },
          { label: 'Customer', key: 'customer_name' },
          { label: 'Method', key: 'payment_method' },
          { label: 'Reference', key: 'reference_number' },
          { label: 'Amount', key: 'amount' },
          { label: 'Status', key: 'status' },
        ],
        res.data
      );
    } else if (activeReport === 'OUTSTANDING') {
      const res = reportService.getOutstandingReport(fullFilter);
      reportService.exportToCSV(
        `Outstanding_Receivables_${new Date().toISOString().split('T')[0]}`,
        [
          { label: 'Invoice #', key: 'invoice_number' },
          { label: 'Date', key: 'invoice_date' },
          { label: 'Due Date', key: 'due_date' },
          { label: 'Customer', key: 'customer_name' },
          { label: 'Total Amount', key: 'total_amount' },
          { label: 'Paid', key: 'amount_paid' },
          { label: 'Balance Due', key: 'balance_due' },
          { label: 'Days Open', key: 'days_open' },
          { label: 'Status', key: 'status' },
        ],
        res.data
      );
    } else if (activeReport === 'OVERDUE') {
      const res = reportService.getOverdueReport(fullFilter);
      reportService.exportToCSV(
        `Overdue_Invoices_${new Date().toISOString().split('T')[0]}`,
        [
          { label: 'Invoice #', key: 'invoice_number' },
          { label: 'Date', key: 'invoice_date' },
          { label: 'Due Date', key: 'due_date' },
          { label: 'Customer', key: 'customer_name' },
          { label: 'Days Overdue', key: 'days_overdue' },
          { label: 'Total Amount', key: 'total_amount' },
          { label: 'Balance Due', key: 'balance_due' },
          { label: 'Status', key: 'status' },
        ],
        res.data
      );
    } else if (activeReport === 'VAT') {
      const res = reportService.getVatReport(fullFilter);
      reportService.exportToCSV(
        `UAE_VAT_201_Report_${new Date().toISOString().split('T')[0]}`,
        [
          { label: 'Date', key: 'date' },
          { label: 'Type', key: 'document_type' },
          { label: 'Doc Number', key: 'document_number' },
          { label: 'Customer', key: 'customer_name' },
          { label: 'TRN', key: 'trn' },
          { label: 'VAT Treatment', key: 'vat_treatment' },
          { label: 'Taxable Amount', key: 'taxable_subtotal' },
          { label: 'VAT Amount', key: 'vat_amount' },
          { label: 'Grand Total', key: 'grand_total' },
        ],
        res.transactions.data
      );
    } else if (activeReport === 'CREDIT_NOTES') {
      const res = reportService.getCreditNoteReport(fullFilter);
      reportService.exportToCSV(
        `Credit_Notes_Report_${new Date().toISOString().split('T')[0]}`,
        [
          { label: 'Credit Note #', key: 'credit_note_number' },
          { label: 'Date', key: 'credit_note_date' },
          { label: 'Invoice #', key: 'invoice_number' },
          { label: 'Customer', key: 'customer_name' },
          { label: 'Reason', key: 'reason' },
          { label: 'Type', key: 'credit_type' },
          { label: 'Subtotal Net', key: 'subtotal_net' },
          { label: 'VAT Total', key: 'vat_total' },
          { label: 'Grand Total', key: 'grand_total' },
          { label: 'Refund Status', key: 'refund_status' },
          { label: 'Status', key: 'status' },
        ],
        res.data
      );
    } else if (activeReport === 'CUSTOMER_STATEMENT') {
      const res = reportService.getCustomerStatementReport(
        customerId !== 'ALL' ? customerId : statementCustomerId,
        fullFilter
      );
      reportService.exportToCSV(
        `Customer_Statement_${res.customer?.company_name || 'Client'}_${new Date().toISOString().split('T')[0]}`,
        [
          { label: 'Date', key: 'date' },
          { label: 'Type', key: 'type' },
          { label: 'Reference', key: 'reference' },
          { label: 'Description', key: 'description' },
          { label: 'Debit (Billed)', key: 'debit' },
          { label: 'Credit (Paid/Credit)', key: 'credit' },
          { label: 'Running Balance', key: 'running_balance' },
        ],
        res.ledger
      );
    } else if (activeReport === 'REVENUE_BY_CUSTOMER') {
      const res = reportService.getRevenueByCustomerReport(fullFilter);
      reportService.exportToCSV(
        `Revenue_By_Customer_${new Date().toISOString().split('T')[0]}`,
        [
          { label: 'Customer', key: 'customer_name' },
          { label: 'TRN', key: 'trn' },
          { label: 'Emirate', key: 'emirate' },
          { label: 'Invoices Count', key: 'invoices_count' },
          { label: 'Gross Invoiced', key: 'gross_invoiced' },
          { label: 'Credit Adjustments', key: 'credit_deductions' },
          { label: 'Net Revenue', key: 'net_revenue' },
          { label: 'Collected', key: 'payments_collected' },
          { label: 'Outstanding Balance', key: 'outstanding_balance' },
        ],
        res.data
      );
    } else if (activeReport === 'REVENUE_BY_PRODUCT') {
      const res = reportService.getRevenueByProductReport(fullFilter);
      reportService.exportToCSV(
        `Revenue_By_Product_${new Date().toISOString().split('T')[0]}`,
        [
          { label: 'Product / Service', key: 'product_name' },
          { label: 'Quantity Sold', key: 'quantity_sold' },
          { label: 'Unit', key: 'unit' },
          { label: 'Net Revenue', key: 'net_revenue' },
          { label: 'VAT Amount', key: 'vat_amount' },
          { label: 'Total Gross', key: 'total_gross' },
          { label: '% of Sales', key: 'percentage_of_sales' },
        ],
        res.data
      );
    } else if (activeReport === 'AGEING') {
      const res = reportService.getAgeingReport(fullFilter);
      reportService.exportToCSV(
        `Receivables_Ageing_${new Date().toISOString().split('T')[0]}`,
        [
          { label: 'Customer', key: 'customer_name' },
          { label: 'Invoice #', key: 'invoice_number' },
          { label: 'Due Date', key: 'due_date' },
          { label: 'Days Overdue', key: 'days_overdue' },
          { label: '0-30 Days', key: 'current' },
          { label: '31-60 Days', key: 'days31_60' },
          { label: '61-90 Days', key: 'days61_90' },
          { label: '90+ Days', key: 'days90_plus' },
          { label: 'Total Due', key: 'total_due' },
        ],
        res.records.data
      );
    }
  };

  const handleExportExcel = () => {
    const fullFilter: ReportFilterOptions = { ...filterOptions, page: 1, pageSize: 10000 };

    if (activeReport === 'SALES') {
      const res = reportService.getSalesReport(fullFilter);
      reportService.exportToExcel(
        'Sales Summary Report',
        [
          { label: 'Date', key: 'date' },
          { label: 'Invoice Number', key: 'invoice_number' },
          { label: 'Customer', key: 'customer_name' },
          { label: 'Reference', key: 'reference' },
          { label: 'Net Subtotal', key: 'subtotal_net' },
          { label: 'Discount', key: 'discount_amount' },
          { label: 'VAT Total', key: 'vat_total' },
          { label: 'Grand Total', key: 'grand_total' },
          { label: 'Status', key: 'status' },
          { label: 'Payment Status', key: 'payment_status' },
        ],
        res.data
      );
    } else if (activeReport === 'INVOICES') {
      const res = reportService.getInvoiceReport(fullFilter);
      reportService.exportToExcel(
        'Invoices Register Report',
        [
          { label: 'Invoice #', key: 'invoice_number' },
          { label: 'Date', key: 'invoice_date' },
          { label: 'Due Date', key: 'due_date' },
          { label: 'Customer', key: 'customer_name' },
          { label: 'TRN', key: 'trn' },
          { label: 'Subtotal Net', key: 'subtotal_net' },
          { label: 'VAT Amount', key: 'vat_total' },
          { label: 'Grand Total', key: 'grand_total' },
          { label: 'Paid', key: 'amount_paid' },
          { label: 'Balance Due', key: 'balance_due' },
          { label: 'Status', key: 'status' },
        ],
        res.data
      );
    } else if (activeReport === 'VAT') {
      const res = reportService.getVatReport(fullFilter);
      reportService.exportToExcel(
        'UAE VAT Return 201 Report',
        [
          { label: 'Date', key: 'date' },
          { label: 'Type', key: 'document_type' },
          { label: 'Doc Number', key: 'document_number' },
          { label: 'Customer', key: 'customer_name' },
          { label: 'TRN', key: 'trn' },
          { label: 'VAT Treatment', key: 'vat_treatment' },
          { label: 'Taxable Amount', key: 'taxable_subtotal' },
          { label: 'VAT Amount', key: 'vat_amount' },
          { label: 'Grand Total', key: 'grand_total' },
        ],
        res.transactions.data
      );
    } else if (activeReport === 'AGEING') {
      const res = reportService.getAgeingReport(fullFilter);
      reportService.exportToExcel(
        'Receivables Ageing Report',
        [
          { label: 'Customer', key: 'customer_name' },
          { label: 'Invoice #', key: 'invoice_number' },
          { label: 'Due Date', key: 'due_date' },
          { label: 'Days Overdue', key: 'days_overdue' },
          { label: '0-30 Days', key: 'current' },
          { label: '31-60 Days', key: 'days31_60' },
          { label: '61-90 Days', key: 'days61_90' },
          { label: '90+ Days', key: 'days90_plus' },
          { label: 'Total Due', key: 'total_due' },
        ],
        res.records.data
      );
    } else {
      // Default fallback using CSV exporter logic
      handleExportCSV();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const renderSortIcon = (columnKey: string) => {
    if (sortBy !== columnKey) {
      return <ArrowUpDown className="h-3 w-3 text-slate-400 ml-1 inline opacity-40 hover:opacity-100" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-emerald-600 ml-1 inline" />
    ) : (
      <ArrowDown className="h-3 w-3 text-emerald-600 ml-1 inline" />
    );
  };

  return (
    <div className="space-y-6">
      {/* Print-Only Header */}
      <div className="hidden print:block mb-6 border-b border-slate-300 pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{company.trading_name || company.legal_company_name}</h1>
            <p className="text-xs text-slate-600">TRN: {company.trn} • {company.emirate}, UAE</p>
            <h2 className="text-lg font-semibold text-slate-800 mt-2">
              {REPORT_TABS.find((t) => t.id === activeReport)?.label}
            </h2>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Printed on: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
            <p>Currency: {company.default_currency}</p>
          </div>
        </div>
      </div>

      {/* Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200 mb-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>UAE FTA Compliant • Executive Accounting Suite</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Financial & Tax Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-ready reporting with multi-column sorting, granular filters, CSV, Excel, and PDF exports.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="text-slate-700 bg-white hover:bg-slate-50 border-slate-300"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-600" />
            <span>Export CSV</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="text-slate-700 bg-white hover:bg-slate-50 border-slate-300"
          >
            <Download className="h-4 w-4 mr-1.5 text-sky-600" />
            <span>Export Excel</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="text-slate-700 bg-white hover:bg-slate-50 border-slate-300"
          >
            <Printer className="h-4 w-4 mr-1.5 text-slate-600" />
            <span>Print / PDF</span>
          </Button>
        </div>
      </div>

      {/* Report Categorized Tab Switcher */}
      <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs print:hidden">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
          {REPORT_TABS.map((tab) => {
            const isActive = activeReport === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveReport(tab.id);
                  setPage(1);
                  setSortBy('');
                }}
                className={`px-3 py-2 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Granular Universal Filter Bar */}
      <Card className="print:hidden">
        <CardContent className="p-4 space-y-3">
          {/* Row 1: Search, Date Range, and Presets */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-4 relative">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Search Records
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => handleFilterChange(() => setSearch(e.target.value))}
                  placeholder="Search invoice, customer, reference..."
                  className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => handleFilterChange(() => setSearch(''))}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleFilterChange(() => setStartDate(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleFilterChange(() => setEndDate(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="md:col-span-4 flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setDatePreset('THIS_MONTH')}
                className="px-2 py-1 text-[11px] font-medium rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => setDatePreset('LAST_MONTH')}
                className="px-2 py-1 text-[11px] font-medium rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Last Month
              </button>
              <button
                type="button"
                onClick={() => setDatePreset('THIS_QUARTER')}
                className="px-2 py-1 text-[11px] font-medium rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                This Quarter
              </button>
              <button
                type="button"
                onClick={() => setDatePreset('THIS_YEAR')}
                className="px-2 py-1 text-[11px] font-medium rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                This Year
              </button>
              <button
                type="button"
                onClick={() => setDatePreset('ALL')}
                className="px-2 py-1 text-[11px] font-medium rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                All Time
              </button>
            </div>
          </div>

          {/* Row 2: Customer, Status, VAT Treatment, Payment Status, Reset */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1 border-t border-slate-100">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Customer
              </label>
              <select
                value={activeReport === 'CUSTOMER_STATEMENT' ? (customerId !== 'ALL' ? customerId : statementCustomerId) : customerId}
                onChange={(e) => {
                  const val = e.target.value;
                  handleFilterChange(() => {
                    setCustomerId(val);
                    if (activeReport === 'CUSTOMER_STATEMENT') setStatementCustomerId(val);
                  });
                }}
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
              >
                {activeReport !== 'CUSTOMER_STATEMENT' && <option value="ALL">All Customers</option>}
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name || c.contact_person}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => handleFilterChange(() => setStatus(e.target.value))}
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="ISSUED">Issued</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PAID">Paid</option>
                <option value="OVERDUE">Overdue</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                VAT Treatment
              </label>
              <select
                value={vatTreatment}
                onChange={(e) => handleFilterChange(() => setVatTreatment(e.target.value as any))}
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
              >
                <option value="ALL">All Treatments</option>
                <option value="STANDARD_RATED">Standard Rated (5%)</option>
                <option value="ZERO_RATED">Zero-Rated (0%)</option>
                <option value="EXEMPT">Exempt</option>
                <option value="OUT_OF_SCOPE">Out of Scope</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Payment Status
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => handleFilterChange(() => setPaymentStatus(e.target.value as any))}
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
              >
                <option value="ALL">All Payment Statuses</option>
                <option value="PAID">Paid</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="UNPAID">Unpaid</option>
                <option value="OVERDUE">Overdue</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="w-full text-slate-500 hover:text-slate-800 text-xs py-1.5 border border-slate-200"
              >
                <RefreshCw className="h-3 w-3 mr-1" /> Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Output Presentation Card */}
      <Card className="shadow-xs border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">
              {REPORT_TABS.find((t) => t.id === activeReport)?.label}
            </CardTitle>
            <CardDescription>
              {REPORT_TABS.find((t) => t.id === activeReport)?.description}
            </CardDescription>
          </div>
          {startDate && endDate && (
            <div className="text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
              Period: <strong className="text-slate-800">{formatDate(startDate)}</strong> to{' '}
              <strong className="text-slate-800">{formatDate(endDate)}</strong>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* ========================================================================= */}
          {/* 1. SALES REPORT */}
          {/* ========================================================================= */}
          {activeReport === 'SALES' && reportResult && (
            <div className="space-y-4">
              {/* Summary KPIs */}
              {'summary' in reportResult && (reportResult as any).summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[11px] font-medium text-slate-500">Taxable Net Sales</div>
                    <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                      {formatCurrency(Number((reportResult as any).summary.totalNet || 0))}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[11px] font-medium text-slate-500">Line & Invoice Discounts</div>
                    <div className="text-lg font-bold text-slate-700 font-mono mt-0.5">
                      {formatCurrency(Number((reportResult as any).summary.totalDiscount || 0))}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-200">
                    <div className="text-[11px] font-medium text-indigo-700">Output VAT (5%)</div>
                    <div className="text-lg font-bold text-indigo-900 font-mono mt-0.5">
                      {formatCurrency(Number((reportResult as any).summary.totalVat || 0))}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200">
                    <div className="text-[11px] font-medium text-emerald-700">Grand Total Invoiced</div>
                    <div className="text-lg font-bold text-emerald-950 font-mono mt-0.5">
                      {formatCurrency(Number((reportResult as any).summary.totalGrand || 0))}
                    </div>
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left min-w-[950px]">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                    <tr>
                      <th className="p-2.5 cursor-pointer" onClick={() => handleSort('date')}>
                        Date {renderSortIcon('date')}
                      </th>
                      <th className="p-2.5 cursor-pointer" onClick={() => handleSort('invoice_number')}>
                        Invoice # {renderSortIcon('invoice_number')}
                      </th>
                      <th className="p-2.5 cursor-pointer" onClick={() => handleSort('customer_name')}>
                        Customer {renderSortIcon('customer_name')}
                      </th>
                      <th className="p-2.5">Reference</th>
                      <th className="p-2.5 text-right cursor-pointer" onClick={() => handleSort('subtotal_net')}>
                        Net Subtotal {renderSortIcon('subtotal_net')}
                      </th>
                      <th className="p-2.5 text-right">Discount</th>
                      <th className="p-2.5 text-right cursor-pointer" onClick={() => handleSort('vat_total')}>
                        Output VAT {renderSortIcon('vat_total')}
                      </th>
                      <th className="p-2.5 text-right cursor-pointer" onClick={() => handleSort('grand_total')}>
                        Grand Total {renderSortIcon('grand_total')}
                      </th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {'data' in reportResult && (reportResult.data as any[]).length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400">
                          No sales records found matching the active filters.
                        </td>
                      </tr>
                    ) : (
                      'data' in reportResult &&
                      (reportResult.data as any[]).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2.5 text-slate-500 whitespace-nowrap">{formatDate(row.date)}</td>
                          <td className="p-2.5 font-mono font-semibold text-slate-900">{row.invoice_number}</td>
                          <td className="p-2.5 font-medium text-slate-800">{row.customer_name}</td>
                          <td className="p-2.5 text-slate-500">{row.reference}</td>
                          <td className="p-2.5 text-right font-mono">{formatCurrency(row.subtotal_net)}</td>
                          <td className="p-2.5 text-right font-mono text-slate-500">
                            {row.discount_amount > 0 ? formatCurrency(row.discount_amount) : '-'}
                          </td>
                          <td className="p-2.5 text-right font-mono text-indigo-700 font-medium">
                            {formatCurrency(row.vat_total)}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(row.grand_total)}
                          </td>
                          <td className="p-2.5 text-center">
                            <StatusBadge status={row.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. INVOICE REGISTER REPORT */}
          {/* ========================================================================= */}
          {activeReport === 'INVOICES' && reportResult && (
            <div className="space-y-4">
              {'summary' in reportResult && (reportResult as any).summary && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:grid-cols-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[11px] font-medium text-slate-500">Total Invoiced</div>
                    <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                      {formatCurrency(Number((reportResult as any).summary.totalGrand || 0))}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200">
                    <div className="text-[11px] font-medium text-emerald-700">Amount Paid</div>
                    <div className="text-lg font-bold text-emerald-900 font-mono mt-0.5">
                      {formatCurrency(Number((reportResult as any).summary.totalPaid || 0))}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-sky-50/50 border border-sky-200">
                    <div className="text-[11px] font-medium text-sky-700">Balance Due</div>
                    <div className="text-lg font-bold text-sky-900 font-mono mt-0.5">
                      {formatCurrency(Number((reportResult as any).summary.totalDue || 0))}
                    </div>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left min-w-[1000px]">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                    <tr>
                      <th className="p-2.5 cursor-pointer" onClick={() => handleSort('invoice_number')}>
                        Invoice # {renderSortIcon('invoice_number')}
                      </th>
                      <th className="p-2.5 cursor-pointer" onClick={() => handleSort('invoice_date')}>
                        Date {renderSortIcon('invoice_date')}
                      </th>
                      <th className="p-2.5 cursor-pointer" onClick={() => handleSort('due_date')}>
                        Due Date {renderSortIcon('due_date')}
                      </th>
                      <th className="p-2.5 cursor-pointer" onClick={() => handleSort('customer_name')}>
                        Customer {renderSortIcon('customer_name')}
                      </th>
                      <th className="p-2.5">TRN</th>
                      <th className="p-2.5 text-right">Subtotal</th>
                      <th className="p-2.5 text-right">VAT</th>
                      <th className="p-2.5 text-right cursor-pointer" onClick={() => handleSort('grand_total')}>
                        Total {renderSortIcon('grand_total')}
                      </th>
                      <th className="p-2.5 text-right">Paid</th>
                      <th className="p-2.5 text-right cursor-pointer" onClick={() => handleSort('balance_due')}>
                        Balance Due {renderSortIcon('balance_due')}
                      </th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {'data' in reportResult && (reportResult.data as any[]).length === 0 ? (
                      <tr>
                        <td colSpan={11} className="p-8 text-center text-slate-400">
                          No invoices found.
                        </td>
                      </tr>
                    ) : (
                      'data' in reportResult &&
                      (reportResult.data as any[]).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2.5 font-mono font-semibold text-slate-900">{row.invoice_number}</td>
                          <td className="p-2.5 text-slate-500 whitespace-nowrap">{formatDate(row.invoice_date)}</td>
                          <td className="p-2.5 text-slate-500 whitespace-nowrap">{formatDate(row.due_date)}</td>
                          <td className="p-2.5 font-medium text-slate-800">{row.customer_name}</td>
                          <td className="p-2.5 font-mono text-slate-500">{row.trn}</td>
                          <td className="p-2.5 text-right font-mono">{formatCurrency(row.subtotal_net)}</td>
                          <td className="p-2.5 text-right font-mono">{formatCurrency(row.vat_total)}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatCurrency(row.grand_total)}</td>
                          <td className="p-2.5 text-right font-mono text-emerald-700">{formatCurrency(row.amount_paid)}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatCurrency(row.balance_due)}</td>
                          <td className="p-2.5 text-center"><StatusBadge status={row.status} /></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. PAYMENTS REPORT */}
          {/* ========================================================================= */}
          {activeReport === 'PAYMENTS' && reportResult && (
            <div className="space-y-4">
              {'summary' in reportResult && (reportResult as any).summary && (
                <div className="p-4 rounded-xl bg-emerald-50/40 border border-emerald-200 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-emerald-800">Total Cash Collections</div>
                    <div className="text-2xl font-bold font-mono text-emerald-950 mt-0.5">
                      {formatCurrency(Number((reportResult as any).summary.totalCollected || 0))}
                    </div>
                  </div>
                  <div className="text-xs text-emerald-700 bg-emerald-100/60 px-3 py-1 rounded-full font-medium">
                    {(reportResult as any).summary.recordedCount} Valid Payment Receipts
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left min-w-[900px]">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                    <tr>
                      <th className="p-2.5 cursor-pointer" onClick={() => handleSort('payment_number')}>
                        Payment # {renderSortIcon('payment_number')}
                      </th>
                      <th className="p-2.5 cursor-pointer" onClick={() => handleSort('payment_date')}>
                        Date {renderSortIcon('payment_date')}
                      </th>
                      <th className="p-2.5">Invoice #</th>
                      <th className="p-2.5 cursor-pointer" onClick={() => handleSort('customer_name')}>
                        Customer {renderSortIcon('customer_name')}
                      </th>
                      <th className="p-2.5">Method</th>
                      <th className="p-2.5">Reference #</th>
                      <th className="p-2.5 text-right cursor-pointer" onClick={() => handleSort('amount')}>
                        Amount {renderSortIcon('amount')}
                      </th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {'data' in reportResult && (reportResult.data as any[]).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">
                          No payment transactions recorded.
                        </td>
                      </tr>
                    ) : (
                      'data' in reportResult &&
                      (reportResult.data as any[]).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2.5 font-mono font-semibold text-slate-900">{row.payment_number}</td>
                          <td className="p-2.5 text-slate-500 whitespace-nowrap">{formatDate(row.payment_date)}</td>
                          <td className="p-2.5 font-mono text-slate-700">{row.invoice_number}</td>
                          <td className="p-2.5 font-medium text-slate-800">{row.customer_name}</td>
                          <td className="p-2.5 text-slate-600">{row.payment_method}</td>
                          <td className="p-2.5 font-mono text-slate-500">{row.reference_number}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-800">
                            {formatCurrency(row.amount)}
                          </td>
                          <td className="p-2.5 text-center"><StatusBadge status={row.status} /></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 4. OUTSTANDING RECEIVABLES REPORT */}
          {/* ========================================================================= */}
          {activeReport === 'OUTSTANDING' && reportResult && (
            <div className="space-y-4">
              {'summary' in reportResult && (reportResult as any).summary && (
                <div className="p-4 rounded-xl bg-sky-50/50 border border-sky-200 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-sky-800">Total Outstanding Receivables</div>
                    <div className="text-2xl font-bold font-mono text-sky-950 mt-0.5">
                      {formatCurrency(Number((reportResult as any).summary.totalOutstanding || 0))}
                    </div>
                  </div>
                  <div className="text-xs text-sky-700">Uncollected balances on active invoices</div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left min-w-[850px]">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                    <tr>
                      <th className="p-2.5 cursor-pointer" onClick={() => handleSort('invoice_number')}>
                        Invoice # {renderSortIcon('invoice_number')}
                      </th>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Due Date</th>
                      <th className="p-2.5 cursor-pointer" onClick={() => handleSort('customer_name')}>
                        Customer {renderSortIcon('customer_name')}
                      </th>
                      <th className="p-2.5">Contact Phone</th>
                      <th className="p-2.5 text-right">Invoiced Amount</th>
                      <th className="p-2.5 text-right">Paid</th>
                      <th className="p-2.5 text-right cursor-pointer" onClick={() => handleSort('balance_due')}>
                        Balance Due {renderSortIcon('balance_due')}
                      </th>
                      <th className="p-2.5 text-center">Days Open</th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {'data' in reportResult && (reportResult.data as any[]).length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-slate-400">
                          All issued invoices are fully paid! No outstanding balances.
                        </td>
                      </tr>
                    ) : (
                      'data' in reportResult &&
                      (reportResult.data as any[]).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2.5 font-mono font-semibold text-slate-900">{row.invoice_number}</td>
                          <td className="p-2.5 text-slate-500 whitespace-nowrap">{formatDate(row.invoice_date)}</td>
                          <td className="p-2.5 text-slate-500 whitespace-nowrap">{formatDate(row.due_date)}</td>
                          <td className="p-2.5 font-medium text-slate-800">{row.customer_name}</td>
                          <td className="p-2.5 text-slate-500">{row.phone}</td>
                          <td className="p-2.5 text-right font-mono">{formatCurrency(row.total_amount)}</td>
                          <td className="p-2.5 text-right font-mono text-emerald-700">{formatCurrency(row.amount_paid)}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatCurrency(row.balance_due)}</td>
                          <td className="p-2.5 text-center font-mono text-slate-600">{row.days_open} d</td>
                          <td className="p-2.5 text-center"><StatusBadge status={row.status} /></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 5. OVERDUE INVOICES REPORT */}
          {/* ========================================================================= */}
          {activeReport === 'OVERDUE' && reportResult && (
            <div className="space-y-4">
              {'summary' in reportResult && (reportResult as any).summary && (
                <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-rose-800">Total Delinquent Overdue Amount</div>
                    <div className="text-2xl font-bold font-mono text-rose-700 mt-0.5">
                      {formatCurrency(Number((reportResult as any).summary.totalOverdue || 0))}
                    </div>
                  </div>
                  <div className="text-xs text-rose-700 bg-rose-100 px-3 py-1 rounded-full font-medium">
                    Immediate Accounts Receivable Follow-up Required
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left min-w-[850px]">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                    <tr>
                      <th className="p-2.5 cursor-pointer" onClick={() => handleSort('invoice_number')}>
                        Invoice # {renderSortIcon('invoice_number')}
                      </th>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Due Date</th>
                      <th className="p-2.5 cursor-pointer" onClick={() => handleSort('customer_name')}>
                        Customer {renderSortIcon('customer_name')}
                      </th>
                      <th className="p-2.5 text-center cursor-pointer" onClick={() => handleSort('days_overdue')}>
                        Days Overdue {renderSortIcon('days_overdue')}
                      </th>
                      <th className="p-2.5 text-right">Invoiced Amount</th>
                      <th className="p-2.5 text-right">Paid</th>
                      <th className="p-2.5 text-right cursor-pointer" onClick={() => handleSort('balance_due')}>
                        Overdue Balance {renderSortIcon('balance_due')}
                      </th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {'data' in reportResult && (reportResult.data as any[]).length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400">
                          Great news! There are no overdue invoices currently.
                        </td>
                      </tr>
                    ) : (
                      'data' in reportResult &&
                      (reportResult.data as any[]).map((row, idx) => (
                        <tr key={idx} className="hover:bg-rose-50/30 transition-colors">
                          <td className="p-2.5 font-mono font-semibold text-slate-900">{row.invoice_number}</td>
                          <td className="p-2.5 text-slate-500 whitespace-nowrap">{formatDate(row.invoice_date)}</td>
                          <td className="p-2.5 text-rose-600 font-medium whitespace-nowrap">{formatDate(row.due_date)}</td>
                          <td className="p-2.5 font-medium text-slate-800">{row.customer_name}</td>
                          <td className="p-2.5 text-center">
                            <span className="inline-block px-2 py-0.5 rounded font-mono font-bold text-xs bg-rose-100 text-rose-700">
                              {row.days_overdue} days
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-mono">{formatCurrency(row.total_amount)}</td>
                          <td className="p-2.5 text-right font-mono text-emerald-700">{formatCurrency(row.amount_paid)}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-rose-600">{formatCurrency(row.balance_due)}</td>
                          <td className="p-2.5 text-center"><StatusBadge status={row.status} /></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 6. UAE VAT 201 RETURN REPORT */}
          {/* ========================================================================= */}
          {activeReport === 'VAT' && reportResult && 'summary' in reportResult && (
            <div className="space-y-6">
              {/* Official FTA Form VAT 201 Box 1: 7-Emirates Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Official FTA Form VAT 201: Box 1 Standard-Rated Supplies by Emirate
                      </h3>
                      <p className="text-xs text-slate-500">
                        Mandatory breakdown of standard rated supplies and credit adjustments under Article 71
                      </p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left min-w-[700px]">
                    <thead className="bg-slate-900 text-white font-semibold">
                      <tr>
                        <th className="p-2.5">Box #</th>
                        <th className="p-2.5">Emirate</th>
                        <th className="p-2.5 text-right">Gross Supplies (AED)</th>
                        <th className="p-2.5 text-right">Adjustments (Credit Notes) (AED)</th>
                        <th className="p-2.5 text-right">Net Taxable Supplies (AED)</th>
                        <th className="p-2.5 text-right">VAT Amount (5%) (AED)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {((reportResult as any).summary.emirateBoxes || []).map((b: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono font-bold text-slate-700">{b.boxNumber}</td>
                          <td className="p-2.5 font-medium text-slate-900">{b.emirate}</td>
                          <td className="p-2.5 text-right font-mono">{formatCurrency(b.grossSales)}</td>
                          <td className="p-2.5 text-right font-mono text-rose-600">
                            {b.creditAdjustments > 0 ? `-${formatCurrency(b.creditAdjustments)}` : '-'}
                          </td>
                          <td className="p-2.5 text-right font-mono font-semibold text-slate-800">{formatCurrency(b.netTaxable)}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-700">{formatCurrency(b.vatAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-slate-900">
                      <tr>
                        <td colSpan={2} className="p-2.5">Total Box 1 Standard Rated</td>
                        <td className="p-2.5 text-right font-mono">
                          {formatCurrency((reportResult as any).summary.standardRatedSales)}
                        </td>
                        <td className="p-2.5 text-right font-mono text-rose-600">
                          -{(reportResult as any).summary.creditNotesStandardAdjustment > 0
                            ? formatCurrency((reportResult as any).summary.creditNotesStandardAdjustment)
                            : '0.00'}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {formatCurrency((reportResult as any).summary.netStandardRatedSales)}
                        </td>
                        <td className="p-2.5 text-right font-mono text-emerald-800">
                          {formatCurrency((reportResult as any).summary.netStandardRatedVat)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Summary Boxes: Zero-Rated, Exempt, and Total Net Liability */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>Box 1c: Zero-Rated Supplies (0%)</span>
                      <span className="text-[10px] font-semibold text-sky-700 bg-sky-100 px-2 py-0.5 rounded">Article 45</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Total Taxable Amount:</span>
                      <span className="font-mono font-bold">{formatCurrency((reportResult as any).summary.zeroRatedSales)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Output Tax Amount:</span>
                      <span className="font-mono">AED 0.00</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>Box 1d: Exempt Supplies</span>
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Article 46</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Total Exempt Amount:</span>
                      <span className="font-mono font-bold">{formatCurrency((reportResult as any).summary.exemptSales || 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Output Tax Amount:</span>
                      <span className="font-mono">AED 0.00 (Exempt)</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white space-y-4 flex flex-col justify-between shadow-sm">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-500/30">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Federal Tax Authority (FTA) Net Position</span>
                    </div>
                    <div className="text-xs text-slate-300 uppercase tracking-wider font-semibold">
                      Total Output VAT Payable / ضريبة المخرجات المستحقة
                    </div>
                    <div className="text-3xl font-bold font-mono text-emerald-400">
                      {formatCurrency((reportResult as any).summary.netVatPayable)}
                    </div>
                    <p className="text-xs text-slate-300">
                      Net Output Tax due to the UAE Federal Tax Authority for the selected period after deducting eligible credit note adjustments.
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                    Calculated in strict compliance with UAE Federal Decree-Law No. (8) of 2017 & Executive Regulations.
                  </div>
                </div>
              </div>

              {/* Itemized Transactions Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Itemized VAT Transaction Drilldown
                  </h3>
                  <span className="text-xs text-slate-500">
                    Exact half-up Decimal.js commercial calculations
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left min-w-[900px]">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                      <tr>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Doc #</th>
                        <th className="p-2.5">Customer</th>
                        <th className="p-2.5">TRN</th>
                        <th className="p-2.5">VAT Treatment</th>
                        <th className="p-2.5 text-right">Taxable Net</th>
                        <th className="p-2.5 text-right">VAT (5%)</th>
                        <th className="p-2.5 text-right">Grand Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(reportResult as any).transactions.data.map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2.5 text-slate-500 whitespace-nowrap">{formatDate(row.date)}</td>
                          <td className="p-2.5 font-medium text-slate-700">{row.document_type}</td>
                          <td className="p-2.5 font-mono font-semibold text-slate-900">{row.document_number}</td>
                          <td className="p-2.5 text-slate-800">{row.customer_name}</td>
                          <td className="p-2.5 font-mono text-slate-500">{row.trn || '-'}</td>
                          <td className="p-2.5">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                              {row.vat_treatment}
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-mono">{formatCurrency(row.taxable_subtotal)}</td>
                          <td className="p-2.5 text-right font-mono text-indigo-700 font-semibold">{formatCurrency(row.vat_amount)}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatCurrency(row.grand_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 7. CREDIT NOTES REPORT */}
          {/* ========================================================================= */}
          {activeReport === 'CREDIT_NOTES' && reportResult && (
            <div className="space-y-4">
              {'summary' in reportResult && (reportResult as any).summary && (
                <div className="grid grid-cols-2 gap-3 print:grid-cols-2">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[11px] font-medium text-slate-500">Total Invoiced Amounts Credited</div>
                    <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                      {formatCurrency(Number((reportResult as any).summary.totalCredited || 0))}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-200">
                    <div className="text-[11px] font-medium text-indigo-700">Output VAT Adjustments (5%)</div>
                    <div className="text-lg font-bold text-indigo-900 font-mono mt-0.5">
                      {formatCurrency(Number((reportResult as any).summary.totalVat || 0))}
                    </div>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left min-w-[950px]">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                    <tr>
                      <th className="p-2.5 cursor-pointer" onClick={() => handleSort('credit_note_number')}>
                        Credit Note # {renderSortIcon('credit_note_number')}
                      </th>
                      <th className="p-2.5 cursor-pointer" onClick={() => handleSort('credit_note_date')}>
                        Date {renderSortIcon('credit_note_date')}
                      </th>
                      <th className="p-2.5">Original Invoice</th>
                      <th className="p-2.5 cursor-pointer" onClick={() => handleSort('customer_name')}>
                        Customer {renderSortIcon('customer_name')}
                      </th>
                      <th className="p-2.5">Reason</th>
                      <th className="p-2.5">Credit Mode</th>
                      <th className="p-2.5 text-right">Subtotal</th>
                      <th className="p-2.5 text-right">VAT</th>
                      <th className="p-2.5 text-right cursor-pointer" onClick={() => handleSort('grand_total')}>
                        Total Credited {renderSortIcon('grand_total')}
                      </th>
                      <th className="p-2.5 text-center">Refund Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {'data' in reportResult && (reportResult.data as any[]).length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-slate-400">
                          No credit notes issued.
                        </td>
                      </tr>
                    ) : (
                      'data' in reportResult &&
                      (reportResult.data as any[]).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2.5 font-mono font-semibold text-slate-900">{row.credit_note_number}</td>
                          <td className="p-2.5 text-slate-500 whitespace-nowrap">{formatDate(row.credit_note_date)}</td>
                          <td className="p-2.5 font-mono text-slate-700">{row.invoice_number || '-'}</td>
                          <td className="p-2.5 font-medium text-slate-800">{row.customer_name}</td>
                          <td className="p-2.5 text-slate-600 truncate max-w-[140px]">{row.reason}</td>
                          <td className="p-2.5">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                              {row.credit_type}
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-mono">{formatCurrency(row.subtotal_net)}</td>
                          <td className="p-2.5 text-right font-mono text-indigo-700">{formatCurrency(row.vat_total)}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatCurrency(row.grand_total)}</td>
                          <td className="p-2.5 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              {row.refund_status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 8. CUSTOMER STATEMENT */}
          {/* ========================================================================= */}
          {activeReport === 'CUSTOMER_STATEMENT' && reportResult && 'ledger' in reportResult && (
            <div className="space-y-4">
              {(() => {
                const stmt = reportResult as any;
                return (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
                      <div>
                        <div className="text-xs text-slate-500 uppercase font-semibold">Statement of Account</div>
                        <h2 className="text-lg font-bold text-slate-900">
                          {stmt.customer?.company_name || stmt.customer?.contact_person || 'Client'}
                        </h2>
                        <div className="text-xs text-slate-500">
                          TRN: <strong className="text-slate-800">{stmt.customer?.trn || 'Unregistered'}</strong> • Emirate:{' '}
                          <strong className="text-slate-800">{stmt.customer?.billing_emirate || 'Dubai'}</strong>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-900 text-white text-right">
                        <div className="text-[10px] uppercase tracking-wider text-slate-400">Current Outstanding Balance</div>
                        <div className="text-xl font-bold font-mono text-rose-400">{formatCurrency(stmt.closingBalance)}</div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left min-w-[750px]">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">Date</th>
                            <th className="p-2.5">Transaction Type</th>
                            <th className="p-2.5">Reference</th>
                            <th className="p-2.5">Description</th>
                            <th className="p-2.5 text-right">Billed (Debit)</th>
                            <th className="p-2.5 text-right">Paid/Credited (Credit)</th>
                            <th className="p-2.5 text-right">Running Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {stmt.ledger.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-8 text-center text-slate-400">
                                No transactions found for this customer.
                              </td>
                            </tr>
                          ) : (
                            stmt.ledger.map((row: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="p-2.5 text-slate-500 whitespace-nowrap">{formatDate(row.date)}</td>
                                <td className="p-2.5 font-medium text-slate-800">{row.type}</td>
                                <td className="p-2.5 font-mono font-semibold text-slate-900">{row.reference}</td>
                                <td className="p-2.5 text-slate-600">{row.description}</td>
                                <td className="p-2.5 text-right font-mono">
                                  {row.debit > 0 ? formatCurrency(row.debit) : '-'}
                                </td>
                                <td className="p-2.5 text-right font-mono text-emerald-700 font-semibold">
                                  {row.credit > 0 ? formatCurrency(row.credit) : '-'}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                                  {formatCurrency(row.running_balance)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* ========================================================================= */}
          {/* 9. REVENUE BY CUSTOMER */}
          {/* ========================================================================= */}
          {activeReport === 'REVENUE_BY_CUSTOMER' && reportResult && (
            <div className="space-y-4">
              {'summary' in reportResult && (reportResult as any).summary && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:grid-cols-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[11px] font-medium text-slate-500">Total Net Revenue</div>
                    <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                      {formatCurrency(Number((reportResult as any).summary.totalNetRevenue || 0))}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200">
                    <div className="text-[11px] font-medium text-emerald-700">Cash Collected</div>
                    <div className="text-lg font-bold text-emerald-900 font-mono mt-0.5">
                      {formatCurrency(Number((reportResult as any).summary.totalCollected || 0))}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-sky-50/50 border border-sky-200">
                    <div className="text-[11px] font-medium text-sky-700">Receivables Balance</div>
                    <div className="text-lg font-bold text-sky-900 font-mono mt-0.5">
                      {formatCurrency(Number((reportResult as any).summary.totalOutstanding || 0))}
                    </div>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left min-w-[750px]">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                    <tr>
                      <th className="p-2.5 cursor-pointer" onClick={() => handleSort('customer_name')}>
                        Customer {renderSortIcon('customer_name')}
                      </th>
                      <th className="p-2.5">TRN</th>
                      <th className="p-2.5">Emirate</th>
                      <th className="p-2.5 text-center cursor-pointer" onClick={() => handleSort('invoices_count')}>
                        Invoices {renderSortIcon('invoices_count')}
                      </th>
                      <th className="p-2.5 text-right">Gross Invoiced</th>
                      <th className="p-2.5 text-right">Credit Deductions</th>
                      <th className="p-2.5 text-right cursor-pointer" onClick={() => handleSort('net_revenue')}>
                        Net Revenue {renderSortIcon('net_revenue')}
                      </th>
                      <th className="p-2.5 text-right">Collected</th>
                      <th className="p-2.5 text-right cursor-pointer" onClick={() => handleSort('outstanding_balance')}>
                        Balance Due {renderSortIcon('outstanding_balance')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {'data' in reportResult && (reportResult.data as any[]).length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400">
                          No revenue records found.
                        </td>
                      </tr>
                    ) : (
                      'data' in reportResult &&
                      (reportResult.data as any[]).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2.5 font-medium text-slate-900">{row.customer_name}</td>
                          <td className="p-2.5 font-mono text-slate-500">{row.trn}</td>
                          <td className="p-2.5 text-slate-600">{row.emirate}</td>
                          <td className="p-2.5 text-center font-mono">{row.invoices_count}</td>
                          <td className="p-2.5 text-right font-mono">{formatCurrency(row.gross_invoiced)}</td>
                          <td className="p-2.5 text-right font-mono text-rose-600">
                            {row.credit_deductions > 0 ? `-${formatCurrency(row.credit_deductions)}` : '-'}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatCurrency(row.net_revenue)}</td>
                          <td className="p-2.5 text-right font-mono text-emerald-700">{formatCurrency(row.payments_collected)}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatCurrency(row.outstanding_balance)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 10. REVENUE BY PRODUCT / SERVICE */}
          {/* ========================================================================= */}
          {activeReport === 'REVENUE_BY_PRODUCT' && reportResult && (
            <div className="space-y-4">
              {'summary' in reportResult && (reportResult as any).summary && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:grid-cols-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[11px] font-medium text-slate-500">Taxable Net Sales</div>
                    <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                      {formatCurrency(Number((reportResult as any).summary.totalNet || 0))}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-200">
                    <div className="text-[11px] font-medium text-indigo-700">Output VAT (5%)</div>
                    <div className="text-lg font-bold text-indigo-900 font-mono mt-0.5">
                      {formatCurrency(Number((reportResult as any).summary.totalVat || 0))}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200">
                    <div className="text-[11px] font-medium text-emerald-700">Total Gross Value</div>
                    <div className="text-lg font-bold text-emerald-950 font-mono mt-0.5">
                      {formatCurrency(Number((reportResult as any).summary.totalGross || 0))}
                    </div>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left min-w-[700px]">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                    <tr>
                      <th className="p-2.5 cursor-pointer" onClick={() => handleSort('product_name')}>
                        Product / Service {renderSortIcon('product_name')}
                      </th>
                      <th className="p-2.5 text-center cursor-pointer" onClick={() => handleSort('quantity_sold')}>
                        Units Sold {renderSortIcon('quantity_sold')}
                      </th>
                      <th className="p-2.5 text-center">Unit</th>
                      <th className="p-2.5 text-right cursor-pointer" onClick={() => handleSort('net_revenue')}>
                        Net Sales Revenue {renderSortIcon('net_revenue')}
                      </th>
                      <th className="p-2.5 text-right">VAT (5%)</th>
                      <th className="p-2.5 text-right cursor-pointer" onClick={() => handleSort('total_gross')}>
                        Total Gross {renderSortIcon('total_gross')}
                      </th>
                      <th className="p-2.5 text-center cursor-pointer" onClick={() => handleSort('percentage_of_sales')}>
                        % of Sales {renderSortIcon('percentage_of_sales')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {'data' in reportResult && (reportResult.data as any[]).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          No product or service billing data found.
                        </td>
                      </tr>
                    ) : (
                      'data' in reportResult &&
                      (reportResult.data as any[]).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2.5 font-medium text-slate-900">{row.product_name}</td>
                          <td className="p-2.5 text-center font-mono font-semibold">{row.quantity_sold}</td>
                          <td className="p-2.5 text-center text-slate-500">{row.unit}</td>
                          <td className="p-2.5 text-right font-mono">{formatCurrency(row.net_revenue)}</td>
                          <td className="p-2.5 text-right font-mono text-indigo-700">{formatCurrency(row.vat_amount)}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatCurrency(row.total_gross)}</td>
                          <td className="p-2.5 text-center">
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-100 text-slate-800">
                              {row.percentage_of_sales}%
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 11. RECEIVABLES AGEING SCHEDULE */}
          {/* ========================================================================= */}
          {activeReport === 'AGEING' && reportResult && 'summary' in reportResult && (
            <div className="space-y-4">
              {(() => {
                const aging = reportResult as any;
                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[10px] font-semibold text-slate-500 uppercase">0 - 30 Days (Current)</div>
                        <div className="text-base font-bold font-mono text-slate-900 mt-1">
                          {formatCurrency(aging.summary.buckets.current)}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200">
                        <div className="text-[10px] font-semibold text-amber-700 uppercase">31 - 60 Days</div>
                        <div className="text-base font-bold font-mono text-amber-800 mt-1">
                          {formatCurrency(aging.summary.buckets.days31_60)}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-orange-50/50 border border-orange-200">
                        <div className="text-[10px] font-semibold text-orange-700 uppercase">61 - 90 Days</div>
                        <div className="text-base font-bold font-mono text-orange-800 mt-1">
                          {formatCurrency(aging.summary.buckets.days61_90)}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-200">
                        <div className="text-[10px] font-semibold text-rose-700 uppercase">90+ Days (High Risk)</div>
                        <div className="text-base font-bold font-mono text-rose-700 mt-1">
                          {formatCurrency(aging.summary.buckets.days90_plus)}
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto pt-2">
                      <table className="w-full text-xs text-left min-w-[950px]">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                          <tr>
                            <th className="p-2.5 cursor-pointer" onClick={() => handleSort('customer_name')}>
                              Customer {renderSortIcon('customer_name')}
                            </th>
                            <th className="p-2.5 cursor-pointer" onClick={() => handleSort('invoice_number')}>
                              Invoice # {renderSortIcon('invoice_number')}
                            </th>
                            <th className="p-2.5">Due Date</th>
                            <th className="p-2.5 text-center cursor-pointer" onClick={() => handleSort('days_overdue')}>
                              Days Overdue {renderSortIcon('days_overdue')}
                            </th>
                            <th className="p-2.5 text-right">0-30 Days</th>
                            <th className="p-2.5 text-right">31-60 Days</th>
                            <th className="p-2.5 text-right">61-90 Days</th>
                            <th className="p-2.5 text-right">90+ Days</th>
                            <th className="p-2.5 text-right cursor-pointer" onClick={() => handleSort('total_due')}>
                              Total Due {renderSortIcon('total_due')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {aging.records.data.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="p-8 text-center text-slate-400">
                                No unpaid invoices found.
                              </td>
                            </tr>
                          ) : (
                            aging.records.data.map((row: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="p-2.5 font-medium text-slate-900">{row.customer_name}</td>
                                <td className="p-2.5 font-mono font-semibold">{row.invoice_number}</td>
                                <td className="p-2.5 text-slate-500 whitespace-nowrap">{formatDate(row.due_date)}</td>
                                <td className="p-2.5 text-center font-mono">{row.days_overdue} d</td>
                                <td className="p-2.5 text-right font-mono text-slate-700">
                                  {row.current > 0 ? formatCurrency(row.current) : '-'}
                                </td>
                                <td className="p-2.5 text-right font-mono text-amber-700">
                                  {row.days31_60 > 0 ? formatCurrency(row.days31_60) : '-'}
                                </td>
                                <td className="p-2.5 text-right font-mono text-orange-700">
                                  {row.days61_90 > 0 ? formatCurrency(row.days61_90) : '-'}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold text-rose-600">
                                  {row.days90_plus > 0 ? formatCurrency(row.days90_plus) : '-'}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                                  {formatCurrency(row.total_due)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* ========================================================================= */}
          {/* Pagination Controls Footer */}
          {/* ========================================================================= */}
          {reportResult &&
            (('total' in reportResult && reportResult.total > 0) ||
              ('records' in reportResult && (reportResult as any).records.total > 0) ||
              ('transactions' in reportResult && (reportResult as any).transactions.total > 0)) && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 text-xs text-slate-500 print:hidden">
                {(() => {
                  const paginationData =
                    'total' in reportResult
                      ? (reportResult as any)
                      : 'records' in reportResult
                      ? (reportResult as any).records
                      : (reportResult as any).transactions;

                  const total = paginationData.total;
                  const curPage = paginationData.page;
                  const totalPages = paginationData.totalPages;
                  const pSize = paginationData.pageSize;
                  const start = (curPage - 1) * pSize + 1;
                  const end = Math.min(start + pSize - 1, total);

                  return (
                    <>
                      <div className="flex items-center gap-3">
                        <span>
                          Showing <strong className="text-slate-800">{start}</strong> to{' '}
                          <strong className="text-slate-800">{end}</strong> of{' '}
                          <strong className="text-slate-800">{total}</strong> records
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span>Rows:</span>
                          <select
                            value={pageSize}
                            onChange={(e) => {
                              setPageSize(Number(e.target.value));
                              setPage(1);
                            }}
                            className="px-2 py-0.5 text-xs rounded border border-slate-300 bg-white"
                          >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={curPage <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className="px-2 py-1 text-xs"
                        >
                          <ChevronLeft className="h-3.5 w-3.5 mr-0.5" /> Previous
                        </Button>
                        <span className="px-2 font-medium text-slate-700">
                          Page {curPage} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={curPage >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          className="px-2 py-1 text-xs"
                        >
                          Next <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
