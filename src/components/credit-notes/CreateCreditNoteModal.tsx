'use client';

import React, { useState, useEffect } from 'react';
import { RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Invoice } from '@/types/database';
import { db } from '@/lib/db/repository';
import { formatCurrency } from '@/lib/utils';

interface CreateCreditNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetInvoice?: Invoice | null;
  onSuccess: (creditNoteId: string) => void;
}

export function CreateCreditNoteModal({
  open,
  onOpenChange,
  targetInvoice,
  onSuccess,
}: CreateCreditNoteModalProps) {
  const eligibleInvoices = db
    .getInvoices()
    .filter((i) => i.status !== 'CANCELLED' && i.status !== 'DRAFT');

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(
    targetInvoice?.id || eligibleInvoices[0]?.id || ''
  );

  const currentInvoice = db.getInvoiceById(selectedInvoiceId);

  const [reason, setReason] = useState('Price adjustment and service scope amendment.');
  const [allocationType, setAllocationType] = useState<'INVOICE_OFFSET' | 'CASH_REFUND'>('INVOICE_OFFSET');
  const [error, setError] = useState('');

  // Selected Line items with quantities to credit
  const [lineItemsConfig, setLineItemsConfig] = useState<
    Array<{
      invoice_item_id: string;
      description: string;
      max_qty: number;
      quantity_to_credit: number;
      unit_price: number;
      vat_rate: number;
      selected: boolean;
    }>
  >([]);

  useEffect(() => {
    if (targetInvoice) {
      setSelectedInvoiceId(targetInvoice.id);
      initLines(targetInvoice);
    } else if (eligibleInvoices[0]) {
      setSelectedInvoiceId(eligibleInvoices[0].id);
      initLines(eligibleInvoices[0]);
    }
  }, [targetInvoice, open]);

  const initLines = (inv: Invoice) => {
    setLineItemsConfig(
      inv.items.map((it) => ({
        invoice_item_id: it.id,
        description: it.description,
        max_qty: it.quantity,
        quantity_to_credit: it.quantity,
        unit_price: it.unit_price,
        vat_rate: it.vat_rate_percentage,
        selected: true,
      }))
    );
  };

  const handleInvoiceChange = (invId: string) => {
    setSelectedInvoiceId(invId);
    const inv = db.getInvoiceById(invId);
    if (inv) initLines(inv);
  };

  // Compute total credit amount
  let totalNet = 0;
  let totalVat = 0;
  lineItemsConfig.forEach((it) => {
    if (it.selected && it.quantity_to_credit > 0) {
      const net = it.quantity_to_credit * it.unit_price;
      const vat = (net * it.vat_rate) / 100;
      totalNet += net;
      totalVat += vat;
    }
  });
  const grandTotalCredit = Number((totalNet + totalVat).toFixed(2));

  const handleSubmit = () => {
    if (!currentInvoice) {
      setError('Please select an invoice.');
      return;
    }
    if (!reason.trim()) {
      setError('A mandatory reason is required for issuing a credit note under UAE VAT regulations.');
      return;
    }
    if (grandTotalCredit <= 0) {
      setError('Please select at least one line item with a positive quantity to credit.');
      return;
    }
    if (grandTotalCredit > currentInvoice.grand_total) {
      setError('Credit note amount cannot exceed the total value of the originating tax invoice.');
      return;
    }

    try {
      const activeLines = lineItemsConfig
        .filter((it) => it.selected && it.quantity_to_credit > 0)
        .map((it) => ({
          invoice_item_id: it.invoice_item_id,
          quantity_to_credit: it.quantity_to_credit,
          unit_price: it.unit_price,
        }));

      const cn = db.createCreditNoteFromInvoice(
        currentInvoice.id,
        activeLines,
        reason.trim(),
        allocationType
      );

      onSuccess(cn.id);
      onOpenChange(false);
    } catch (e: any) {
      setError(e.message || 'Failed to issue credit note');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Issue UAE Tax Credit Note"
      description="Create a credit adjustment referencing an issued tax invoice with line item precision."
      maxWidth="3xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-500">
            Total Credit (AED): <strong className="text-amber-700 font-mono text-sm">{formatCurrency(grandTotalCredit)}</strong>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Originating Invoice Picker */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
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
            label="Credit Allocation Method"
            value={allocationType}
            onChange={(e) => setAllocationType(e.target.value as any)}
            options={[
              { label: 'Offset against Outstanding Invoice Balance', value: 'INVOICE_OFFSET' },
              { label: 'Direct Cash / Bank Wire Refund to Client', value: 'CASH_REFUND' },
            ]}
          />
        </div>

        {/* Line Items Selection for Partial Credit */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Select Lines & Adjust Quantity to Credit
            </span>
            <span className="text-[11px] text-slate-500">
              Supports partial quantities and unit price revisions
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2 w-10 text-center">Credit</th>
                  <th className="p-2">Description</th>
                  <th className="p-2 w-24 text-center">Invoiced Qty</th>
                  <th className="p-2 w-24 text-center">Credit Qty</th>
                  <th className="p-2 w-24 text-right">Price (AED)</th>
                  <th className="p-2 w-28 text-right">Credit Net + VAT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {lineItemsConfig.map((line, idx) => {
                  const lineNet = line.selected ? line.quantity_to_credit * line.unit_price : 0;
                  const lineVat = (lineNet * line.vat_rate) / 100;
                  const lineGross = lineNet + lineVat;

                  return (
                    <tr key={line.invoice_item_id} className={line.selected ? 'bg-amber-50/20' : 'opacity-60'}>
                      <td className="p-2 text-center align-middle">
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
                      <td className="p-2 font-medium text-slate-900">{line.description}</td>
                      <td className="p-2 text-center text-slate-500">{line.max_qty}</td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min="0.1"
                          max={line.max_qty}
                          step="0.1"
                          disabled={!line.selected}
                          className="w-20 p-1 text-center font-mono text-xs rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-600 disabled:bg-slate-100"
                          value={line.quantity_to_credit}
                          onChange={(e) => {
                            const val = Math.min(line.max_qty, Number(e.target.value));
                            setLineItemsConfig((prev) => {
                              const copy = [...prev];
                              copy[idx].quantity_to_credit = val;
                              return copy;
                            });
                          }}
                        />
                      </td>
                      <td className="p-2 text-right font-mono text-slate-600">{line.unit_price.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono font-bold text-amber-900">
                        {formatCurrency(lineGross)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reason for Credit Note */}
        <Textarea
          label="Mandatory Reason for Credit Note Issuance *"
          placeholder="e.g. Return of 2 server instances due to project scope reduction; agreed credit offset."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
        />
      </div>
    </Dialog>
  );
}
