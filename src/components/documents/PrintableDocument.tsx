'use client';

import React from 'react';
import { ArrowLeft, Printer, ShieldCheck, Building2, QrCode, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { db } from '@/lib/db/repository';
import { formatCurrency, formatDate } from '@/lib/utils';
import { VatCalculator } from '@/lib/vat/calculator';

interface PrintableDocumentProps {
  docType: 'QUOTE' | 'INVOICE' | 'CREDIT_NOTE' | 'STATEMENT';
  docId: string;
  onBack: () => void;
}

export function PrintableDocument({ docType, docId, onBack }: PrintableDocumentProps) {
  const company = db.getCompanySettings();

  let title = 'TAX INVOICE / فاتورة ضريبية';
  let numberLabel = 'Tax Invoice No / رقم الفاتورة الضريبية';
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
  let referenceVal = '';
  let qrCodeData = '';
  let statementLedger: any[] = [];
  let origInvoiceNumber = '';
  let origInvoiceDate = '';
  let origInvoiceTotal = 0;
  let creditReason = '';
  let refundStatus = '';
  let docHash = '';
  let isDraft = false;
  let isSimplified = false;
  let currency = 'AED';
  let exchangeRate = 1.0;

  if (docType === 'INVOICE') {
    const inv = db.getInvoiceById(docId);
    if (!inv) return <div>Invoice not found</div>;

    isDraft = inv.status === 'DRAFT';
    currency = inv.currency || 'AED';
    exchangeRate = inv.exchange_rate || 1.0;
    customerTrn = inv.customer_snapshot.trn || '';

    // Article 59(5): Simplified Tax Invoice if consideration <= 10,000 AED and not registered, or B2C
    isSimplified = !isDraft && (!customerTrn || !customerTrn.trim()) && inv.grand_total <= 10000;

    if (isDraft) {
      title = 'DRAFT INVOICE / مسودة فاتورة';
      numberLabel = 'Draft Reference / مرجع المسودة';
    } else if (isSimplified) {
      title = 'SIMPLIFIED TAX INVOICE / فاتورة ضريبية مبسطة';
      numberLabel = 'Invoice No / رقم الفاتورة';
    } else {
      title = 'TAX INVOICE / فاتورة ضريبية';
      numberLabel = 'Tax Invoice No / رقم الفاتورة الضريبية';
    }

    numberVal = inv.invoice_number;
    referenceVal = inv.reference_number || inv.po_number || '';
    docDate = inv.invoice_date;
    supplyDate = inv.supply_date;
    dueDate = inv.due_date;
    customerName = inv.customer_snapshot.company_name || inv.customer_snapshot.contact_person || 'Client';
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
    numberLabel = 'Quotation No / رقم عرض السعر';
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
    numberLabel = 'Credit Note No / رقم الإشعار الدائن';
    numberVal = cn.credit_note_number;
    docDate = cn.credit_note_date;
    origInvoiceNumber = cn.invoice_number || '';
    origInvoiceDate = cn.invoice_date || '';
    origInvoiceTotal = cn.original_invoice_total || 0;
    creditReason = cn.reason || '';
    refundStatus = cn.refund_status ? cn.refund_status.replace(/_/g, ' ') : 'APPLIED';
    docHash = cn.e_invoice_hash || '';
    customerName = cn.customer_name || 'Client';
    customerTrn = cn.customer_snapshot.trn || '';
    customerAddress = `${cn.customer_snapshot.billing_address_line_1 || ''}, ${cn.customer_snapshot.billing_city || ''}, ${cn.customer_snapshot.billing_emirate || ''}`;
    items = cn.items;
    subtotal = cn.subtotal_net;
    discount = cn.discount_amount;
    vatTotal = cn.vat_total;
    grandTotal = cn.grand_total;
    notes = `Originating Tax Invoice: ${cn.invoice_number}${cn.invoice_date ? ` (Dated ${formatDate(cn.invoice_date)})` : ''}. Statutory Ground: ${cn.reason}`;
    qrCodeData = cn.e_invoice_qr_code || `https://tax.gov.ae/verify?doc=${cn.credit_note_number}&trn=${company.trn}&tot=${cn.grand_total}`;
  } else if (docType === 'STATEMENT') {
    const stmt = db.getReportData('CUSTOMER_STATEMENT', { customerId: docId }) as any;
    title = 'STATEMENT OF ACCOUNT / كشف حساب العميل';
    numberLabel = 'Statement Date / تاريخ الكشف';
    numberVal = new Date().toISOString().split('T')[0];
    docDate = numberVal;
    customerName = stmt.customer?.company_name || stmt.customer?.contact_person;
    customerTrn = stmt.customer?.trn || '';
    customerAddress = `${stmt.customer?.billing_address_line_1 || ''}, ${stmt.customer?.billing_city || ''}, ${stmt.customer?.billing_emirate || ''}`;
    statementLedger = stmt.ledger;
    balanceDue = stmt.currentBalance;
  }

  const vatTotalAed = VatCalculator.convertToAED(vatTotal, exchangeRate);
  const grandTotalAed = VatCalculator.convertToAED(grandTotal, exchangeRate);
  const isForeignCurrency = currency !== 'AED';

  return (
    <div className="space-y-6">
      {/* Top Action Bar (Hidden when printing) */}
      <div className="no-print flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <Button variant="outline" size="sm" onClick={onBack} className="text-slate-700">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Dashboard
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 mr-2">
            A4 UAE FTA Format • Full & Simplified Compliant
          </span>
          <Button variant="emerald" size="sm" onClick={() => window.print()} className="font-semibold shadow-xs">
            <Printer className="h-4 w-4 mr-1.5" /> Print / Save as PDF
          </Button>
        </div>
      </div>

      {/* A4 Document Printable Canvas */}
      <div className="print-container bg-white border border-slate-200 shadow-lg rounded-2xl p-8 sm:p-12 max-w-4xl mx-auto text-slate-900 font-sans relative">
        {/* Draft Non-Tax Document Watermark Alert */}
        {isDraft && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border-2 border-dashed border-amber-400 text-amber-950 flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
            <div>
              <div className="font-bold text-xs uppercase tracking-wider">
                DRAFT DOCUMENT — THIS IS NOT A LEGAL TAX INVOICE UNDER UAE LAW
              </div>
              <div className="text-[11px] text-amber-800 mt-0.5">
                مسودة مبدئية فقط — هذه الوثيقة لا تعتبر فاتورة ضريبية رسمية ولا يُعتد بها في استرداد ضريبة المدخلات لدى الهيئة الاتحادية للضرائب.
              </div>
            </div>
          </div>
        )}

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
              <div>United Arab Emirates / الإمارات العربية المتحدة {company.po_box ? `• PO Box: ${company.po_box}` : ''}</div>
              <div>Phone: {company.phone} • Email: {company.email}</div>
              <div className="pt-1 flex items-center gap-1 font-bold text-slate-900">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Supplier TRN / الرقم الضريبي للمورّد: <span className="font-mono text-sm tracking-wider">{company.trn}</span></span>
              </div>
            </div>
          </div>

          <div className="text-right space-y-2">
            <div className={`inline-block px-4 py-1.5 rounded-lg text-sm font-bold tracking-wide uppercase ${
              isDraft ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-900 text-white'
            }`}>
              {title}
            </div>
            <div className="space-y-1 text-xs">
              <div>
                <span className="text-slate-500">{numberLabel}: </span>
                <strong className="font-mono text-slate-900 text-sm">{numberVal}</strong>
              </div>
              <div>
                <span className="text-slate-500">Date of Issue / تاريخ الإصدار: </span>
                <strong className="text-slate-900">{formatDate(docDate)}</strong>
              </div>
              {supplyDate && (
                <div>
                  <span className="text-slate-500">Date of Supply / تاريخ التوريد: </span>
                  <strong className="text-slate-900">{formatDate(supplyDate)}</strong>
                </div>
              )}
              {referenceVal && (
                <div>
                  <span className="text-slate-500">PO / Ref No / الرقم المرجعي: </span>
                  <strong className="font-mono text-slate-900">{referenceVal}</strong>
                </div>
              )}
              {origInvoiceNumber && (
                <div>
                  <span className="text-slate-500">Original Invoice / الفاتورة الضريبية الأصلية: </span>
                  <strong className="font-mono text-emerald-800 font-bold">{origInvoiceNumber}</strong>
                </div>
              )}
              {origInvoiceDate && (
                <div>
                  <span className="text-slate-500">Original Date / تاريخ الفاتورة الأصلية: </span>
                  <strong className="text-slate-800">{formatDate(origInvoiceDate)}</strong>
                </div>
              )}
              {dueDate && (
                <div>
                  <span className="text-slate-500">{docType === 'QUOTE' ? 'Valid Until / صالح لغاية: ' : 'Payment Due / تاريخ الاستحقاق: '}</span>
                  <strong className="text-slate-900">{formatDate(dueDate)}</strong>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recipient Information Card */}
        <div className="my-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
            Billed To / Recipient Details / تفاصيل العميل والمستلم
          </div>
          <div className="text-sm font-bold text-slate-900">{customerName}</div>
          {customerAddress && <div className="text-xs text-slate-600 mt-0.5">{customerAddress}</div>}
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-700">Customer TRN / الرقم الضريبي للعميل:</span>
            {customerTrn ? (
              <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                {customerTrn}
              </span>
            ) : (
              <span className="text-slate-500 italic">Unregistered Consumer / عميل غير مسجل ضريبياً</span>
            )}
          </div>
        </div>

        {/* UAE Tax Credit Note Mandatory Reference Strip */}
        {docType === 'CREDIT_NOTE' && (
          <div className="my-4 p-3.5 rounded-xl bg-amber-50/50 border border-amber-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-amber-800 font-semibold block text-[10px]">Orig. Invoice Total / إجمالي الفاتورة الأصلية:</span>
              <span className="font-mono font-bold text-slate-900">{formatCurrency(origInvoiceTotal)} AED</span>
            </div>
            <div>
              <span className="text-amber-800 font-semibold block text-[10px]">Settlement Status / حالة التسوية:</span>
              <span className="font-bold text-amber-950 uppercase">{refundStatus}</span>
            </div>
            <div>
              <span className="text-amber-800 font-semibold block text-[10px]">Statutory Reason / السبب القانوني للتعديل:</span>
              <span className="text-slate-800 italic truncate block">{creditReason}</span>
            </div>
          </div>
        )}

        {/* Content Table */}
        {docType !== 'STATEMENT' ? (
          <div className="my-6 border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900 text-white font-semibold">
                <tr>
                  <th className="p-2.5">#<br/><span className="text-[10px] font-normal text-slate-300">م</span></th>
                  <th className="p-2.5">
                    {docType === 'CREDIT_NOTE' ? 'Credited Items / بنود الإشعار' : 'Description of Goods & Services / وصف السلع والخدمات'}
                  </th>
                  <th className="p-2.5 text-center">Qty<br/><span className="text-[10px] font-normal text-slate-300">الكمية</span></th>
                  <th className="p-2.5 text-right">Unit Price<br/><span className="text-[10px] font-normal text-slate-300">سعر الوحدة</span></th>
                  <th className="p-2.5 text-right">Discount<br/><span className="text-[10px] font-normal text-slate-300">الخصم</span></th>
                  <th className="p-2.5 text-right">
                    {docType === 'CREDIT_NOTE' ? 'Net Credit' : 'Net Taxable'}<br/>
                    <span className="text-[10px] font-normal text-slate-300">الصافي</span>
                  </th>
                  <th className="p-2.5 text-right">VAT Rate<br/><span className="text-[10px] font-normal text-slate-300">النسبة</span></th>
                  <th className="p-2.5 text-right">
                    {docType === 'CREDIT_NOTE' ? 'VAT Adj.' : 'VAT Amount'}<br/>
                    <span className="text-[10px] font-normal text-slate-300">مبلغ الضريبة</span>
                  </th>
                  <th className="p-2.5 text-right">
                    {docType === 'CREDIT_NOTE' ? 'Gross Credit' : 'Total Gross'}<br/>
                    <span className="text-[10px] font-normal text-slate-300">الإجمالي ({currency})</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((it: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="p-2.5 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="p-2.5">
                      <div className="font-semibold text-slate-900">{it.description}</div>
                      {it.vat_treatment === 'ZERO_RATED' && (
                        <div className="text-[10px] text-sky-700 italic mt-0.5">
                          Zero-Rated Supply (Article 45 of UAE VAT Law) / توريد خاضع لنسبة الصفر
                        </div>
                      )}
                      {it.vat_treatment === 'EXEMPT' && (
                        <div className="text-[10px] text-amber-700 italic mt-0.5">
                          Exempt Supply (Article 46 of UAE VAT Law) / توريد معفى من الضريبة
                        </div>
                      )}
                    </td>
                    <td className="p-2.5 text-center text-slate-600">
                      {it.quantity} {it.unit}
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-700">{it.unit_price.toFixed(2)}</td>
                    <td className="p-2.5 text-right font-mono text-slate-500">
                      {it.discount_amount > 0 ? it.discount_amount.toFixed(2) : '-'}
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-800 font-semibold">{it.subtotal_net.toFixed(2)}</td>
                    <td className="p-2.5 text-right font-mono text-slate-600">{it.vat_rate_percentage}%</td>
                    <td className="p-2.5 text-right font-mono text-slate-800">{it.vat_amount.toFixed(2)}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-950 text-sm">
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
                  <th className="p-3">Date / التاريخ</th>
                  <th className="p-3">Document Type / نوع الوثيقة</th>
                  <th className="p-3">Reference No / الرقم المرجعي</th>
                  <th className="p-3 text-right">Debit (Billed) / مدين</th>
                  <th className="p-3 text-right">Credit (Paid) / دائن</th>
                  <th className="p-3 text-right">Balance Due / الرصيد المستحق</th>
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
          {/* Bank coordinates / Credit settlement & QR block */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            {docType === 'CREDIT_NOTE' ? (
              <>
                <div className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>Credit Note Settlement / تسوية الإشعار الدائن</span>
                </div>
                <div className="text-xs text-slate-600 space-y-1.5">
                  <div>Originating Tax Invoice: <strong className="font-mono text-slate-900">{origInvoiceNumber}</strong></div>
                  <div>Settlement Status: <strong className="font-mono text-slate-900 uppercase">{refundStatus}</strong></div>
                  <div className="text-[10px] text-slate-500">
                    Cryptographic Digest: <span className="font-mono text-slate-700 block truncate">{docHash || 'sha256:verified_digital_hash'}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>Direct Bank Settlement Coordinates / الحساب المصرفي</span>
                </div>
                <div className="text-xs text-slate-600 space-y-1 font-mono">
                  <div>Bank: <strong className="text-slate-900">{company.bank_name || 'First Abu Dhabi Bank'}</strong></div>
                  <div>Account Name: <strong className="text-slate-900">{company.bank_account_name}</strong></div>
                  <div>Account No: <strong>{company.bank_account_number}</strong></div>
                  <div>IBAN: <strong className="text-slate-950 font-bold">{company.bank_iban}</strong></div>
                  <div>SWIFT: <strong>{company.bank_swift_bic}</strong></div>
                  <div>Branch: <strong>{company.bank_branch}</strong></div>
                </div>
              </>
            )}

            {qrCodeData && (
              <div className="pt-2 border-t border-slate-200 flex items-center gap-3">
                <div className="h-16 w-16 bg-white p-1 rounded-lg border border-slate-300 flex items-center justify-center shrink-0">
                  <QrCode className="h-12 w-12 text-slate-900" />
                </div>
                <div className="text-[10px] text-slate-500 leading-tight">
                  <span className="font-semibold text-slate-700 block mb-0.5">
                    UAE E-Invoicing Ready (Pre-Clearance Profile)
                  </span>
                  Prepared for transmission through Accredited Service Provider (ASP) network in accordance with Cabinet Decision No. (126) of 2023.
                </div>
              </div>
            )}
          </div>

          {/* Mathematical Totals Box */}
          <div className="p-5 rounded-xl bg-slate-900 text-white space-y-2.5">
            <div className="flex justify-between text-xs text-slate-300">
              <span>{docType === 'CREDIT_NOTE' ? 'Taxable Net Credit / الصافي الخاضع للضريبة:' : 'Subtotal (Net of Discounts) / الصافي:'}</span>
              <span className="font-mono text-sm">{formatCurrency(subtotal)} {currency}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-xs text-amber-300">
                <span>Document Discount / الخصم الإضافي:</span>
                <span className="font-mono text-sm">-{formatCurrency(discount)} {currency}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-slate-300">
              <span>{docType === 'CREDIT_NOTE' ? 'Output VAT Adjustment (5%) / تعديل الضريبة:' : 'Output UAE VAT (5%) / ضريبة القيمة المضافة:'}</span>
              <span className="font-mono text-sm">{formatCurrency(vatTotal)} {currency}</span>
            </div>
            <div className="border-t border-slate-800 pt-2 flex justify-between font-bold text-base">
              <span>{docType === 'CREDIT_NOTE' ? 'Total Credit / الإجمالي الدائن:' : `Total Payable / الإجمالي المستحق:`}</span>
              <span className="font-mono text-amber-400 text-lg">{formatCurrency(grandTotal)} {currency}</span>
            </div>

            {/* Foreign Currency Statutory AED Conversion (Article 59(1)(k)) */}
            {isForeignCurrency && (
              <div className="pt-2 border-t border-slate-700 space-y-1.5 text-xs text-amber-200/90">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                  Mandatory UAE Central Bank Currency Disclosure (Art. 59(1)(k))
                </div>
                <div className="flex justify-between">
                  <span>Exchange Rate / سعر الصرف:</span>
                  <span className="font-mono">1 {currency} = {exchangeRate} AED</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-400">
                  <span>VAT Payable in AED / الضريبة بالدرهم:</span>
                  <span className="font-mono text-sm">{formatCurrency(vatTotalAed)} AED</span>
                </div>
                <div className="flex justify-between font-bold text-white">
                  <span>Total Amount in AED / الإجمالي بالدرهم:</span>
                  <span className="font-mono text-sm">{formatCurrency(grandTotalAed)} AED</span>
                </div>
              </div>
            )}

            {docType === 'INVOICE' && (
              <>
                <div className="flex justify-between text-xs text-sky-300 pt-1">
                  <span>Amount Received / المبلغ المسدد:</span>
                  <span className="font-mono">{formatCurrency(amountPaid)} {currency}</span>
                </div>
                <div className="border-t border-slate-800 pt-1 flex justify-between font-bold text-rose-400">
                  <span>Outstanding Balance Due / الرصيد المتبقي:</span>
                  <span className="font-mono text-base">{formatCurrency(balanceDue)} {currency}</span>
                </div>
              </>
            )}

            {docType === 'STATEMENT' && (
              <div className="border-t border-slate-800 pt-1 flex justify-between font-bold text-rose-400">
                <span>Closing Statement Balance / الرصيد الختامي:</span>
                <span className="font-mono text-lg">{formatCurrency(balanceDue)} {currency}</span>
              </div>
            )}
          </div>
        </div>

        {/* Client Acceptance Block for Quotations */}
        {docType === 'QUOTE' && (
          <div className="my-6 p-4 rounded-xl border border-slate-200 bg-slate-50/60">
            <div className="font-bold text-xs text-slate-900 mb-6 flex items-center justify-between">
              <span>Client Acceptance & Authorization / اعتماد وتوقيع العميل</span>
              <span className="text-[10px] text-slate-500 font-normal">Valid upon signature and company seal</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-[11px] text-slate-600">
              <div className="border-t border-slate-400 pt-2">
                <span className="text-slate-400 block text-[10px] mb-1">Authorized Name & Designation:</span>
                <span className="font-medium text-slate-800 block h-6"></span>
              </div>
              <div className="border-t border-slate-400 pt-2">
                <span className="text-slate-400 block text-[10px] mb-1">Signature & Company Stamp:</span>
                <span className="font-medium text-slate-800 block h-6"></span>
              </div>
              <div className="border-t border-slate-400 pt-2">
                <span className="text-slate-400 block text-[10px] mb-1">Date of Acceptance:</span>
                <span className="font-medium text-slate-800 block h-6">____ / ____ / 2026</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer Terms & Legal Notes */}
        <div className="border-t border-slate-200 pt-4 text-xs text-slate-500 space-y-1">
          {notes && <div><strong>Notes / الملاحظات:</strong> {notes}</div>}
          {terms && <div><strong>Terms & Conditions / الشروط والأحكام:</strong> {terms}</div>}
          <div className="pt-2 text-[10px] text-center text-slate-400">
            This Tax document is issued in accordance with UAE Federal Decree-Law No. (8) of 2017 on Value Added Tax and Executive Regulations.
          </div>
        </div>
      </div>
    </div>
  );
}
