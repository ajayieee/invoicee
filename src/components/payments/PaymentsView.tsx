'use client';

import React, { useState } from 'react';
import { CreditCard, Plus, Search, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/Badge';
import { Payment } from '@/types/database';
import { db } from '@/lib/db/repository';
import { formatCurrency, formatDate } from '@/lib/utils';
import { RecordPaymentModal } from './RecordPaymentModal';

interface PaymentsViewProps {
  onViewInvoice?: (invoiceId: string) => void;
}

export function PaymentsView({ onViewInvoice }: PaymentsViewProps) {
  const [payments, setPayments] = useState<Payment[]>(db.getPayments());
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'RECORDED' | 'REVERSED'>('ALL');
  const [search, setSearch] = useState('');
  const [recordModalOpen, setRecordModalOpen] = useState(false);

  // Reversal State
  const [reversalTarget, setReversalTarget] = useState<Payment | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversalError, setReversalError] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  const refreshList = () => {
    setPayments(db.getPayments());
  };

  const handleExecuteReversal = () => {
    if (!reversalTarget) return;
    if (!reversalReason.trim()) {
      setReversalError('A justification reason is required to reverse a financial payment.');
      return;
    }

    try {
      db.reversePayment(reversalTarget.id, reversalReason.trim());
      setSuccessBanner(
        `Payment ${reversalTarget.payment_number} reversed. Invoice ${reversalTarget.invoice_number} balance has been reopened.`
      );
      setReversalTarget(null);
      setReversalReason('');
      refreshList();
      setTimeout(() => setSuccessBanner(''), 6000);
    } catch (e: any) {
      setReversalError(e.message || 'Failed to reverse payment');
    }
  };

  const filtered = payments.filter((p) => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNum = p.payment_number.toLowerCase().includes(q);
      const matchInv = p.invoice_number?.toLowerCase().includes(q);
      const matchCust = p.customer_name?.toLowerCase().includes(q);
      const matchRef = p.reference_number?.toLowerCase().includes(q);
      if (!matchNum && !matchInv && !matchCust && !matchRef) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Payments Ledger</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-safe tracking of cash, wire transfers, and cheques received against issued tax invoices.
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
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between animate-in fade-in">
          <span>{successBanner}</span>
          <button onClick={() => setSuccessBanner('')} className="font-semibold text-emerald-900">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1 w-full sm:w-auto">
          {(['ALL', 'RECORDED', 'REVERSED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {st === 'ALL' ? 'All Payments' : st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search receipt #, invoice, reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>
      </div>

      {/* Payments Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
                <tr>
                  <th className="px-4 py-3">Receipt #</th>
                  <th className="px-4 py-3">Payment Date</th>
                  <th className="px-4 py-3">Invoice Applied To</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Payment Method</th>
                  <th className="px-4 py-3">Reference / Cheque</th>
                  <th className="px-4 py-3 text-right">Amount (AED)</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      {p.payment_number}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {formatDate(p.payment_date)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onViewInvoice && onViewInvoice(p.invoice_id)}
                        className="font-mono font-semibold text-emerald-700 hover:underline cursor-pointer"
                      >
                        {p.invoice_number}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {p.customer_name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.payment_method_name}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {p.reference_number || '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700 text-sm">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.status === 'RECORDED' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setReversalTarget(p);
                            setReversalReason('');
                            setReversalError('');
                          }}
                          className="h-7 text-xs px-2 text-rose-600 hover:bg-rose-50"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" /> Reverse
                        </Button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Reversed</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                      No payments found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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

      {/* Payment Reversal Modal */}
      {reversalTarget && (
        <Dialog
          open={!!reversalTarget}
          onOpenChange={(open) => !open && setReversalTarget(null)}
          title={`Reverse Payment: ${reversalTarget.payment_number}`}
          description="Accounting Principle: Payments cannot be silently deleted. Reversal creates an audit-logged offset and reopens the invoice balance."
          maxWidth="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setReversalTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleExecuteReversal}>
                Confirm Reversal
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                <span>Reversal Warning</span>
              </div>
              <p>
                Amount of <strong>{formatCurrency(reversalTarget.amount)}</strong> will be credited back as outstanding onto Invoice{' '}
                <strong>{reversalTarget.invoice_number}</strong>.
              </p>
            </div>

            {reversalError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {reversalError}
              </div>
            )}

            <Textarea
              label="Mandatory Reason for Reversal *"
              placeholder="e.g. Bank wire dishonored; Cheque bounced or disputed transaction..."
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              rows={3}
            />
          </div>
        </Dialog>
      )}
    </div>
  );
}
