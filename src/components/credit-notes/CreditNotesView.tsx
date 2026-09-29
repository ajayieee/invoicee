'use client';

import React, { useState } from 'react';
import {
  RotateCcw,
  Plus,
  Search,
  Eye,
  Printer,
  ShieldCheck,
  Coins,
  ArrowRight,
  TrendingDown,
  Receipt,
  FileText,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { CreditNote } from '@/types/database';
import { creditNoteService } from '@/services/credit-note.service';
import { db } from '@/lib/db/repository';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CreateCreditNoteModal } from './CreateCreditNoteModal';
import { CreditNoteDetailModal } from './CreditNoteDetailModal';

interface CreditNotesViewProps {
  onViewInvoice?: (invoiceId: string) => void;
  onPrintDocument?: (docType: 'QUOTE' | 'INVOICE' | 'CREDIT_NOTE' | 'STATEMENT', docId: string) => void;
}

export function CreditNotesView({ onViewInvoice, onPrintDocument }: CreditNotesViewProps) {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(creditNoteService.getCreditNotes());
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDetailCnId, setSelectedDetailCnId] = useState<string | null>(null);

  const refreshList = () => {
    setCreditNotes(creditNoteService.getCreditNotes());
  };

  const metrics = creditNoteService.getSummaryMetrics();

  const filtered = creditNotes.filter((cn) => {
    if (statusFilter !== 'ALL' && cn.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNum = cn.credit_note_number.toLowerCase().includes(q);
      const matchInv = cn.invoice_number?.toLowerCase().includes(q);
      const matchCust = cn.customer_name?.toLowerCase().includes(q);
      const matchReason = cn.reason.toLowerCase().includes(q);
      if (!matchNum && !matchInv && !matchCust && !matchReason) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            UAE Tax Credit Notes / إشعارات دائنة ضريبية
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Full and partial credit notes issued against UAE VAT invoices with line precision, balance offsets, and audit records.
          </p>
        </div>
        <Button
          variant="emerald"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 shadow-sm font-semibold"
        >
          <Plus className="h-4 w-4" />
          <span>Issue Credit Note</span>
        </Button>
      </div>

      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Total Credit Notes</span>
            <Receipt className="h-4 w-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">{metrics.totalCount}</div>
          <div className="text-[10px] text-slate-400">{metrics.activeCount} active in ledger</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Total Net Credit</span>
            <TrendingDown className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">{formatCurrency(metrics.totalNetCredited)}</div>
          <div className="text-[10px] text-slate-400">Taxable revenue adjustments</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Output VAT Adjusted (5%)</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">{formatCurrency(metrics.totalVatAdjusted)}</div>
          <div className="text-[10px] text-slate-400">FTA Box 1 tax reductions</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 text-white shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Total Gross Credited</span>
            <Coins className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-400">{formatCurrency(metrics.totalCreditedAmount)}</div>
          <div className="text-[10px] text-slate-400">AED total customer credits</div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1 flex-wrap w-full sm:w-auto">
          {['ALL', 'ISSUED', 'APPLIED', 'REFUNDED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {st === 'ALL' ? 'All Credit Notes' : st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search CN #, invoice, customer, reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>
      </div>

      {/* Table Displaying all requested fields */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="px-3.5 py-3">Credit Note #</th>
                  <th className="px-3.5 py-3">Date</th>
                  <th className="px-3.5 py-3">Original Invoice</th>
                  <th className="px-3.5 py-3">Customer</th>
                  <th className="px-3.5 py-3">Reason</th>
                  <th className="px-3.5 py-3 text-right">Original Amount</th>
                  <th className="px-3.5 py-3 text-right">Net Credit</th>
                  <th className="px-3.5 py-3 text-right">VAT Adjustment</th>
                  <th className="px-3.5 py-3 text-right">Credit Amount</th>
                  <th className="px-3.5 py-3 text-center">Refund Status</th>
                  <th className="px-3.5 py-3 text-center">Status</th>
                  <th className="px-3.5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((cn) => (
                  <tr key={cn.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Credit Note Number */}
                    <td className="px-3.5 py-3 font-mono font-bold text-amber-900 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedDetailCnId(cn.id)}
                        className="hover:underline text-left cursor-pointer"
                        title="View details & audit trail"
                      >
                        {cn.credit_note_number}
                      </button>
                    </td>

                    {/* Credit Note Date */}
                    <td className="px-3.5 py-3 text-slate-500 whitespace-nowrap">
                      {formatDate(cn.credit_note_date)}
                    </td>

                    {/* Original Invoice (Link) */}
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <button
                        onClick={() => onViewInvoice && onViewInvoice(cn.invoice_id)}
                        className="font-mono font-semibold text-emerald-700 hover:underline cursor-pointer flex items-center gap-1"
                        title="Navigate to original tax invoice"
                      >
                        <span>{cn.invoice_number}</span>
                        <ArrowRight className="h-3 w-3 text-emerald-500" />
                      </button>
                    </td>

                    {/* Customer */}
                    <td className="px-3.5 py-3 font-medium text-slate-800 max-w-[150px] truncate" title={cn.customer_name}>
                      {cn.customer_name}
                    </td>

                    {/* Reason */}
                    <td className="px-3.5 py-3 text-slate-600 max-w-[180px] truncate" title={cn.reason}>
                      {cn.reason}
                    </td>

                    {/* Original Amount */}
                    <td className="px-3.5 py-3 text-right font-mono text-slate-500 whitespace-nowrap">
                      {formatCurrency(cn.original_invoice_total || 0)}
                    </td>

                    {/* Net Credit */}
                    <td className="px-3.5 py-3 text-right font-mono text-slate-700 whitespace-nowrap">
                      {formatCurrency(cn.subtotal_net)}
                    </td>

                    {/* VAT Adjustment */}
                    <td className="px-3.5 py-3 text-right font-mono text-slate-700 whitespace-nowrap">
                      {formatCurrency(cn.vat_total)}
                    </td>

                    {/* Credit Amount (Grand Total) */}
                    <td className="px-3.5 py-3 text-right font-mono font-bold text-amber-900 whitespace-nowrap">
                      {formatCurrency(cn.grand_total)}
                    </td>

                    {/* Refund Status */}
                    <td className="px-3.5 py-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          cn.refund_status === 'APPLIED_TO_INVOICE'
                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                            : cn.refund_status === 'REFUNDED_CASH' || cn.refund_status === 'REFUNDED_BANK'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {cn.refund_status.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-3.5 py-3 text-center whitespace-nowrap">
                      <StatusBadge status={cn.status} />
                    </td>

                    {/* Actions */}
                    <td className="px-3.5 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedDetailCnId(cn.id)}
                          className="h-7 text-xs px-2 text-slate-600"
                          title="View Details & Audit Trail"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onPrintDocument && onPrintDocument('CREDIT_NOTE', cn.id)}
                          className="h-7 text-xs px-2 text-slate-700 font-semibold"
                          title="View Official Printable Credit Note"
                        >
                          <Printer className="h-3.5 w-3.5 mr-1" /> PDF
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center text-slate-400">
                      No UAE credit notes found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Creation Modal */}
      <CreateCreditNoteModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={() => {
          refreshList();
        }}
      />

      {/* Detail / Audit Modal */}
      <CreditNoteDetailModal
        open={!!selectedDetailCnId}
        onOpenChange={(op) => !op && setSelectedDetailCnId(null)}
        creditNoteId={selectedDetailCnId}
        onViewInvoice={onViewInvoice}
        onPrintCreditNote={(cnId) => onPrintDocument && onPrintDocument('CREDIT_NOTE', cnId)}
        onRefresh={refreshList}
      />
    </div>
  );
}
