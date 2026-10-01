'use client';

import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Receipt,
  Layers,
  Percent,
  Coins,
  FileText,
} from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Invoice, CreditNoteType, CreditReasonCode, RefundStatus } from '@/types/database';
import { creditNoteService } from '@/services/credit-note.service';
import { db } from '@/lib/db/repository';
import { formatCurrency, formatDate } from '@/lib/utils';

interface CreateCreditNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetInvoice?: Invoice | null;
  onSuccess: (creditNoteId: string) => void;
}

interface LineConfig {
  invoice_item_id: string;
  description: string;
  max_qty: number;
  quantity_to_credit: number;
  original_price: number;
  unit_price: number;
  vat_rate: number;
  selected: boolean;
  adjustment_mode: 'QUANTITY' | 'AMOUNT';
  custom_amount: number; // custom net amount if in AMOUNT mode
}

export function CreateCreditNoteModal({
  open,
  onOpenChange,
  targetInvoice,
  onSuccess,
}: CreateCreditNoteModalProps) {
  const eligibleInvoices = creditNoteService.getEligibleInvoices();

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(
    targetInvoice?.id || eligibleInvoices[0]?.id || ''
  );

  const currentInvoice = db.getInvoiceById(selectedInvoiceId);

  const [creditMode, setCreditMode] = useState<'FULL' | 'CUSTOM'>('CUSTOM');
  const [creditReasonCode, setCreditReasonCode] = useState<CreditReasonCode>('RE_PRICE_REDUCTION');
  const [reason, setReason] = useState('Price adjustment and service scope amendment agreed with client.');
  const [allocationType, setAllocationType] = useState<
    'INVOICE_OFFSET' | 'CASH_REFUND' | 'BANK_REFUND' | 'CREDIT_ON_ACCOUNT'
  >('INVOICE_OFFSET');
  const [error, setError] = useState('');

  // Line items state
  const [lineItemsConfig, setLineItemsConfig] = useState<LineConfig[]>([]);

  useEffect(() => {
    if (targetInvoice) {
      setSelectedInvoiceId(targetInvoice.id);
      initLines(targetInvoice);
    } else if (eligibleInvoices[0]) {
      setSelectedInvoiceId(eligibleInvoices[0].id);
      initLines(eligibleInvoices[0]);
    }
  }, [targetInvoice, open]);

  const initLines = (inv: Invoice, selectAllAsFull = false) => {
    // Calculate previously credited quantities
    const existingNotes = db
      .getCreditNotes()
      .filter((cn) => cn.invoice_id === inv.id && cn.status !== 'CANCELLED');

    const lines: LineConfig[] = inv.items.map((it) => {
      let alreadyCreditedQty = 0;
      let alreadyCreditedNet = 0;
      existingNotes.forEach((cn) => {
        cn.items.forEach((cni) => {
          if (cni.invoice_item_id === it.id) {
            alreadyCreditedQty += cni.quantity;
            alreadyCreditedNet += cni.subtotal_net;
          }
        });
      });

      const maxRemainingQty = Math.max(0, Number((it.quantity - alreadyCreditedQty).toFixed(4)));
      const maxRemainingNet = Math.max(0, Number((it.subtotal_net - alreadyCreditedNet).toFixed(2)));

      return {
        invoice_item_id: it.id,
        description: it.description,
        max_qty: maxRemainingQty,
        quantity_to_credit: maxRemainingQty,
        original_price: it.unit_price,
        unit_price: it.unit_price,
        vat_rate: it.vat_rate_percentage,
        selected: selectAllAsFull ? maxRemainingQty > 0 : true,
        adjustment_mode: 'QUANTITY',
        custom_amount: maxRemainingNet,
      };
    });

    setLineItemsConfig(lines);
  };

  const handleInvoiceChange = (invId: string) => {
    setSelectedInvoiceId(invId);
    const inv = db.getInvoiceById(invId);
    if (inv) initLines(inv);
  };

  // Full Credit Note 1-click trigger
  const handleSelectFullCredit = () => {
    setCreditMode('FULL');
    if (currentInvoice) {
      initLines(currentInvoice, true);
      setReason(`Full cancellation and credit refund for Tax Invoice ${currentInvoice.invoice_number}.`);
      setCreditReasonCode('RE_CANCELLATION');
    }
  };

  const handleSelectCustomCredit = () => {
    setCreditMode('CUSTOM');
  };

  // Compute live totals
  let totalNet = 0;
  let totalVat = 0;

  lineItemsConfig.forEach((it) => {
    if (it.selected) {
      let lineNet = 0;
      if (it.adjustment_mode === 'AMOUNT') {
        lineNet = Number((it.custom_amount || 0).toFixed(2));
      } else {
        lineNet = Number(((it.quantity_to_credit || 0) * (it.unit_price || 0)).toFixed(2));
      }
      const lineVat = Number(((lineNet * it.vat_rate) / 100).toFixed(2));
      totalNet += lineNet;
      totalVat += lineVat;
    }
  });

  const grandTotalCredit = Number((totalNet + totalVat).toFixed(2));
  const invoiceBalance = currentInvoice?.balance_due ?? 0;
  const newBalanceDue = Math.max(0, Number((invoiceBalance - (allocationType === 'INVOICE_OFFSET' ? grandTotalCredit : 0)).toFixed(2)));

  const handleSubmit = () => {
    if (!currentInvoice) {
      setError('Please select an invoice.');
      return;
    }
    if (!reason.trim()) {
      setError('A mandatory reason is required for issuing a credit note under UAE VAT regulations.');
      return;
    }

    const selectedLines = lineItemsConfig.filter((it) => it.selected);
    if (selectedLines.length === 0) {
      setError('Please select at least one line item to credit.');
      return;
    }

    if (grandTotalCredit <= 0) {
      setError('The total credit amount must be greater than zero.');
      return;
    }

    try {
      // Determine credit note type based on user setup
      let determinedType: CreditNoteType = 'PARTIAL';
      if (creditMode === 'FULL') {
        determinedType = 'FULL';
      } else if (selectedLines.some((l) => l.adjustment_mode === 'AMOUNT' || l.unit_price !== l.original_price)) {
        determinedType = 'AMOUNT_ADJUSTMENT';
      } else if (selectedLines.some((l) => l.quantity_to_credit < l.max_qty)) {
        determinedType = 'QUANTITY_ADJUSTMENT';
      } else if (selectedLines.length < currentInvoice.items.length) {
        determinedType = 'LINE_SELECTION';
      }

      const activeItems = selectedLines.map((it) => ({
        invoice_item_id: it.invoice_item_id,
        quantity_to_credit: it.adjustment_mode === 'AMOUNT' ? 1 : it.quantity_to_credit,
        unit_price: it.adjustment_mode === 'AMOUNT' ? it.custom_amount : it.unit_price,
        amount_to_credit: it.adjustment_mode === 'AMOUNT' ? it.custom_amount : undefined,
      }));

      const res = creditNoteService.createCreditNote({
        invoice_id: currentInvoice.id,
        items: activeItems,
        reason: reason.trim(),
        credit_type: determinedType,
        credit_reason_code: creditReasonCode,
        allocation_type: allocationType,
      });

      if (!res.success || !res.data) {
        setError(res.error || 'Failed to issue credit note.');
        return;
      }

      onSuccess(res.data.id);
      onOpenChange(false);
    } catch (e: any) {
      setError(e.message || 'Failed to issue credit note');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Issue UAE Tax Credit Note / إشعار دائن ضريبي"
      description="Create a credit adjustment referencing an issued tax invoice with line item precision and audit compliance."
      maxWidth="4xl"
      footer={
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between w-full gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-slate-600">
            <div>
              Net Credit: <strong className="font-mono text-slate-800">{formatCurrency(totalNet)}</strong>
            </div>
            <div>
              VAT Adjustment: <strong className="font-mono text-slate-800">{formatCurrency(totalVat)}</strong>
            </div>
            <div className="text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
              Total Credit: <strong className="font-mono text-sm font-bold">{formatCurrency(grandTotalCredit)} AED</strong>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="emerald" onClick={handleSubmit} className="font-semibold shadow-xs">
              Issue Credit Note
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Credit Note Mode Selector (Full vs Custom/Partial) */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={handleSelectFullCredit}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              creditMode === 'FULL'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>1. Full Credit Note (100% Invoice Value)</span>
          </button>
          <button
            type="button"
            onClick={handleSelectCustomCredit}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              creditMode === 'CUSTOM'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>2. Partial / Selected Lines & Adjustments</span>
          </button>
        </div>

        {/* Originating Invoice Picker & Key Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <Select
            label="Originating Tax Invoice *"
            value={selectedInvoiceId}
            onChange={(e) => handleInvoiceChange(e.target.value)}
            options={eligibleInvoices.map((inv) => ({
              label: `${inv.invoice_number} • ${inv.customer_snapshot.company_name || inv.customer_snapshot.contact_person} (${formatCurrency(inv.grand_total)})`,
              value: inv.id,
            }))}
          />
          <Select
            label="Refund / Allocation Settlement Method"
            value={allocationType}
            onChange={(e) => setAllocationType(e.target.value as any)}
            options={[
              { label: 'Offset against Outstanding Invoice Balance', value: 'INVOICE_OFFSET' },
              { label: 'Retain as Customer Credit on Account', value: 'CREDIT_ON_ACCOUNT' },
              { label: 'Direct Cash Refund to Client', value: 'CASH_REFUND' },
              { label: 'Direct Bank Wire / Cheque Refund to Client', value: 'BANK_REFUND' },
            ]}
          />

          {currentInvoice && (
            <div className="col-span-1 sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Invoice Date:</span>
                <span className="font-medium text-slate-700">{formatDate(currentInvoice.invoice_date)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Original Invoice Total:</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(currentInvoice.grand_total)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Current Balance Due:</span>
                <span className="font-mono font-bold text-rose-600">{formatCurrency(currentInvoice.balance_due)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">New Balance After Credit:</span>
                <span className="font-mono font-bold text-emerald-600">{formatCurrency(newBalanceDue)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Line Items Selection & Adjustments Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>Invoice Lines & Precision Adjustments</span>
            </span>
            <span className="text-[11px] text-slate-500">
              Select lines, adjust quantity, or enter custom credit amount
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
            <table className="w-full text-xs text-left min-w-[650px]">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5 w-10 text-center">Credit</th>
                  <th className="p-2.5">Description</th>
                  <th className="p-2.5 w-24 text-center">Mode</th>
                  <th className="p-2.5 w-24 text-center">Quantity</th>
                  <th className="p-2.5 w-28 text-right">Price / Net (AED)</th>
                  <th className="p-2.5 w-28 text-right">Credit Total (Gross)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {lineItemsConfig.map((line, idx) => {
                  let lineNet = 0;
                  if (line.selected) {
                    if (line.adjustment_mode === 'AMOUNT') {
                      lineNet = line.custom_amount;
                    } else {
                      lineNet = line.quantity_to_credit * line.unit_price;
                    }
                  }
                  const lineVat = (lineNet * line.vat_rate) / 100;
                  const lineGross = lineNet + lineVat;

                  return (
                    <tr
                      key={line.invoice_item_id}
                      className={line.selected ? 'bg-amber-50/20' : 'opacity-60 bg-slate-50/50'}
                    >
                      {/* Checkbox (Selected Invoice Lines) */}
                      <td className="p-2.5 text-center align-middle">
                        <input
                          type="checkbox"
                          checked={line.selected}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setLineItemsConfig((prev) => {
                              const copy = [...prev];
                              copy[idx].selected = val;
                              return copy;
                            });
                          }}
                          className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                      </td>

                      {/* Description */}
                      <td className="p-2.5">
                        <div className="font-medium text-slate-900">{line.description}</div>
                        <div className="text-[10px] text-slate-400">
                          Max available: {line.max_qty} units @ {formatCurrency(line.original_price)} (5% VAT)
                        </div>
                      </td>

                      {/* Adjustment Mode Toggle (Quantity vs Amount Adjustment) */}
                      <td className="p-2.5 text-center">
                        <select
                          disabled={!line.selected || creditMode === 'FULL'}
                          value={line.adjustment_mode}
                          onChange={(e) => {
                            const val = e.target.value as 'QUANTITY' | 'AMOUNT';
                            setLineItemsConfig((prev) => {
                              const copy = [...prev];
                              copy[idx].adjustment_mode = val;
                              return copy;
                            });
                          }}
                          className="text-[11px] p-1 rounded border border-slate-300 bg-white font-medium text-slate-700"
                        >
                          <option value="QUANTITY">Quantity</option>
                          <option value="AMOUNT">Amount</option>
                        </select>
                      </td>

                      {/* Quantity Adjustment */}
                      <td className="p-2.5 text-center">
                        {line.adjustment_mode === 'QUANTITY' ? (
                          <input
                            type="number"
                            min="0.1"
                            max={line.max_qty}
                            step="0.1"
                            disabled={!line.selected || creditMode === 'FULL'}
                            value={line.quantity_to_credit}
                            onChange={(e) => {
                              const val = Math.min(line.max_qty, Math.max(0, Number(e.target.value)));
                              setLineItemsConfig((prev) => {
                                const copy = [...prev];
                                copy[idx].quantity_to_credit = val;
                                return copy;
                              });
                            }}
                            className="w-20 p-1 text-center font-mono text-xs rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-600 disabled:bg-slate-100"
                          />
                        ) : (
                          <span className="text-slate-400 text-xs">1 unit flat</span>
                        )}
                      </td>

                      {/* Price / Amount Adjustment */}
                      <td className="p-2.5 text-right">
                        {line.adjustment_mode === 'AMOUNT' ? (
                          <input
                            type="number"
                            min="0.01"
                            max={line.max_qty * line.original_price}
                            step="0.01"
                            disabled={!line.selected}
                            value={line.custom_amount}
                            onChange={(e) => {
                              const val = Math.min(line.max_qty * line.original_price, Math.max(0, Number(e.target.value)));
                              setLineItemsConfig((prev) => {
                                const copy = [...prev];
                                copy[idx].custom_amount = val;
                                return copy;
                              });
                            }}
                            className="w-24 p-1 text-right font-mono text-xs rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-600"
                          />
                        ) : (
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            disabled={!line.selected || creditMode === 'FULL'}
                            value={line.unit_price}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value));
                              setLineItemsConfig((prev) => {
                                const copy = [...prev];
                                copy[idx].unit_price = val;
                                return copy;
                              });
                            }}
                            className="w-24 p-1 text-right font-mono text-xs rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-600 disabled:bg-slate-100"
                          />
                        )}
                      </td>

                      {/* Total Gross Credit */}
                      <td className="p-2.5 text-right font-mono font-bold text-amber-900">
                        {formatCurrency(lineGross)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reason Code and Reason Text */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="UAE FTA Standard Reason Code *"
            value={creditReasonCode}
            onChange={(e) => setCreditReasonCode(e.target.value as CreditReasonCode)}
            options={[
              { label: 'Price Reduction / Commercial Adjustment (RE_PRICE_REDUCTION)', value: 'RE_PRICE_REDUCTION' },
              { label: 'Return of Delivered Goods (RE_RETURN)', value: 'RE_RETURN' },
              { label: 'Post-Tax Commercial Discount / Rebate (RE_DISCOUNT)', value: 'RE_DISCOUNT' },
              { label: 'Invoice Correction / Billing Error (RE_CORRECTION)', value: 'RE_CORRECTION' },
              { label: 'Defective Goods or Service Dispute (RE_DEFECT)', value: 'RE_DEFECT' },
              { label: 'Mutual Transaction Cancellation (RE_CANCELLATION)', value: 'RE_CANCELLATION' },
              { label: 'Other Business Adjustment (RE_OTHER)', value: 'RE_OTHER' },
            ]}
          />
          <div className="flex items-end">
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 w-full flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>Prepared for UAE FTA electronic clearance through Accredited Service Provider (ASP).</span>
            </div>
          </div>
        </div>

        <Textarea
          label="Mandatory Reason for Credit Note Issuance *"
          placeholder="e.g. Price adjustment and partial scope reduction agreed with client following quarterly review."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
        />
      </div>
    </Dialog>
  );
}
