'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Invoice } from '@/types/database';
import { db } from '@/lib/db/repository';
import { formatCurrency, formatDate } from '@/lib/utils';
import { InvoiceBuilderModal } from './InvoiceBuilderModal';
import { InvoiceDetailModal } from './InvoiceDetailModal';

interface InvoicesViewProps {
  onRecordPayment: (invoice: Invoice) => void;
  onCreateCreditNote: (invoice: Invoice) => void;
  onPrintInvoice: (invoiceId: string) => void;
}

export function InvoicesView({ onRecordPayment, onCreateCreditNote, onPrintInvoice }: InvoicesViewProps) {
  const [invoices, setInvoices] = useState<Invoice[]>(db.getInvoices());
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const refreshList = () => {
    setInvoices(db.getInvoices());
    if (selectedInvoice) {
      const refreshed = db.getInvoiceById(selectedInvoice.id);
      setSelectedInvoice(refreshed || null);
    }
  };

  const filtered = invoices.filter((inv) => {
    if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNum = inv.invoice_number.toLowerCase().includes(q);
      const matchCust =
        inv.customer_snapshot.company_name?.toLowerCase().includes(q) ||
        inv.customer_snapshot.contact_person?.toLowerCase().includes(q);
      if (!matchNum && !matchCust) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Tax Invoices Register</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Sequential UAE VAT invoices, receivables tracking, and audit-compliant cancellation logs.
          </p>
        </div>
        <Button variant="emerald" onClick={() => setBuilderOpen(true)} className="flex items-center gap-1.5 shadow-sm font-semibold">
          <Plus className="h-4 w-4" />
          <span>New Tax Invoice</span>
        </Button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1 flex-wrap w-full sm:w-auto">
          {['ALL', 'ISSUED', 'PARTIALLY_PAID', 'OVERDUE', 'PAID', 'DRAFT', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {st === 'ALL' ? 'All Invoices' : st.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search invoice # or client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
                <tr>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Customer / Billed To</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3 text-right">Net Subtotal</th>
                  <th className="px-4 py-3 text-right">VAT (5%)</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3 text-right">Balance Due</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((inv) => {
                  const isOverdue = inv.balance_due > 0 && new Date(inv.due_date) < new Date() && inv.status !== 'CANCELLED';

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {inv.invoice_number}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {inv.customer_snapshot.company_name || inv.customer_snapshot.contact_person}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {formatDate(inv.invoice_date)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={isOverdue ? 'text-rose-600 font-semibold flex items-center gap-1' : 'text-slate-500'}>
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPrintInvoice(inv.id)}
                            className="h-7 text-xs px-2 text-slate-600"
                            title="Print UAE Tax Invoice PDF"
                          >
                            <Printer className="h-3 w-3" />
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
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                      No invoices found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Builder Modal */}
      <InvoiceBuilderModal
        open={builderOpen}
        onOpenChange={setBuilderOpen}
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
        onPrint={onPrintInvoice}
        onRefresh={refreshList}
      />
    </div>
  );
}
