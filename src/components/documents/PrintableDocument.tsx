'use client';

import React from 'react';
import { ArrowLeft, Printer, ShieldCheck, Building2, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { db } from '@/lib/db/repository';
import { formatCurrency, formatDate } from '@/lib/utils';

interface PrintableDocumentProps {
  docType: 'QUOTE' | 'INVOICE' | 'CREDIT_NOTE' | 'STATEMENT';
  docId: string;
  onBack: () => void;
}

export function PrintableDocument({ docType, docId, onBack }: PrintableDocumentProps) {
  const company = db.getCompanySettings();

  let title = 'TAX INVOICE / فاتورة ضريبية';
  let numberLabel = 'Tax Invoice #';
  let numberVal = '';
  let docDate = '';
  let supplyDate = '';
  let dueDate = '';
  let customerName = '';
  let customerTrn = '';
  let customerAddress = '';
  let items: any[] = [];
  let subtotal = 0;
  let discount = 0;
  let vatTotal = 0;
  let grandTotal = 0;
  let amountPaid = 0;
  let balanceDue = 0;
  let notes = company.invoice_footer_notes || '';
  let terms = company.terms_and_conditions || '';
  let qrCodeData = '';
  let statementLedger: any[] = [];

  if (docType === 'INVOICE') {
    const inv = db.getInvoiceById(docId);
    if (!inv) return <div>Invoice not found</div>;
    title = 'TAX INVOICE / فاتورة ضريبية';
    numberLabel = 'Tax Invoice No';
    numberVal = inv.invoice_number;
    docDate = inv.invoice_date;
    supplyDate = inv.supply_date;
    dueDate = inv.due_date;
    customerName = inv.customer_snapshot.company_name || inv.customer_snapshot.contact_person || 'Client';
    customerTrn = inv.customer_snapshot.trn || '';
    customerAddress = `${inv.customer_snapshot.billing_address_line_1 || ''}, ${inv.customer_snapshot.billing_city || ''}, ${inv.customer_snapshot.billing_emirate || ''}`;
    items = inv.items;
    subtotal = inv.subtotal_net;
    discount = inv.discount_amount;
    vatTotal = inv.vat_total;
    grandTotal = inv.grand_total;
    amountPaid = inv.amount_paid;
    balanceDue = inv.balance_due;
    notes = inv.notes || company.invoice_footer_notes || '';
    terms = inv.terms || company.terms_and_conditions || '';
    qrCodeData = inv.e_invoice_qr_code || `https://tax.gov.ae/verify?trn=${company.trn}&inv=${inv.invoice_number}&tot=${inv.grand_total}`;
  } else if (docType === 'QUOTE') {
    const q = db.getQuoteById(docId);
    if (!q) return <div>Quotation not found</div>;
    title = 'QUOTATION / عرض أسعار';
    numberLabel = 'Quotation No';
    numberVal = q.quote_number;
    docDate = q.quote_date;
    dueDate = q.expiry_date;
    customerName = q.customer_name || 'Client';
    customerTrn = q.customer_trn || '';
    items = q.items;
    subtotal = q.subtotal_net;
    discount = q.discount_amount;
    vatTotal = q.vat_total;
    grandTotal = q.grand_total;
    notes = q.notes || '';
    terms = q.terms || company.terms_and_conditions || '';
  } else if (docType === 'CREDIT_NOTE') {
    const cn = db.getCreditNoteById(docId);
    if (!cn) return <div>Credit Note not found</div>;
    title = 'TAX CREDIT NOTE / إشعار دائن ضريبي';
    numberLabel = 'Credit Note No';
    numberVal = cn.credit_note_number;
    docDate = cn.credit_note_date;
    customerName = cn.customer_name || 'Client';
    customerTrn = cn.customer_snapshot.trn || '';
    items = cn.items;
    subtotal = cn.subtotal_net;
    discount = cn.discount_amount;
    vatTotal = cn.vat_total;
    grandTotal = cn.grand_total;
    notes = `Original Tax Invoice Ref: ${cn.invoice_number}. Reason: ${cn.reason}`;
  } else if (docType === 'STATEMENT') {
    const stmt = db.getReportData('CUSTOMER_STATEMENT', { customerId: docId }) as any;
    title = 'STATEMENT OF ACCOUNT / كشف حساب العميل';
    numberLabel = 'Statement Date';
    numberVal = new Date().toISOString().split('T')[0];
    docDate = numberVal;
    customerName = stmt.customer?.company_name || stmt.customer?.contact_person;
    customerTrn = stmt.customer?.trn || '';
    customerAddress = `${stmt.customer?.billing_address_line_1 || ''}, ${stmt.customer?.billing_city || ''}, ${stmt.customer?.billing_emirate || ''}`;
    statementLedger = stmt.ledger;
    balanceDue = stmt.currentBalance;
  }

  return (
    <div className="space-y-6">
      {/* Top Action Bar (Hidden when printing) */}
      <div className="no-print flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <Button variant="outline" size="sm" onClick={onBack} className="text-slate-700">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Dashboard
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 mr-2">
            Standard A4 Landscape/Portrait Ready
          </span>
          <Button variant="emerald" size="sm" onClick={() => window.print()} className="font-semibold shadow-xs">
            <Printer className="h-4 w-4 mr-1.5" /> Print / Save as PDF
          </Button>
        </div>
      </div>

      {/* A4 Document Printable Canvas */}
      <div className="print-container bg-white border border-slate-200 shadow-lg rounded-2xl p-8 sm:p-12 max-w-4xl mx-auto text-slate-900 font-sans">
        {/* Header: Company & Title */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
                <Building2 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-950 tracking-tight leading-none">
                  {company.legal_company_name}
                </h1>
                {company.trading_name && (
                  <div className="text-xs text-slate-500 font-medium">{company.trading_name}</div>
                )}
              </div>
            </div>
            <div className="text-xs text-slate-600 space-y-0.5 pt-2">
              <div>{company.address_line_1}, {company.city}, {company.emirate}</div>
              <div>United Arab Emirates {company.po_box ? `• PO Box: ${company.po_box}` : ''}</div>
              <div>Phone: {company.phone} • Email: {company.email}</div>
              <div className="pt-1 flex items-center gap-1 font-bold text-slate-900">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Supplier TRN: <span className="font-mono text-sm tracking-wider">{company.trn}</span></span>
              </div>
            </div>
          </div>

          <div className="text-right space-y-2">
            <div className="inline-block bg-slate-900 text-white px-4 py-1.5 rounded-lg text-sm font-bold tracking-wide uppercase">
              {title}
            </div>
            <div className="space-y-1 text-xs">
              <div>
                <span className="text-slate-500">{numberLabel}: </span>
                <strong className="font-mono text-slate-900 text-sm">{numberVal}</strong>
              </div>
              <div>
                <span className="text-slate-500">Date of Issue: </span>
                <strong className="text-slate-900">{formatDate(docDate)}</strong>
              </div>
              {supplyDate && (
                <div>
                  <span className="text-slate-500">Date of Supply: </span>
                  <strong className="text-slate-900">{formatDate(supplyDate)}</strong>
                </div>
              )}
              {dueDate && (
                <div>
                  <span className="text-slate-500">{docType === 'QUOTE' ? 'Valid Until: ' : 'Payment Due: '}</span>
                  <strong className="text-slate-900">{formatDate(dueDate)}</strong>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recipient Information Card */}
        <div className="my-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
            Billed To / Recipient Details
          </div>
          <div className="text-sm font-bold text-slate-900">{customerName}</div>
          {customerAddress && <div className="text-xs text-slate-600 mt-0.5">{customerAddress}</div>}
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-700">Customer TRN:</span>
            {customerTrn ? (
              <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                {customerTrn}
              </span>
            ) : (
              <span className="text-slate-400 italic">Unregistered / Consumer</span>
            )}
          </div>
        </div>

        {/* Content Table */}
        {docType !== 'STATEMENT' ? (
          <div className="my-6 border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900 text-white font-semibold">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Description of Goods / Services</th>
                  <th className="p-3 text-center">Qty</th>
                  <th className="p-3 text-right">Unit Price</th>
                  <th className="p-3 text-right">Discount</th>
                  <th className="p-3 text-right">Net Subtotal</th>
                  <th className="p-3 text-right">VAT Rate</th>
                  <th className="p-3 text-right">VAT (AED)</th>
                  <th className="p-3 text-right">Total (AED)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((it: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="p-3 font-semibold text-slate-900">{it.description}</td>
                    <td className="p-3 text-center text-slate-600">
                      {it.quantity} {it.unit}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-700">{it.unit_price.toFixed(2)}</td>
                    <td className="p-3 text-right font-mono text-slate-500">
                      {it.discount_amount > 0 ? it.discount_amount.toFixed(2) : '-'}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-800 font-semibold">{it.subtotal_net.toFixed(2)}</td>
                    <td className="p-3 text-right font-mono text-slate-600">{it.vat_rate_percentage}%</td>
                    <td className="p-3 text-right font-mono text-slate-800">{it.vat_amount.toFixed(2)}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-950 text-sm">
                      {it.total_gross.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Statement of Account Ledger Table */
          <div className="my-6 border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900 text-white font-semibold">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Document Type</th>
                  <th className="p-3">Reference No</th>
                  <th className="p-3 text-right">Debit (Billed)</th>
                  <th className="p-3 text-right">Credit (Paid)</th>
                  <th className="p-3 text-right">Balance Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {statementLedger.map((row: any, idx: number) => (
                  <tr key={idx}>
                    <td className="p-3 text-slate-500">{formatDate(row.date)}</td>
                    <td className="p-3 font-medium text-slate-800">{row.type}</td>
                    <td className="p-3 font-mono font-semibold">{row.reference}</td>
                    <td className="p-3 text-right font-mono">{row.debit > 0 ? formatCurrency(row.debit) : '-'}</td>
                    <td className="p-3 text-right font-mono text-emerald-700 font-semibold">
                      {row.credit > 0 ? formatCurrency(row.credit) : '-'}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(row.running_balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals & Bank Coordinates Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-6 pt-2">
          {/* Bank coordinates & QR block */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Direct Bank Settlement Instructions</span>
            </div>
            <div className="text-xs text-slate-600 space-y-1 font-mono">
              <div>Bank: <strong className="text-slate-900">{company.bank_name || 'First Abu Dhabi Bank'}</strong></div>
              <div>Account Name: <strong className="text-slate-900">{company.bank_account_name}</strong></div>
              <div>Account No: <strong>{company.bank_account_number}</strong></div>
              <div>IBAN: <strong className="text-slate-950 font-bold">{company.bank_iban}</strong></div>
              <div>SWIFT: <strong>{company.bank_swift_bic}</strong></div>
              <div>Branch: <strong>{company.bank_branch}</strong></div>
            </div>

            {qrCodeData && (
              <div className="pt-2 border-t border-slate-200 flex items-center gap-3">
                <div className="h-16 w-16 bg-white p-1 rounded-lg border border-slate-300 flex items-center justify-center">
                  <QrCode className="h-12 w-12 text-slate-900" />
                </div>
                <div className="text-[10px] text-slate-500 leading-tight">
                  <span className="font-semibold text-slate-700 block mb-0.5">UAE E-Invoicing Verification QR</span>
                  Scan to verify document hash & TRN registration against FTA tax portal.
                </div>
              </div>
            )}
          </div>

          {/* Mathematical Totals Box */}
          <div className="p-5 rounded-xl bg-slate-900 text-white space-y-2.5">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Subtotal (Net of Discounts):</span>
              <span className="font-mono text-sm">{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-xs text-amber-300">
                <span>Document Discount:</span>
                <span className="font-mono text-sm">-{formatCurrency(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-slate-300">
              <span>Output UAE VAT (5%):</span>
              <span className="font-mono text-sm">{formatCurrency(vatTotal)}</span>
            </div>
            <div className="border-t border-slate-800 pt-2 flex justify-between font-bold text-base">
              <span>Total Payable ({company.default_currency}):</span>
              <span className="font-mono text-emerald-400 text-lg">{formatCurrency(grandTotal)}</span>
            </div>

            {docType === 'INVOICE' && (
              <>
                <div className="flex justify-between text-xs text-sky-300 pt-1">
                  <span>Amount Received:</span>
                  <span className="font-mono">{formatCurrency(amountPaid)}</span>
                </div>
                <div className="border-t border-slate-800 pt-1 flex justify-between font-bold text-rose-400">
                  <span>Outstanding Balance Due:</span>
                  <span className="font-mono text-base">{formatCurrency(balanceDue)}</span>
                </div>
              </>
            )}

            {docType === 'STATEMENT' && (
              <div className="border-t border-slate-800 pt-1 flex justify-between font-bold text-rose-400">
                <span>Closing Statement Balance:</span>
                <span className="font-mono text-lg">{formatCurrency(balanceDue)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Terms & Legal Notes */}
        <div className="border-t border-slate-200 pt-4 text-xs text-slate-500 space-y-1">
          {notes && <div><strong>Notes:</strong> {notes}</div>}
          {terms && <div><strong>Terms:</strong> {terms}</div>}
          <div className="pt-2 text-[10px] text-center text-slate-400">
            This document is generated in accordance with UAE VAT Law (Federal Decree-Law No. (8) of 2017).
          </div>
        </div>
      </div>
    </div>
  );
}
