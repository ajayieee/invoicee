'use client';

import React, { useState, useEffect } from 'react';
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
  Copy,
  Clock,
  Printer,
  Edit2,
  RotateCcw,
  Receipt,
  Filter,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/SkeletonTable';
import { AlertBanner } from '@/components/ui/FormError';
import { Quote, QuoteStatus } from '@/types/database';
import { quoteService } from '@/services/quote.service';
import { formatCurrency, formatDate } from '@/lib/utils';
import { QuoteBuilderModal } from './QuoteBuilderModal';
import { QuoteDetailModal } from './QuoteDetailModal';
import { useAuth } from '@/context/AuthContext';

interface QuotesViewProps {
  onViewInvoice?: (invoiceId: string) => void;
  onPrintDocument?: (docType: 'QUOTE' | 'INVOICE' | 'CREDIT_NOTE' | 'STATEMENT', docId: string) => void;
}

export function QuotesView({ onViewInvoice, onPrintDocument }: QuotesViewProps) {
  const { user, permissions } = useAuth();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'ALL'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Paged quotes
  const [pagedData, setPagedData] = useState(() =>
    quoteService.getQuotes({
      search: '',
      status: 'ALL',
      page: 1,
      pageSize: 10,
    })
  );

  // Modals
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editQuoteId, setEditQuoteId] = useState<string | undefined>();
  const [detailQuoteId, setDetailQuoteId] = useState<string | undefined>();
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Feedback Banner
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      await quoteService.syncQuotes();
    } catch (e) {
      console.warn('Quote cloud sync failed:', e);
    }
    const result = quoteService.getQuotes({
      search,
      status: statusFilter,
      page: currentPage,
      pageSize,
    });
    setPagedData(result);
    setLoading(false);
  };

  useEffect(() => {
    fetchQuotes();
  }, [search, statusFilter, currentPage, pageSize]);

  const handleStatusChange = (id: string, newStatus: QuoteStatus) => {
    const res = quoteService.updateQuoteStatus(id, newStatus, user.name);
    if (!res.success) {
      setFeedback({ type: 'error', message: res.error || 'Failed to update quote status.' });
      return;
    }
    setFeedback({
      type: 'success',
      message: `Quotation status successfully updated to ${newStatus}.`,
    });
    setTimeout(() => setFeedback(null), 4000);
    fetchQuotes();
  };

  const handleConvert = (quoteId: string) => {
    const res = quoteService.convertQuoteToInvoice(quoteId, user.name);
    if (!res.success) {
      setFeedback({ type: 'error', message: res.error || 'Failed to convert quotation to invoice.' });
      return;
    }

    const inv = res.data!;
    setFeedback({
      type: 'success',
      message: `Quotation successfully converted into official Tax Invoice ${inv.invoice_number}!`,
    });
    setTimeout(() => setFeedback(null), 5000);
    fetchQuotes();

    if (onViewInvoice) {
      onViewInvoice(inv.id);
    }
  };

  const handleDuplicate = (quoteId: string) => {
    const res = quoteService.duplicateQuote(quoteId, user.name);
    if (!res.success) {
      setFeedback({ type: 'error', message: res.error || 'Failed to duplicate quotation.' });
      return;
    }

    setFeedback({
      type: 'success',
      message: `Quotation duplicated as new draft ${res.data?.quote_number}.`,
    });
    setTimeout(() => setFeedback(null), 4000);
    fetchQuotes();
  };

  const handleOpenDetail = (id: string) => {
    setDetailQuoteId(id);
    setDetailModalOpen(true);
  };

  const handleOpenEditDraft = (id: string) => {
    setEditQuoteId(id);
    setBuilderOpen(true);
  };

  const handleOpenCreate = () => {
    setEditQuoteId(undefined);
    setBuilderOpen(true);
  };

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

        {permissions.canApproveQuote && (
          <Button variant="emerald" onClick={handleOpenCreate} className="flex items-center gap-1.5 shadow-sm font-semibold">
            <Plus className="h-4 w-4" />
            <span>New Quotation</span>
          </Button>
        )}
      </div>

      {feedback && (
        <AlertBanner
          variant={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1 flex-wrap w-full md:w-auto overflow-x-auto">
          {(['ALL', 'DRAFT', 'SENT', 'ACCEPTED', 'CONVERTED', 'REJECTED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {st === 'ALL' ? 'All Quotes' : st.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by quote #, client, or item..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>
      </div>

      {/* Quotations Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <SkeletonTable rows={5} columns={8} />
          ) : pagedData.items.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={FileText}
                title="No Quotations Found"
                description={
                  search || statusFilter !== 'ALL'
                    ? 'No quotations matched your active search filters. Try clearing your query.'
                    : 'Create your first commercial proposal or cost estimate for active clients.'
                }
                action={
                  search || statusFilter !== 'ALL'
                    ? {
                        label: 'Clear Filters',
                        onClick: () => {
                          setSearch('');
                          setStatusFilter('ALL');
                        },
                        icon: RotateCcw,
                      }
                    : permissions.canApproveQuote
                    ? {
                        label: 'Create First Quotation',
                        onClick: handleOpenCreate,
                        icon: Plus,
                      }
                    : undefined
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[900px]">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
                  <tr>
                    <th className="px-4 py-3">Quote #</th>
                    <th className="px-4 py-3">Recipient Customer</th>
                    <th className="px-4 py-3">Issue Date</th>
                    <th className="px-4 py-3">Valid Until</th>
                    <th className="px-4 py-3 text-right">Net Subtotal</th>
                    <th className="px-4 py-3 text-right">VAT (5%)</th>
                    <th className="px-4 py-3 text-right">Grand Total</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Workflow Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedData.items.map((q) => {
                    const isExpired = new Date(q.expiry_date) < new Date() && q.status !== 'CONVERTED';

                    return (
                      <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                          <button
                            onClick={() => handleOpenDetail(q.id)}
                            className="text-slate-900 hover:text-emerald-700 underline-offset-2 hover:underline cursor-pointer"
                          >
                            {q.quote_number}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          <div>{q.customer_name}</div>
                          {q.customer_trn && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              TRN: {q.customer_trn}
                            </div>
                          )}
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
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            {/* Detail / 360 */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDetail(q.id)}
                              className="h-7 text-xs px-2 text-slate-600"
                              title="View Quote Details"
                            >
                              <Eye className="h-3 w-3 mr-1" /> View
                            </Button>

                            {/* Print / PDF */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onPrintDocument && onPrintDocument('QUOTE', q.id)}
                              className="h-7 text-xs px-2 text-slate-600"
                              title="Print Quotation PDF"
                            >
                              <Printer className="h-3 w-3 mr-1" /> PDF
                            </Button>

                            {/* Edit (Draft only) */}
                            {q.status === 'DRAFT' && permissions.canApproveQuote && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEditDraft(q.id)}
                                className="h-7 text-xs px-2 text-slate-700"
                                title="Edit Draft Quotation"
                              >
                                <Edit2 className="h-3 w-3 mr-1" /> Edit
                              </Button>
                            )}

                            {/* Duplicate */}
                            <button
                              onClick={() => handleDuplicate(q.id)}
                              title="Duplicate as new draft"
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 cursor-pointer"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>

                            {/* Send Trigger */}
                            {q.status === 'DRAFT' && permissions.canApproveQuote && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStatusChange(q.id, 'SENT')}
                                className="h-7 text-xs px-2 text-sky-700 hover:bg-sky-50"
                              >
                                <Send className="h-3 w-3 mr-1" /> Send
                              </Button>
                            )}

                            {/* Accept / Reject */}
                            {q.status === 'SENT' && permissions.canApproveQuote && (
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

                            {/* Convert to Tax Invoice */}
                            {(q.status === 'ACCEPTED' || q.status === 'SENT') && permissions.canCreateInvoice && (
                              <Button
                                variant="emerald"
                                size="sm"
                                onClick={() => handleConvert(q.id)}
                                className="h-7 text-xs px-2 font-semibold shadow-xs"
                              >
                                Convert <ArrowRight className="h-3 w-3 ml-1" />
                              </Button>
                            )}

                            {/* Converted Invoice Link */}
                            {q.status === 'CONVERTED' && q.converted_invoice_id && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => onViewInvoice && onViewInvoice(q.converted_invoice_id!)}
                                className="h-7 text-xs px-2 text-purple-700 font-medium"
                              >
                                <Receipt className="h-3 w-3 mr-1" /> Invoice
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          <Pagination
            currentPage={pagedData.currentPage}
            totalPages={pagedData.totalPages}
            totalItems={pagedData.totalItems}
            pageSize={pagedData.pageSize}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        </CardContent>
      </Card>

      {/* Quote Builder Modal */}
      <QuoteBuilderModal
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        onSuccess={() => {
          fetchQuotes();
        }}
        initialQuoteId={editQuoteId}
      />

      {/* Quote Detail Modal */}
      <QuoteDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        quoteId={detailQuoteId}
        onEditDraft={(id) => handleOpenEditDraft(id)}
        onConverted={(invId) => {
          fetchQuotes();
          if (onViewInvoice) onViewInvoice(invId);
        }}
        onPrint={(type, id) => onPrintDocument && onPrintDocument(type, id)}
        onRefresh={() => fetchQuotes()}
      />
    </div>
  );
}
