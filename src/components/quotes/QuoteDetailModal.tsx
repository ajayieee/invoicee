'use client';

import React from 'react';
import {
  FileText,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Send,
  ArrowRight,
  Copy,
  Printer,
  Edit2,
  ShieldCheck,
  Building,
  User,
  Clock,
  Trash2,
} from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Quote, QuoteStatus } from '@/types/database';
import { quoteService } from '@/services/quote.service';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface QuoteDetailModalProps {
  quoteId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditDraft?: (quoteId: string) => void;
  onConverted?: (invoiceId: string) => void;
  onPrint?: (docType: 'QUOTE' | 'INVOICE', docId: string) => void;
  onRefresh?: () => void;
}

export function QuoteDetailModal({
  quoteId,
  open,
  onOpenChange,
  onEditDraft,
  onConverted,
  onPrint,
  onRefresh,
}: QuoteDetailModalProps) {
  const { permissions, user } = useAuth();

  if (!quoteId) return null;
  const quote = quoteService.getQuoteById(quoteId);
  if (!quote) return null;

  const isExpired = new Date(quote.expiry_date) < new Date() && quote.status !== 'CONVERTED';

  const handleStatusTransition = (newStatus: QuoteStatus) => {
    const res = quoteService.updateQuoteStatus(quote.id, newStatus, user.name);
    if (!res.success) {
      alert(res.error || 'Failed to update quote status.');
      return;
    }
    if (onRefresh) onRefresh();
  };

  const handleDuplicate = () => {
    const res = quoteService.duplicateQuote(quote.id, user.name);
    if (!res.success) {
      alert(res.error || 'Failed to duplicate quote.');
      return;
    }
    alert(`Quotation successfully duplicated as new draft ${res.data?.quote_number}!`);
    if (onRefresh) onRefresh();
    onOpenChange(false);
  };

  const handleConvert = () => {
    const res = quoteService.convertQuoteToInvoice(quote.id, user.name);
    if (!res.success) {
      alert(res.error || 'Failed to convert quotation.');
      return;
    }
    if (onRefresh) onRefresh();
    if (onConverted && res.data) {
      onOpenChange(false);
      onConverted(res.data.id);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Quotation ${quote.quote_number}`}
      description="Commercial price proposal and scope agreement"
      maxWidth="3xl"
      footer={
        <div className="flex flex-wrap items-center justify-between w-full gap-2 text-xs">
          <div className="flex items-center gap-2">
            {/* Print / PDF */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPrint && onPrint('QUOTE', quote.id)}
              className="flex items-center gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / PDF</span>
            </Button>

            {/* Duplicate */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDuplicate}
              className="flex items-center gap-1.5 text-slate-600"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Duplicate</span>
            </Button>

            {/* Edit (Draft only) */}
            {quote.status === 'DRAFT' && onEditDraft && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onEditDraft(quote.id);
                }}
                className="flex items-center gap-1.5 text-slate-700"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>Edit Draft</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Status Transitions */}
            {quote.status === 'DRAFT' && permissions.canApproveQuote && (
              <Button
                variant="emerald"
                size="sm"
                onClick={() => handleStatusTransition('SENT')}
                className="flex items-center gap-1.5 font-semibold"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Mark as Sent</span>
              </Button>
            )}

            {quote.status === 'SENT' && permissions.canApproveQuote && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusTransition('REJECTED')}
                  className="text-rose-600 hover:bg-rose-50"
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  <span>Reject</span>
                </Button>
                <Button
                  variant="emerald"
                  size="sm"
                  onClick={() => handleStatusTransition('ACCEPTED')}
                  className="font-semibold"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  <span>Client Accepted</span>
                </Button>
              </>
            )}

            {(quote.status === 'ACCEPTED' || quote.status === 'SENT') && permissions.canCreateInvoice && (
              <Button
                variant="emerald"
                size="sm"
                onClick={handleConvert}
                className="flex items-center gap-1.5 font-semibold shadow-xs"
              >
                <span>Convert to Tax Invoice</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}

            <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Converted Alert Banner */}
        {quote.status === 'CONVERTED' && quote.converted_invoice_id && (
          <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-purple-600 shrink-0" />
              <div>
                <span className="font-semibold">Converted into Legal Tax Invoice</span>
                <div className="text-[11px] text-purple-700">
                  This quotation has been officially converted. Original lines and terms remain preserved.
                </div>
              </div>
            </div>
            {onConverted && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onConverted(quote.converted_invoice_id!);
                }}
                className="bg-white text-purple-700 border-purple-300 text-xs"
              >
                View Invoice <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
        )}

        {/* Top Header Card */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div>
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Status</div>
            <div className="mt-1">
              <StatusBadge status={quote.status} />
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Issue Date</div>
            <div className="font-semibold text-slate-800 mt-1 flex items-center gap-1">
              <Calendar className="h-3 w-3 text-slate-400" />
              {formatDate(quote.quote_date)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Valid Until</div>
            <div
              className={`font-semibold mt-1 flex items-center gap-1 ${
                isExpired ? 'text-rose-600' : 'text-slate-800'
              }`}
            >
              {isExpired && <AlertCircle className="h-3 w-3 text-rose-600" />}
              {formatDate(quote.expiry_date)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Total Value</div>
            <div className="font-bold text-slate-900 text-sm mt-0.5">
              {formatCurrency(quote.grand_total)}
            </div>
          </div>
        </div>

        {/* Recipient Customer Details */}
        <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1">
          <div className="font-semibold text-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5 text-slate-500" />
              <span>Prepared for: {quote.customer_name}</span>
            </div>
            {quote.customer_trn ? (
              <span className="font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded text-[11px] flex items-center gap-1 border border-emerald-200">
                <ShieldCheck className="h-3 w-3 text-emerald-600" /> TRN: {quote.customer_trn}
              </span>
            ) : (
              <span className="text-slate-400 italic text-[11px]">Non-VAT Account</span>
            )}
          </div>
          {quote.customer_email && (
            <div className="text-slate-500 text-[11px]">Email: {quote.customer_email}</div>
          )}
        </div>

        {/* Line Items Table */}
        <div className="border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-slate-50 text-slate-500 text-[11px] border-b border-slate-200">
              <tr>
                <th className="p-2.5 font-medium">#</th>
                <th className="p-2.5 font-medium">Item Description</th>
                <th className="p-2.5 font-medium text-right">Qty</th>
                <th className="p-2.5 font-medium text-right">Unit Price</th>
                <th className="p-2.5 font-medium text-right">Discount</th>
                <th className="p-2.5 font-medium text-right">Net Subtotal</th>
                <th className="p-2.5 font-medium text-right">VAT (5%)</th>
                <th className="p-2.5 font-medium text-right">Total Gross</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quote.items.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="p-2.5 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                  <td className="p-2.5 font-medium text-slate-900">
                    <div>{item.description}</div>
                    <div className="text-[10px] text-slate-400">Unit: {item.unit}</div>
                  </td>
                  <td className="p-2.5 text-right font-mono text-slate-700">{item.quantity}</td>
                  <td className="p-2.5 text-right font-mono text-slate-700">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="p-2.5 text-right font-mono text-slate-500">
                    {item.discount_amount > 0 ? `-${formatCurrency(item.discount_amount)}` : '—'}
                  </td>
                  <td className="p-2.5 text-right font-mono font-medium text-slate-800">
                    {formatCurrency(item.subtotal_net)}
                  </td>
                  <td className="p-2.5 text-right font-mono text-slate-600">
                    {formatCurrency(item.vat_amount)}
                  </td>
                  <td className="p-2.5 text-right font-mono font-semibold text-slate-900">
                    {formatCurrency(item.total_gross)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Calculation Summary Box */}
        <div className="flex justify-end">
          <div className="w-full sm:w-72 space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-slate-600">
              <span>Gross Line Subtotal:</span>
              <span className="font-mono">{formatCurrency(quote.subtotal_net + (quote.discount_amount || 0))}</span>
            </div>

            {quote.discount_amount > 0 && (
              <div className="flex items-center justify-between text-rose-600">
                <span>Total Discount Applied:</span>
                <span className="font-mono">-{formatCurrency(quote.discount_amount)}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-slate-700 font-medium pt-1 border-t border-slate-200">
              <span>Taxable Net Amount:</span>
              <span className="font-mono">{formatCurrency(quote.subtotal_net)}</span>
            </div>

            <div className="flex items-center justify-between text-teal-800">
              <span>Total VAT (UAE 5%):</span>
              <span className="font-mono">{formatCurrency(quote.vat_total)}</span>
            </div>

            <div className="flex items-center justify-between text-slate-900 font-bold text-sm pt-2 border-t border-slate-200">
              <span>Grand Total ({quote.currency}):</span>
              <span className="font-mono text-emerald-800">{formatCurrency(quote.grand_total)}</span>
            </div>
          </div>
        </div>

        {/* Notes & Terms */}
        {(quote.notes || quote.terms) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {quote.notes && (
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="font-semibold text-slate-800 text-[11px] mb-0.5">Proposal Notes</div>
                <div className="text-slate-600 leading-relaxed text-[11px]">{quote.notes}</div>
              </div>
            )}
            {quote.terms && (
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="font-semibold text-slate-800 text-[11px] mb-0.5">Terms & Conditions</div>
                <div className="text-slate-600 leading-relaxed text-[11px]">{quote.terms}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
