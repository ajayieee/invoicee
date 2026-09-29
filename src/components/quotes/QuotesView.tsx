'use client';

import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Send,
  ArrowRight,
  Eye,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Quote, QuoteStatus } from '@/types/database';
import { db } from '@/lib/db/repository';
import { formatCurrency, formatDate } from '@/lib/utils';
import { QuoteBuilderModal } from './QuoteBuilderModal';

interface QuotesViewProps {
  onViewInvoice?: (invoiceId: string) => void;
  onPrintDocument?: (docType: 'QUOTE' | 'INVOICE' | 'CREDIT_NOTE' | 'STATEMENT', docId: string) => void;
}

export function QuotesView({ onViewInvoice, onPrintDocument }: QuotesViewProps) {
  const [quotes, setQuotes] = useState<Quote[]>(db.getQuotes());
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | undefined>();
  const [successMsg, setSuccessMsg] = useState('');

  const refreshList = () => {
    setQuotes(db.getQuotes());
  };

  const handleStatusChange = (id: string, newStatus: QuoteStatus) => {
    try {
      db.updateQuoteStatus(id, newStatus);
      refreshList();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleConvert = (quoteId: string) => {
    try {
      const invoice = db.convertQuoteToInvoice(quoteId);
      refreshList();
      setSuccessMsg(`Quotation converted successfully into Tax Invoice ${invoice.invoice_number}!`);
      setTimeout(() => setSuccessMsg(''), 5000);
      if (onViewInvoice) {
        onViewInvoice(invoice.id);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filtered = quotes.filter((q) => {
    if (statusFilter !== 'ALL' && q.status !== statusFilter) return false;
    if (search.trim()) {
      const query = search.toLowerCase();
      const matchNum = q.quote_number.toLowerCase().includes(query);
      const matchCust = q.customer_name?.toLowerCase().includes(query);
      if (!matchNum && !matchCust) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Quotations & Proposals</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create cost estimates, dispatch proposals, and convert accepted quotes into legal UAE tax invoices.
          </p>
        </div>
        <Button
          variant="emerald"
          onClick={() => {
            setSelectedQuoteId(undefined);
            setBuilderOpen(true);
          }}
          className="flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>New Quotation</span>
        </Button>
      </div>

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between animate-in fade-in">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="font-semibold text-emerald-900">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1 flex-wrap w-full sm:w-auto">
          {['ALL', 'DRAFT', 'SENT', 'ACCEPTED', 'CONVERTED', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {st === 'ALL' ? 'All Quotes' : st.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by quote # or client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>
      </div>

      {/* Quotations Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
                <tr>
                  <th className="px-4 py-3">Quote #</th>
                  <th className="px-4 py-3">Recipient Customer</th>
                  <th className="px-4 py-3">Issue Date</th>
                  <th className="px-4 py-3">Expiry Date</th>
                  <th className="px-4 py-3 text-right">Net Subtotal</th>
                  <th className="px-4 py-3 text-right">VAT (5%)</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((q) => {
                  const isExpired = new Date(q.expiry_date) < new Date() && q.status !== 'CONVERTED';

                  return (
                    <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                        {q.quote_number}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {q.customer_name}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {formatDate(q.quote_date)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        <span className={isExpired ? 'text-rose-600 font-semibold flex items-center gap-1' : ''}>
                          {isExpired && <AlertCircle className="h-3 w-3" />}
                          {formatDate(q.expiry_date)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">
                        {formatCurrency(q.subtotal_net)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">
                        {formatCurrency(q.vat_total)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(q.grand_total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={q.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Print / Preview */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onPrintDocument && onPrintDocument('QUOTE', q.id)}
                            className="h-7 text-xs px-2 text-slate-600"
                            title="View Printable Quotation PDF"
                          >
                            <Eye className="h-3 w-3 mr-1" /> PDF
                          </Button>

                          {/* State transition triggers */}
                          {q.status === 'DRAFT' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStatusChange(q.id, 'SENT')}
                              className="h-7 text-xs px-2"
                            >
                              <Send className="h-3 w-3 mr-1 text-sky-600" /> Send
                            </Button>
                          )}

                          {q.status === 'SENT' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStatusChange(q.id, 'ACCEPTED')}
                                className="h-7 text-xs px-2 text-emerald-700 hover:bg-emerald-50"
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" /> Accept
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStatusChange(q.id, 'REJECTED')}
                                className="h-7 text-xs px-2 text-rose-600 hover:bg-rose-50"
                              >
                                Reject
                              </Button>
                            </>
                          )}

                          {q.status === 'ACCEPTED' && (
                            <Button
                              variant="emerald"
                              size="sm"
                              onClick={() => handleConvert(q.id)}
                              className="h-7 text-xs px-2 font-semibold shadow-xs"
                            >
                              Convert to Invoice <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                          )}

                          {q.status === 'CONVERTED' && q.converted_invoice_id && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => onViewInvoice && onViewInvoice(q.converted_invoice_id!)}
                              className="h-7 text-xs px-2 text-purple-700"
                            >
                              View Invoice
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                      No quotations found matching your filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Quote Builder Modal */}
      <QuoteBuilderModal
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        onSuccess={() => {
          refreshList();
        }}
        initialQuoteId={selectedQuoteId}
      />
    </div>
  );
}
