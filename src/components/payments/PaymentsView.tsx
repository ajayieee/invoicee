'use client';

import React, { useState } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  FileCheck,
  ExternalLink,
  Eye,
  FileText,
  User,
  Filter,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Input';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Payment } from '@/types/database';
import { paymentService, PaymentQuery } from '@/services/payment.service';
import { customerService } from '@/services/customer.service';
import { formatCurrency, formatDate } from '@/lib/utils';
import { RecordPaymentModal } from './RecordPaymentModal';

interface PaymentsViewProps {
  onViewInvoice?: (invoiceId: string) => void;
}

export function PaymentsView({ onViewInvoice }: PaymentsViewProps) {
  const paymentMethods = paymentService.getPaymentMethods();
  const customers = customerService.getCustomers({ pageSize: 100 }).items;

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'RECORDED' | 'REVERSED'>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Modal State
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [reversalTarget, setReversalTarget] = useState<Payment | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversalError, setReversalError] = useState('');
  const [successBanner, setSuccessBanner] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const query: PaymentQuery = {
    search: search.trim() || undefined,
    status: statusFilter,
    paymentMethodId: methodFilter,
    customerId: customerFilter,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    pageSize,
  };

  const paginatedResult = paymentService.getPayments(query);
  const payments = paginatedResult.items;

  const refreshList = () => {
    // triggers re-render via query state
    setPage((p) => p);
  };

  const handleExecuteReversal = () => {
    if (!reversalTarget) return;
    if (!reversalReason.trim()) {
      setReversalError('A justification reason is required to reverse a financial payment.');
      return;
    }

    const res = paymentService.reversePayment(reversalTarget.id, reversalReason.trim());
    if (res.success) {
      setSuccessBanner(
        `Payment ${reversalTarget.payment_number} successfully reversed. Invoice ${
          reversalTarget.invoice_number || ''
        } outstanding balance has been safely reopened.`
      );
      setReversalTarget(null);
      setReversalReason('');
      setReversalError('');
      refreshList();
      setTimeout(() => setSuccessBanner(''), 6000);
    } else {
      setReversalError(res.error || 'Failed to reverse payment');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Payments Ledger</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-safe tracking of cash, wire transfers, cards, and cheques received against issued tax invoices.
          </p>
        </div>
        <Button
          variant="emerald"
          onClick={() => setRecordModalOpen(true)}
          className="flex items-center gap-1.5 shadow-sm font-semibold"
        >
          <Plus className="h-4 w-4" />
          <span>Record Payment</span>
        </Button>
      </div>

      {successBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner('')}
            className="font-semibold text-emerald-900 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Tabs & Advanced Search Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-100 pb-3 flex-wrap">
          {[
            { id: 'ALL', label: 'All Receipts' },
            { id: 'RECORDED', label: 'Active (Recorded)' },
            { id: 'REVERSED', label: 'Reversed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id as any);
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-center">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search receipt #, invoice #, client, ref..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          {/* Payment Method Filter */}
          <div>
            <select
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              <option value="ALL">All Payment Methods</option>
              {paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
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

          {/* Reset Filters */}
          <div className="flex items-center justify-end">
            {(search || methodFilter !== 'ALL' || customerFilter !== 'ALL' || startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setMethodFilter('ALL');
                  setCustomerFilter('ALL');
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

      {/* Payments Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[900px]">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
                <tr>
                  <th className="px-4 py-3">Receipt #</th>
                  <th className="px-4 py-3">Payment Date</th>
                  <th className="px-4 py-3">Applied Invoice #</th>
                  <th className="px-4 py-3">Customer / Payer</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Bank Ref / Cheque #</th>
                  <th className="px-4 py-3 text-center">Proof</th>
                  <th className="px-4 py-3 text-right">Amount Paid</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {payments.map((p) => {
                  const isReversed = p.status === 'REVERSED';

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {p.payment_number}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {formatDate(p.payment_date)}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {p.invoice_number ? (
                          <button
                            type="button"
                            onClick={() => onViewInvoice && onViewInvoice(p.invoice_id)}
                            className="text-emerald-700 hover:text-emerald-800 font-semibold hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <span>{p.invoice_number}</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        ) : (
                          <span className="text-slate-400 italic">Unlinked</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {p.customer_name || 'Client Account'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.payment_method_name || 'Payment'}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">
                        {p.reference_number || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.payment_proof_url ? (
                          <a
                            href={p.payment_proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-700 hover:underline font-semibold"
                            title={p.payment_proof_name || 'View Proof Document'}
                          >
                            <FileCheck className="h-3.5 w-3.5" />
                            <span>Proof</span>
                          </a>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        <span className={isReversed ? 'text-slate-400 line-through' : 'text-emerald-700'}>
                          {formatCurrency(p.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={isReversed ? 'secondary' : 'success'}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedPayment(p)}
                            className="h-7 text-xs px-2"
                          >
                            <Eye className="h-3 w-3 mr-1" /> View
                          </Button>
                          {!isReversed && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setReversalError('');
                                setReversalReason('');
                                setReversalTarget(p);
                              }}
                              className="h-7 text-xs px-2 text-rose-600 border-rose-200 hover:bg-rose-50"
                              title="Reverse Payment (Reopen Balance)"
                            >
                              <RotateCcw className="h-3 w-3 mr-1" /> Reverse
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {payments.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8">
                      <EmptyState
                        icon={CreditCard}
                        title="No Payment Records Found"
                        description="No payments match the active status, date, or search filters. Record a payment to settle invoices."
                        action={{
                          label: 'Record Payment',
                          onClick: () => setRecordModalOpen(true),
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

      {/* Record Payment Modal */}
      <RecordPaymentModal
        open={recordModalOpen}
        onOpenChange={setRecordModalOpen}
        onSuccess={() => {
          refreshList();
        }}
      />

      {/* View Payment Details Modal */}
      {selectedPayment && (
        <Dialog
          open={!!selectedPayment}
          onOpenChange={(open) => !open && setSelectedPayment(null)}
          title={`Payment Receipt: ${selectedPayment.payment_number}`}
          description={`Payment recorded on ${formatDate(selectedPayment.payment_date)}`}
          maxWidth="md"
          footer={
            <Button variant="secondary" onClick={() => setSelectedPayment(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4 text-xs">
            {selectedPayment.status === 'REVERSED' && (
              <div className="p-3 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 space-y-1">
                <div className="font-bold text-rose-700 flex items-center gap-1.5">
                  <RotateCcw className="h-4 w-4" />
                  <span>PAYMENT REVERSED (Audit Retained)</span>
                </div>
                <p className="text-slate-600">
                  Reason: <strong>{selectedPayment.reversal_reason || 'Reversed by finance administrator'}</strong>
                </p>
                <p className="text-[11px] text-slate-500">
                  Reversed on: {formatDate(selectedPayment.reversed_at)} • Invoice outstanding balance was reopened.
                </p>
              </div>
            )}

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 font-mono">
              <div className="flex justify-between font-sans">
                <span className="text-slate-500">Applied Tax Invoice:</span>
                <span className="font-bold text-slate-900">{selectedPayment.invoice_number || '-'}</span>
              </div>
              <div className="flex justify-between font-sans">
                <span className="text-slate-500">Customer Account:</span>
                <span className="font-medium text-slate-800">{selectedPayment.customer_name}</span>
              </div>
              <div className="flex justify-between font-sans">
                <span className="text-slate-500">Payment Channel:</span>
                <span className="font-medium text-slate-800">{selectedPayment.payment_method_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-500">Reference / Cheque #:</span>
                <span className="text-slate-800">{selectedPayment.reference_number || '-'}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 font-bold text-sm">
                <span className="font-sans text-slate-900">Total Settled Amount:</span>
                <span className="text-emerald-700">{formatCurrency(selectedPayment.amount)}</span>
              </div>
            </div>

            {selectedPayment.notes && (
              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                <div className="font-semibold text-slate-700">Internal Remarks:</div>
                <p className="text-slate-600 italic">{selectedPayment.notes}</p>
              </div>
            )}

            {selectedPayment.payment_proof_url && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-900 font-medium">
                  <FileCheck className="h-4 w-4 text-emerald-600" />
                  <span>{selectedPayment.payment_proof_name || 'Bank Settlement Advice'}</span>
                </div>
                <a
                  href={selectedPayment.payment_proof_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-700 font-bold hover:underline"
                >
                  View Attachment
                </a>
              </div>
            )}
          </div>
        </Dialog>
      )}

      {/* Payment Reversal Confirmation Dialog */}
      <Dialog
        open={!!reversalTarget}
        onOpenChange={(open) => !open && setReversalTarget(null)}
        title={`Reverse Payment: ${reversalTarget?.payment_number}`}
        description="Reversing a payment reopens the invoice balance due. In accordance with accounting principles, payment records are never deleted."
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setReversalTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleExecuteReversal}>
              Confirm Reversal
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {reversalError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
              {reversalError}
            </div>
          )}

          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>Financial Audit Warning</span>
            </div>
            <p className="text-[11px] text-amber-800">
              Reversing receipt <strong>{reversalTarget?.payment_number}</strong> (
              {formatCurrency(reversalTarget?.amount || 0)}) will increment invoice{' '}
              <strong>{reversalTarget?.invoice_number}</strong> balance due by{' '}
              {formatCurrency(reversalTarget?.amount || 0)} and adjust receivables reporting.
            </p>
          </div>

          <Textarea
            label="Mandatory Reason for Payment Reversal *"
            rows={3}
            value={reversalReason}
            onChange={(e) => setReversalReason(e.target.value)}
            placeholder="e.g. Bounced cheque, erroneous duplicate transfer, banking clawback, or customer refund..."
          />
        </div>
      </Dialog>
    </div>
  );
}
