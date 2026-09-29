'use client';

import React, { useState } from 'react';
import { RotateCcw, Plus, Search, Eye, Printer, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { CreditNote } from '@/types/database';
import { db } from '@/lib/db/repository';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CreateCreditNoteModal } from './CreateCreditNoteModal';

interface CreditNotesViewProps {
  onViewInvoice?: (invoiceId: string) => void;
  onPrintDocument?: (docType: 'QUOTE' | 'INVOICE' | 'CREDIT_NOTE' | 'STATEMENT', docId: string) => void;
}

export function CreditNotesView({ onViewInvoice, onPrintDocument }: CreditNotesViewProps) {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(db.getCreditNotes());
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const refreshList = () => {
    setCreditNotes(db.getCreditNotes());
  };

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
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Credit Notes Register</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Full and partial credit notes issued against UAE VAT invoices with allocation history.
          </p>
        </div>
        <Button
          variant="emerald"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 shadow-sm font-semibold"
        >
          <Plus className="h-4 w-4" />
          <span>New Credit Note</span>
        </Button>
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

        <div className="relative w-full sm:w-64">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search CN #, invoice, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
                <tr>
                  <th className="px-4 py-3">Credit Note #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Original Invoice</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Issuance Reason</th>
                  <th className="px-4 py-3 text-right">Net Credit</th>
                  <th className="px-4 py-3 text-right">VAT Credit</th>
                  <th className="px-4 py-3 text-right">Gross Total</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((cn) => (
                  <tr key={cn.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-amber-900">
                      {cn.credit_note_number}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {formatDate(cn.credit_note_date)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onViewInvoice && onViewInvoice(cn.invoice_id)}
                        className="font-mono font-semibold text-emerald-700 hover:underline cursor-pointer"
                      >
                        {cn.invoice_number}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {cn.customer_name}
                    </td>
                    <td className="px-4 py-3 text-slate-600 truncate max-w-xs">
                      {cn.reason}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                      {formatCurrency(cn.subtotal_net)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                      {formatCurrency(cn.vat_total)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-amber-900 text-sm">
                      {formatCurrency(cn.grand_total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={cn.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onPrintDocument && onPrintDocument('CREDIT_NOTE', cn.id)}
                        className="h-7 text-xs px-2 text-slate-700"
                        title="View Printable Credit Note"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> PDF
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                      No credit notes found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal */}
      <CreateCreditNoteModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={() => {
          refreshList();
        }}
      />
    </div>
  );
}
