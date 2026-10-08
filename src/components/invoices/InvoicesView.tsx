'use client';

import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Search,
  DollarSign,
  RotateCcw,
  Printer,
  Eye,
  AlertCircle,
  FileCheck,
  Filter,
  Calendar,
  User,
  Copy,
  Edit,
  Send,
  Ban,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Select, Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Invoice, InvoiceStatus } from '@/types/database';
import { invoiceService, InvoiceQuery } from '@/services/invoice.service';
import { customerService } from '@/services/customer.service';
import { formatCurrency, formatDate } from '@/lib/utils';
import { InvoiceBuilderModal } from './InvoiceBuilderModal';
import { InvoiceDetailModal } from './InvoiceDetailModal';

interface InvoicesViewProps {
  onRecordPayment: (invoice: Invoice) => void;
  onCreateCreditNote: (invoice: Invoice) => void;
  onPrintInvoice: (invoiceId: string) => void;
}

export function InvoicesView({
  onRecordPayment,
  onCreateCreditNote,
  onPrintInvoice,
}: InvoicesViewProps) {
  const customers = customerService.getCustomers({ pageSize: 100 }).items;

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Modals state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | undefined>(undefined);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // State version nonce to trigger re-renders on cloud sync
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    invoiceService.syncInvoices().then(() => setNonce((n) => n + 1));
    customerService.syncCustomers().then(() => setNonce((n) => n + 1));

    const handleStoreUpdate = () => setNonce((n) => n + 1);
    window.addEventListener('database-store-updated', handleStoreUpdate);
    return () => window.removeEventListener('database-store-updated', handleStoreUpdate);
  }, []);

  // Fetch invoices with query
  const query: InvoiceQuery = {
    search: search.trim() || undefined,
    status: statusFilter as any,
    customerId: customerFilter,
    paymentStatus: paymentFilter as any,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    pageSize,
  };

  const paginatedResult = invoiceService.getInvoices(query);
  const invoices = paginatedResult.items;

  // Refresh handler
  const refreshList = async () => {
    await invoiceService.syncInvoices();
    setNonce((n) => n + 1);
    if (selectedInvoice) {
      const refreshed = invoiceService.getInvoiceById(selectedInvoice.id);
      setSelectedInvoice(refreshed || null);
    }
  };

  const handleOpenNewInvoice = () => {
    setEditingInvoiceId(undefined);
    setBuilderOpen(true);
  };

  const handleEditDraft = (inv: Invoice) => {
    setSelectedInvoice(null);
    setEditingInvoiceId(inv.id);
    setBuilderOpen(true);
  };

  const handleIssueDirect = async (invId: string) => {
    await invoiceService.issueInvoice(invId);
    await refreshList();
  };

  const handleDuplicateDirect = async (invId: string) => {
    const res = await invoiceService.duplicateInvoice(invId);
    if (res.success && res.data) {
      setEditingInvoiceId(res.data.id);
      setBuilderOpen(true);
    }
    await refreshList();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Tax Invoices Register</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Sequential UAE FTA 5% VAT invoices, receivables tracking, and audit-compliant cancellation logs.
          </p>
        </div>
        <Button
          variant="emerald"
          onClick={handleOpenNewInvoice}
          className="flex items-center gap-1.5 shadow-sm font-semibold"
        >
          <Plus className="h-4 w-4" />
          <span>New Tax Invoice</span>
        </Button>
      </div>

      {/* Filter Tabs & Advanced Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 flex-wrap border-b border-slate-100 pb-3">
          {[
            { id: 'ALL', label: 'All Invoices' },
            { id: 'ISSUED', label: 'Issued' },
            { id: 'PARTIALLY_PAID', label: 'Partially Paid' },
            { id: 'PAID', label: 'Fully Paid' },
            { id: 'OVERDUE', label: 'Overdue' },
            { id: 'DRAFT', label: 'Drafts' },
            { id: 'CANCELLED', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Multi-Criteria Search & Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-center">
          {/* Keyword Search */}
          <div className="relative md:col-span-2">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice #, client, TRN, or PO ref..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          {/* Customer Filter */}
          <div>
            <select
              value={customerFilter}
              onChange={(e) => {
                setCustomerFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              <option value="ALL">All Clients</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Status Filter */}
          <div>
            <select
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              <option value="ALL">All Payment States</option>
              <option value="UNPAID">Unpaid (Zero Paid)</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Fully Paid</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-center justify-end gap-2">
            {(search || customerFilter !== 'ALL' || paymentFilter !== 'ALL' || startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCustomerFilter('ALL');
                  setPaymentFilter('ALL');
                  setStartDate('');
                  setEndDate('');
                  setPage(1);
                }}
                className="text-xs text-rose-600 hover:underline cursor-pointer font-medium"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Date Range Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 pt-2 border-t border-slate-100">
          <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1 shrink-0">
            <Calendar className="h-3.5 w-3.5" /> Date Range:
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 flex-1 sm:flex-none"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 flex-1 sm:flex-none"
            />
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[1000px]">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
                <tr>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Customer / Billed To</th>
                  <th className="px-4 py-3">Invoice Date</th>
                  <th className="px-4 py-3">Supply Date</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3 text-right">Net Subtotal</th>
                  <th className="px-4 py-3 text-right">VAT (5%)</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3 text-right">Balance Due</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {invoices.map((inv) => {
                  const isOverdue =
                    inv.balance_due > 0 &&
                    new Date(inv.due_date) < new Date() &&
                    inv.status !== 'CANCELLED' &&
                    inv.status !== 'DRAFT';

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {inv.invoice_number}
                        {inv.reference_number && (
                          <div className="text-[10px] text-slate-400 font-sans font-normal">
                            Ref: {inv.reference_number}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        <div>
                          {inv.customer_snapshot?.company_name ||
                            inv.customer_snapshot?.contact_person ||
                            (inv as any).customerSnapshot?.companyName ||
                            (inv as any).customerSnapshot?.contactPerson ||
                            'Customer'}
                        </div>
                        {(inv.customer_snapshot?.trn || (inv as any).customerSnapshot?.trn) && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            TRN: {inv.customer_snapshot?.trn || (inv as any).customerSnapshot?.trn}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {formatDate(inv.invoice_date)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {formatDate(inv.supply_date)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={
                            isOverdue
                              ? 'text-rose-600 font-semibold flex items-center gap-1'
                              : 'text-slate-500'
                          }
                        >
                          {isOverdue && <AlertCircle className="h-3 w-3" />}
                          {formatDate(inv.due_date)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">
                        {formatCurrency(inv.subtotal_net)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">
                        {formatCurrency(inv.vat_total)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(inv.grand_total)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        <span className={inv.balance_due > 0 ? 'text-rose-600' : 'text-slate-400'}>
                          {formatCurrency(inv.balance_due)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedInvoice(inv)}
                            className="h-7 text-xs px-2"
                          >
                            <Eye className="h-3 w-3 mr-1" /> View
                          </Button>

                          {inv.status === 'DRAFT' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditDraft(inv)}
                              className="h-7 text-xs px-2 text-slate-700"
                              title="Edit Draft"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          )}

                          {inv.status === 'DRAFT' && (
                            <Button
                              variant="emerald"
                              size="sm"
                              onClick={() => handleIssueDirect(inv.id)}
                              className="h-7 text-xs px-2"
                              title="Issue Official Invoice"
                            >
                              <Send className="h-3 w-3" />
                            </Button>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPrintInvoice(inv.id)}
                            className="h-7 text-xs px-2 text-slate-600"
                            title="Print UAE Tax Invoice PDF"
                          >
                            <Printer className="h-3 w-3" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicateDirect(inv.id)}
                            className="h-7 text-xs px-2 text-slate-500"
                            title="Duplicate Invoice"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>

                          {inv.status !== 'CANCELLED' && inv.status !== 'DRAFT' && inv.balance_due > 0 && (
                            <Button
                              variant="emerald"
                              size="sm"
                              onClick={() => onRecordPayment(inv)}
                              className="h-7 text-xs px-2"
                            >
                              <DollarSign className="h-3 w-3" /> Pay
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-8">
                      <EmptyState
                        icon={Receipt}
                        title="No Tax Invoices Found"
                        description="No invoices match the specified status, date, or search filters. Create a new tax invoice to begin tracking receivables."
                        action={{
                          label: 'Create Tax Invoice',
                          onClick: handleOpenNewInvoice,
                        }}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {paginatedResult.totalPages > 1 && (
            <div className="p-3 border-t border-slate-100">
              <Pagination
                currentPage={paginatedResult.currentPage}
                totalPages={paginatedResult.totalPages}
                totalItems={paginatedResult.totalItems}
                pageSize={paginatedResult.pageSize}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Builder Modal (Create New or Edit Draft) */}
      <InvoiceBuilderModal
        open={builderOpen}
        onOpenChange={(isOpen) => {
          setBuilderOpen(isOpen);
          if (!isOpen) setEditingInvoiceId(undefined);
        }}
        initialInvoiceId={editingInvoiceId}
        onSuccess={() => {
          refreshList();
        }}
      />

      {/* Invoice Detail Modal */}
      <InvoiceDetailModal
        invoice={selectedInvoice}
        open={!!selectedInvoice}
        onOpenChange={(open) => !open && setSelectedInvoice(null)}
        onRecordPayment={(inv) => {
          setSelectedInvoice(null);
          onRecordPayment(inv);
        }}
        onCreateCreditNote={(inv) => {
          setSelectedInvoice(null);
          onCreateCreditNote(inv);
        }}
        onEditDraft={(inv) => {
          handleEditDraft(inv);
        }}
        onPrint={onPrintInvoice}
        onRefresh={refreshList}
      />
    </div>
  );
}
