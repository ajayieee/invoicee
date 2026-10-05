'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ShieldCheck, UserPlus, Package, Calculator, Sparkles } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { FormError, AlertBanner } from '@/components/ui/FormError';
import { Customer, Product, VatRate, DiscountType } from '@/types/database';
import { quoteService, QuoteLineItemInput } from '@/services/quote.service';
import { customerService } from '@/services/customer.service';
import { productService } from '@/services/product.service';
import { companyService } from '@/services/company.service';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface QuoteBuilderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (quoteId: string) => void;
  initialQuoteId?: string;
  defaultCustomerId?: string;
}

export function QuoteBuilderModal({
  open,
  onOpenChange,
  onSuccess,
  initialQuoteId,
  defaultCustomerId,
}: QuoteBuilderModalProps) {
  const { user } = useAuth();
  const customers = customerService.getCustomers({ pageSize: 100 }).items;
  const products = productService.getProducts({ pageSize: 100 }).items;
  const vatRates = productService.getVatRates();
  const company = companyService.getSettings();

  const [customerId, setCustomerId] = useState('');
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('Prices are valid for 30 days. Standard UAE 5% VAT applies.');
  const [terms, setTerms] = useState(company.terms_and_conditions || '');
  const [discountType, setDiscountType] = useState<DiscountType>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Editable Line Items
  const [items, setItems] = useState<QuoteLineItemInput[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Quick Customer Creation modal within builder
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPerson, setQuickCustPerson] = useState('');
  const [quickCustTrn, setQuickCustTrn] = useState('');
  const [quickCustEmirate, setQuickCustEmirate] = useState('DUBAI');

  // Initialize or reset form
  useEffect(() => {
    if (open) {
      setFieldErrors({});
      setFormError(null);

      if (initialQuoteId) {
        const q = quoteService.getQuoteById(initialQuoteId);
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
          return;
        }
      }

      // Default new quote state
      setCustomerId(defaultCustomerId || customers[0]?.id || '');
      setQuoteDate(new Date().toISOString().split('T')[0]);
      setExpiryDate(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
      setNotes('Prices are valid for 30 days from issue date. Subject to standard UAE VAT law.');
      setTerms(company.terms_and_conditions || '');
      setDiscountType('PERCENTAGE');
      setDiscountValue(0);

      // Seed with initial item from catalog if available
      const defaultProd = products[0];
      setItems([
        {
          id: `item-${Date.now()}-0`,
          product_id: defaultProd?.id,
          description: defaultProd ? defaultProd.name : 'Professional Consulting Services',
          quantity: 1,
          unit_price: defaultProd ? defaultProd.selling_price : 500,
          unit: defaultProd ? defaultProd.unit : 'Unit',
          discount_type: 'PERCENTAGE',
          discount_value: 0,
          vat_rate_id: defaultProd ? defaultProd.vat_rate_id : vatRates[0]?.id || '',
        },
      ]);
    }
  }, [open, initialQuoteId, defaultCustomerId]);

  // Compute live totals with VatCalculator
  const calcResult = quoteService.calculateQuoteTotals(items, discountType, discountValue);

  // Line item manipulation
  const handleAddCustomItem = () => {
    const defaultVat = vatRates.find((v) => v.is_default) || vatRates[0];
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length}`,
        description: '',
        quantity: 1,
        unit: 'Unit',
        unit_price: 0,
        discount_type: 'PERCENTAGE',
        discount_value: 0,
        vat_rate_id: defaultVat?.id || '',
      },
    ]);
  };

  const handleAddProductItem = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length}`,
        product_id: prod.id,
        description: prod.name,
        quantity: 1,
        unit: prod.unit,
        unit_price: prod.selling_price,
        discount_type: 'PERCENTAGE',
        discount_value: 0,
        vat_rate_id: prod.vat_rate_id,
      },
    ]);
  };

  const handleUpdateItem = (index: number, updates: Partial<QuoteLineItemInput>) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      alert('A quotation must contain at least one line item.');
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveQuote = (saveAsStatus: 'DRAFT' | 'SENT') => {
    setFieldErrors({});
    setFormError(null);

    const payload = {
      customer_id: customerId,
      quote_date: quoteDate,
      expiry_date: expiryDate,
      items,
      discount_type: discountType,
      discount_value: Number(discountValue) || 0,
      notes,
      terms,
      currency: 'AED',
    };

    const res = initialQuoteId
      ? quoteService.updateQuote(initialQuoteId, payload, user.name)
      : quoteService.createQuote(payload, user.name);

    if (!res.success) {
      if (res.errors) {
        setFieldErrors(res.errors);
      }
      setFormError(res.error || 'Please resolve the highlighted validation errors.');
      return;
    }

    const savedQuote = res.data!;

    // If user clicked Save & Send
    if (saveAsStatus === 'SENT') {
      quoteService.updateQuoteStatus(savedQuote.id, 'SENT', user.name);
    }

    onOpenChange(false);
    onSuccess(savedQuote.id);
  };

  const handleQuickCreateCustomer = async () => {
    if (!quickCustPerson.trim()) {
      alert('Contact person name is required.');
      return;
    }

    const res = await customerService.createCustomer(
      {
        customer_type: quickCustName.trim() ? 'COMPANY' : 'INDIVIDUAL',
        relation_type: 'PROSPECT',
        company_name: quickCustName.trim() || undefined,
        contact_person: quickCustPerson.trim(),
        trn: quickCustTrn.trim() || undefined,
        billing_emirate: quickCustEmirate as any,
        payment_terms_days: 30,
      },
      user.name
    );

    if (!res.success) {
      alert(res.error || 'Failed to create customer.');
      return;
    }

    if (res.data) {
      setCustomerId(res.data.id);
      setQuickCustomerOpen(false);
      setQuickCustName('');
      setQuickCustPerson('');
      setQuickCustTrn('');
    }
  };

  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title={initialQuoteId ? 'Edit Quotation Draft' : 'Create Commercial Quotation'}
        description="Prepare sequential cost proposals, apply line-level discounts, and compute UAE 5% VAT."
        maxWidth="5xl"
        footer={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between w-full gap-3 text-xs">
            <div className="text-slate-500 font-mono flex items-center justify-between sm:justify-start gap-2">
              <span>Total ({company.default_currency}):</span>
              <strong className="text-emerald-800 text-sm">{formatCurrency(calcResult.grand_total)}</strong>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="outline" onClick={() => handleSaveQuote('DRAFT')}>
                Save as Draft
              </Button>
              <Button variant="emerald" onClick={() => handleSaveQuote('SENT')} className="font-semibold shadow-xs">
                Save & Mark as Sent
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {formError && <AlertBanner variant="error" message={formError} onClose={() => setFormError(null)} />}

          {/* Customer Selection Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-700">Recipient Customer / Prospect *</label>
                <button
                  type="button"
                  onClick={() => setQuickCustomerOpen(true)}
                  className="text-[11px] text-emerald-700 hover:text-emerald-900 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="h-3 w-3" /> Quick Add Account
                </button>
              </div>

              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 bg-white p-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option value="">-- Select UAE Client or Prospect --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name ? `${c.company_name} (${c.contact_person})` : c.contact_person} • {c.billing_emirate || 'UAE'}
                  </option>
                ))}
              </select>
              <FormError message={fieldErrors.customer_id} />

              {selectedCustomer && (
                <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                  <span>TRN: {selectedCustomer.trn || 'Unregistered'}</span>
                  <span>•</span>
                  <span>Terms: {selectedCustomer.payment_terms_days} Days</span>
                </div>
              )}
            </div>

            {/* Quote Dates */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Input
                  label="Issue Date *"
                  type="date"
                  value={quoteDate}
                  onChange={(e) => setQuoteDate(e.target.value)}
                />
                <FormError message={fieldErrors.quote_date} />
              </div>
              <div>
                <Input
                  label="Valid Until *"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
                <FormError message={fieldErrors.expiry_date} />
              </div>
            </div>
          </div>

          {/* Line Items Section Header & Catalog Quick Add */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
            <div>
              <span className="font-bold text-slate-900 text-xs">Quotation Line Items & Scope</span>
              <span className="text-[11px] text-slate-500 ml-2">({items.length} items configured)</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Quick Select from Products */}
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddProductItem(e.target.value);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
              >
                <option value="" disabled>
                  + Add from Product Catalog...
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({formatCurrency(p.selling_price)})
                  </option>
                ))}
              </select>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCustomItem}
                className="h-7 text-xs flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Custom Row
              </Button>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[780px]">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="p-2.5 min-w-[200px]">Description *</th>
                  <th className="p-2.5 w-20">Unit</th>
                  <th className="p-2.5 w-20">Qty *</th>
                  <th className="p-2.5 w-24">Price (AED) *</th>
                  <th className="p-2.5 w-28">Discount</th>
                  <th className="p-2.5 w-28">UAE VAT</th>
                  <th className="p-2.5 w-24 text-right">Total Gross</th>
                  <th className="p-2.5 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => {
                  const lineCalc = calcResult.items[idx];

                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/50">
                      {/* Description */}
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleUpdateItem(idx, { description: e.target.value })}
                          placeholder="Scope of work or item name..."
                          className="w-full text-xs p-1.5 rounded border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                        />
                        <FormError message={fieldErrors[`item_${idx}_description`]} />
                      </td>

                      {/* Unit */}
                      <td className="p-2">
                        <select
                          value={item.unit}
                          onChange={(e) => handleUpdateItem(idx, { unit: e.target.value })}
                          className="w-full text-xs p-1.5 rounded border border-slate-200 bg-white"
                        >
                          <option value="Unit">Unit</option>
                          <option value="Hour">Hour</option>
                          <option value="Day">Day</option>
                          <option value="Month">Month</option>
                          <option value="License">License</option>
                          <option value="Contract">Contract</option>
                        </select>
                      </td>

                      {/* Quantity */}
                      <td className="p-2">
                        <input
                          type="number"
                          min="0.01"
                          step="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(idx, { quantity: Number(e.target.value) })}
                          className="w-full text-xs p-1.5 rounded border border-slate-200 text-right font-mono"
                        />
                        <FormError message={fieldErrors[`item_${idx}_quantity`]} />
                      </td>

                      {/* Unit Price */}
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={item.unit_price}
                          onChange={(e) => handleUpdateItem(idx, { unit_price: Number(e.target.value) })}
                          className="w-full text-xs p-1.5 rounded border border-slate-200 text-right font-mono"
                        />
                        <FormError message={fieldErrors[`item_${idx}_unit_price`]} />
                      </td>

                      {/* Line Discount */}
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={item.discount_value || 0}
                            onChange={(e) => handleUpdateItem(idx, { discount_value: Number(e.target.value) })}
                            className="w-14 text-xs p-1.5 rounded border border-slate-200 text-right font-mono"
                          />
                          <select
                            value={item.discount_type || 'PERCENTAGE'}
                            onChange={(e) =>
                              handleUpdateItem(idx, { discount_type: e.target.value as DiscountType })
                            }
                            className="text-[10px] p-1.5 rounded border border-slate-200 bg-white"
                          >
                            <option value="PERCENTAGE">%</option>
                            <option value="FIXED_AMOUNT">AED</option>
                          </select>
                        </div>
                      </td>

                      {/* VAT Rate */}
                      <td className="p-2">
                        <select
                          value={item.vat_rate_id}
                          onChange={(e) => handleUpdateItem(idx, { vat_rate_id: e.target.value })}
                          className="w-full text-xs p-1.5 rounded border border-slate-200 bg-white"
                        >
                          {vatRates.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.rate_percentage}%)
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Calculated Row Total */}
                      <td className="p-2 text-right font-mono font-semibold text-slate-900">
                        {lineCalc ? formatCurrency(lineCalc.total_gross) : '—'}
                      </td>

                      {/* Delete Row Button */}
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <FormError message={fieldErrors.items} />

          {/* Document Discount & Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Left: Document Discount & Notes */}
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-semibold text-slate-800 text-[11px] flex items-center gap-1.5">
                  <Calculator className="h-3.5 w-3.5 text-slate-500" />
                  <span>Quotation-Level Discount</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="w-24 text-xs p-1.5 rounded border border-slate-200 bg-white text-right font-mono"
                  />
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                    className="text-xs p-1.5 rounded border border-slate-200 bg-white"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED_AMOUNT">Fixed Amount (AED)</option>
                  </select>
                </div>
                <FormError message={fieldErrors.discount_value} />
              </div>

              <Textarea
                label="Proposal Notes & Scope Details"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
              <Textarea
                label="Commercial Terms & Conditions"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={2}
              />
            </div>

            {/* Right: Accurate UAE Tax Breakdown Summary Box */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 h-fit">
              <div className="font-bold text-slate-900 pb-2 border-b border-slate-200 flex items-center justify-between">
                <span>Quotation Financial Summary</span>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  UAE FTA Tax Ready
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal (Net):</span>
                <span className="font-mono font-medium">{formatCurrency(calcResult.subtotal_net)}</span>
              </div>

              {calcResult.invoice_discount_amount > 0 && (
                <div className="flex items-center justify-between text-rose-600">
                  <span>Document Discount:</span>
                  <span className="font-mono">-{formatCurrency(calcResult.invoice_discount_amount)}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-slate-700 font-medium pt-1 border-t border-slate-200">
                <span>Taxable Amount:</span>
                <span className="font-mono">
                  {formatCurrency(calcResult.subtotal_net - calcResult.invoice_discount_amount)}
                </span>
              </div>

              <div className="flex items-center justify-between text-teal-800">
                <span>VAT (5%):</span>
                <span className="font-mono font-semibold">{formatCurrency(calcResult.vat_total)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-900 font-bold text-sm pt-2 border-t-2 border-slate-200">
                <span>Grand Total (AED):</span>
                <span className="font-mono text-emerald-800">{formatCurrency(calcResult.grand_total)}</span>
              </div>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Quick Customer Creation Modal */}
      {quickCustomerOpen && (
        <Dialog
          open={quickCustomerOpen}
          onOpenChange={setQuickCustomerOpen}
          title="Quick Register Client / Prospect"
          description="Add a recipient account on the fly without leaving the quotation builder."
          maxWidth="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setQuickCustomerOpen(false)}>
                Cancel
              </Button>
              <Button variant="emerald" onClick={handleQuickCreateCustomer}>
                Register Account
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-xs">
            <Input
              label="Legal Company Name (Optional for individual)"
              placeholder="e.g. Al Habtoor Engineering LLC"
              value={quickCustName}
              onChange={(e) => setQuickCustName(e.target.value)}
            />
            <Input
              label="Primary Contact Person *"
              placeholder="e.g. Mansour Al-Fahim"
              value={quickCustPerson}
              onChange={(e) => setQuickCustPerson(e.target.value)}
            />
            <Input
              label="UAE 15-Digit TRN"
              placeholder="100xxxxxxxx0003"
              value={quickCustTrn}
              onChange={(e) => setQuickCustTrn(e.target.value)}
            />
            <Select
              label="Registered Emirate"
              value={quickCustEmirate}
              onChange={(e) => setQuickCustEmirate(e.target.value)}
              options={[
                { label: 'Dubai', value: 'DUBAI' },
                { label: 'Abu Dhabi', value: 'ABU_DHABI' },
                { label: 'Sharjah', value: 'SHARJAH' },
                { label: 'Ajman', value: 'AJMAN' },
                { label: 'Ras Al Khaimah', value: 'RAS_AL_KHAIMAH' },
                { label: 'Fujairah', value: 'FUJAIRAH' },
                { label: 'Umm Al Quwain', value: 'UMM_AL_QUWAIN' },
              ]}
            />
          </div>
        </Dialog>
      )}
    </>
  );
}
