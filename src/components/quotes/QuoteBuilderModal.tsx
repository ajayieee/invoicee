'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ShieldCheck } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Customer, Product, VatRate, LineItem, DiscountType } from '@/types/database';
import { db } from '@/lib/db/repository';
import { VatCalculator } from '@/lib/vat/calculator';
import { formatCurrency } from '@/lib/utils';

interface QuoteBuilderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (quoteId: string) => void;
  initialQuoteId?: string;
}

export function QuoteBuilderModal({ open, onOpenChange, onSuccess, initialQuoteId }: QuoteBuilderModalProps) {
  const customers = db.getCustomers();
  const products = db.getProducts();
  const vatRates = db.getVatRates();
  const company = db.getCompanySettings();

  const [customerId, setCustomerId] = useState(customers[0]?.id || '');
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('Prices are valid for 30 days. Standard UAE VAT applies.');
  const [terms, setTerms] = useState(company.terms_and_conditions || '');
  const [discountType, setDiscountType] = useState<DiscountType>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [error, setError] = useState('');

  // Editable Line Items
  const [items, setItems] = useState<
    Array<{
      id: string;
      product_id?: string;
      description: string;
      quantity: number;
      unit_price: number;
      unit: string;
      discount_type: DiscountType;
      discount_value: number;
      vat_rate_id: string;
    }>
  >([
    {
      id: `item-${Date.now()}`,
      product_id: products[0]?.id,
      description: products[0]?.name || 'Professional Consulting Services',
      quantity: 1,
      unit_price: products[0]?.selling_price || 500,
      unit: products[0]?.unit || 'Hour',
      discount_type: 'PERCENTAGE',
      discount_value: 0,
      vat_rate_id: vatRates[0]?.id || '',
    },
  ]);

  // Load initial if editing
  useEffect(() => {
    if (initialQuoteId) {
      const q = db.getQuoteById(initialQuoteId);
      if (q) {
        setCustomerId(q.customer_id);
        setQuoteDate(q.quote_date);
        setExpiryDate(q.expiry_date);
        setNotes(q.notes || '');
        setTerms(q.terms || '');
        setDiscountType(q.discount_type || 'PERCENTAGE');
        setDiscountValue(q.discount_value || 0);
        setItems(
          q.items.map((it) => ({
            id: it.id,
            product_id: it.product_id,
            description: it.description,
            quantity: it.quantity,
            unit_price: it.unit_price,
            unit: it.unit,
            discount_type: it.discount_type || 'PERCENTAGE',
            discount_value: it.discount_value,
            vat_rate_id: it.vat_rate_id,
          }))
        );
      }
    }
  }, [initialQuoteId]);

  // Compute live calculations
  const calculationInputs = items.map((it) => {
    const vat = vatRates.find((v) => v.id === it.vat_rate_id);
    return {
      quantity: it.quantity,
      unit_price: it.unit_price,
      discount_type: it.discount_type,
      discount_value: it.discount_value,
      vat_rate_percentage: vat?.rate_percentage || 5.0,
      vat_treatment: vat?.treatment || 'STANDARD_RATED',
    };
  });

  const totals = VatCalculator.calculateDocument(calculationInputs, discountType, discountValue);

  const handleProductSelect = (index: number, prodId: string) => {
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;

    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        product_id: prod.id,
        description: prod.name,
        unit: prod.unit,
        unit_price: prod.selling_price,
        vat_rate_id: prod.vat_rate_id,
      };
      return copy;
    });
  };

  const handleAddItem = () => {
    const defaultProd = products[0];
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length}`,
        product_id: defaultProd?.id,
        description: defaultProd?.name || 'New Item',
        quantity: 1,
        unit_price: defaultProd?.selling_price || 0,
        unit: defaultProd?.unit || 'Unit',
        discount_type: 'PERCENTAGE',
        discount_value: 0,
        vat_rate_id: defaultProd?.vat_rate_id || vatRates[0]?.id || '',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setError('Quotation must contain at least one line item.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = (saveStatus: 'DRAFT' | 'SENT') => {
    if (!customerId) {
      setError('Please select a customer.');
      return;
    }
    if (items.length === 0) {
      setError('At least one item is required.');
      return;
    }

    try {
      const lineItems: LineItem[] = items.map((it, idx) => {
        const lineCalc = totals.items[idx];
        const vat = vatRates.find((v) => v.id === it.vat_rate_id);
        return {
          id: it.id,
          product_id: it.product_id,
          item_order: idx + 1,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          unit: it.unit,
          discount_type: it.discount_type,
          discount_value: it.discount_value,
          discount_amount: lineCalc.discount_amount,
          subtotal_net: lineCalc.subtotal_net,
          vat_rate_id: it.vat_rate_id,
          vat_rate_percentage: vat?.rate_percentage || 5.0,
          vat_amount: lineCalc.vat_amount,
          total_gross: lineCalc.total_gross,
        };
      });

      const quote = db.saveQuote({
        id: initialQuoteId || undefined,
        customer_id: customerId,
        quote_date: quoteDate,
        expiry_date: expiryDate,
        status: saveStatus,
        subtotal_net: totals.subtotal_net,
        discount_type: discountType,
        discount_value: discountValue,
        discount_amount: totals.invoice_discount_amount,
        vat_total: totals.vat_total,
        grand_total: totals.grand_total,
        notes: notes,
        terms: terms,
        items: lineItems,
      });

      onSuccess(quote.id);
      onOpenChange(false);
    } catch (e: any) {
      setError(e.message || 'Failed to save quotation');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={initialQuoteId ? 'Edit Quotation' : 'Create Quotation Proposal'}
      description="Prepare proposal with line discounts, UAE 5% VAT calculations, and validity dates."
      maxWidth="4xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-500">
            Grand Total: <strong className="text-slate-900 font-mono text-sm">{formatCurrency(totals.grand_total)}</strong>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => handleSave('DRAFT')}>
              Save as Draft
            </Button>
            <Button variant="emerald" onClick={() => handleSave('SENT')}>
              Send Quotation
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* Customer & Dates Header */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div>
            <Select
              label="Recipient Customer / Prospect *"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              options={customers.map((c) => ({
                label: `${c.company_name || c.contact_person} (${c.relation_type})`,
                value: c.id,
              }))}
            />
          </div>
          <div>
            <Input
              label="Quotation Date"
              type="date"
              value={quoteDate}
              onChange={(e) => setQuoteDate(e.target.value)}
            />
          </div>
          <div>
            <Input
              label="Valid Until (Expiry Date)"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>
        </div>

        {/* Line Items Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Quotation Line Items
            </span>
            <Button variant="outline" size="sm" onClick={handleAddItem} className="h-7 text-xs">
              <Plus className="h-3 w-3 mr-1" /> Add Line Item
            </Button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2 w-48">Product / Service</th>
                  <th className="p-2">Description</th>
                  <th className="p-2 w-20">Qty</th>
                  <th className="p-2 w-28">Price (AED)</th>
                  <th className="p-2 w-24">Disc (%)</th>
                  <th className="p-2 w-32">VAT Rate</th>
                  <th className="p-2 w-28 text-right">Net + VAT</th>
                  <th className="p-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {items.map((item, idx) => {
                  const lineCalc = totals.items[idx];
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="p-2 align-top">
                        <select
                          className="w-full p-1.5 text-xs rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                          value={item.product_id}
                          onChange={(e) => handleProductSelect(idx, e.target.value)}
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 align-top">
                        <input
                          type="text"
                          className="w-full p-1.5 text-xs rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                          value={item.description}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItems((prev) => {
                              const copy = [...prev];
                              copy[idx].description = val;
                              return copy;
                            });
                          }}
                        />
                      </td>
                      <td className="p-2 align-top">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          className="w-full p-1.5 text-xs rounded border border-slate-200 text-center font-mono focus:outline-none focus:ring-1 focus:ring-emerald-600"
                          value={item.quantity}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setItems((prev) => {
                              const copy = [...prev];
                              copy[idx].quantity = val;
                              return copy;
                            });
                          }}
                        />
                      </td>
                      <td className="p-2 align-top">
                        <input
                          type="number"
                          step="0.01"
                          className="w-full p-1.5 text-xs rounded border border-slate-200 text-right font-mono focus:outline-none focus:ring-1 focus:ring-emerald-600"
                          value={item.unit_price}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setItems((prev) => {
                              const copy = [...prev];
                              copy[idx].unit_price = val;
                              return copy;
                            });
                          }}
                        />
                      </td>
                      <td className="p-2 align-top">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="w-full p-1.5 text-xs rounded border border-slate-200 text-center font-mono focus:outline-none focus:ring-1 focus:ring-emerald-600"
                          value={item.discount_value}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setItems((prev) => {
                              const copy = [...prev];
                              copy[idx].discount_value = val;
                              return copy;
                            });
                          }}
                        />
                      </td>
                      <td className="p-2 align-top">
                        <select
                          className="w-full p-1.5 text-xs rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                          value={item.vat_rate_id}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItems((prev) => {
                              const copy = [...prev];
                              copy[idx].vat_rate_id = val;
                              return copy;
                            });
                          }}
                        >
                          {vatRates.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 align-top text-right font-mono">
                        <div className="font-semibold text-slate-900">
                          {formatCurrency(lineCalc.total_gross)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Net: {lineCalc.subtotal_net.toFixed(2)} | VAT: {lineCalc.vat_amount.toFixed(2)}
                        </div>
                      </td>
                      <td className="p-2 align-top text-center">
                        <button
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Global Discount & Totals Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-3">
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <span className="text-xs font-semibold text-slate-800">Invoice-Level Discount</span>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                  options={[
                    { label: 'Percentage (%)', value: 'PERCENTAGE' },
                    { label: 'Fixed Amount (AED)', value: 'FIXED_AMOUNT' },
                  ]}
                />
                <Input
                  type="number"
                  placeholder="Discount value"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                />
              </div>
            </div>
            <Textarea
              label="Quotation Notes & Payment Schedule"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* UAE Financial Breakdown Summary */}
          <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Subtotal (Net of Line Discounts):</span>
              <span className="font-mono">{formatCurrency(totals.subtotal_net)}</span>
            </div>
            {totals.invoice_discount_amount > 0 && (
              <div className="flex items-center justify-between text-xs text-amber-300">
                <span>Document Discount:</span>
                <span className="font-mono">-{formatCurrency(totals.invoice_discount_amount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>UAE VAT (Standard 5%):</span>
              </span>
              <span className="font-mono">{formatCurrency(totals.vat_total)}</span>
            </div>
            <div className="border-t border-slate-800 pt-2 flex items-center justify-between">
              <span className="text-sm font-bold text-white">Grand Total Payable (AED):</span>
              <span className="text-lg font-bold text-emerald-400 font-mono">
                {formatCurrency(totals.grand_total)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
