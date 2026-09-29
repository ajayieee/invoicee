'use client';

import React, { useState } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  Users,
  ShieldCheck,
  TrendingUp,
  FileSpreadsheet,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/Badge';
import { db } from '@/lib/db/repository';
import { formatCurrency, formatDate } from '@/lib/utils';

export function ReportsView() {
  const [activeReport, setActiveReport] = useState<string>('SALES_REPORT');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(db.getCustomers()[0]?.id || '');
  const customers = db.getCustomers();

  const reportData = db.getReportData(activeReport, { customerId: selectedCustomerId });

  // Export to CSV function
  const handleExportCSV = () => {
    let rows: any[] = [];
    let filename = `${activeReport.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`;

    if (Array.isArray(reportData)) {
      rows = reportData;
    } else if (activeReport === 'CUSTOMER_STATEMENT') {
      rows = (reportData as any).ledger;
    } else if (activeReport === 'RECEIVABLES_AGEING') {
      rows = (reportData as any).rows;
    } else if (activeReport === 'VAT_SUMMARY') {
      rows = [reportData];
    }

    if (rows.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((h) => {
            const val = row[h];
            return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const reportOptions = [
    { value: 'SALES_REPORT', label: '1. Sales Summary Report' },
    { value: 'INVOICE_REPORT', label: '2. Invoice Register Report' },
    { value: 'PAYMENT_REPORT', label: '3. Payment Collection Register' },
    { value: 'OUTSTANDING_INVOICES', label: '4. Outstanding Receivables Report' },
    { value: 'OVERDUE_INVOICES', label: '5. Overdue Invoices Aging Report' },
    { value: 'CUSTOMER_STATEMENT', label: '6. Customer Statement of Account' },
    { value: 'VAT_SUMMARY', label: '7. UAE VAT 201 Return Summary' },
    { value: 'CREDIT_NOTE_REPORT', label: '8. Credit Notes Register' },
    { value: 'REVENUE_BY_CUSTOMER', label: '9. Revenue by Customer' },
    { value: 'REVENUE_BY_PRODUCT', label: '10. Revenue by Product & Service' },
    { value: 'RECEIVABLES_AGEING', label: '11. Receivables Ageing (0-30, 31-60, 61-90, 90+)' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Financial & Sales Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-ready reporting suite with CSV export and UAE VAT 201 tax summaries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="text-slate-700">
            <FileSpreadsheet className="h-4 w-4 mr-1 text-emerald-600" /> Export CSV / Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="text-slate-700">
            <Printer className="h-4 w-4 mr-1" /> Print Report
          </Button>
        </div>
      </div>

      {/* Report Switcher & Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="sm:col-span-2">
          <Select
            label="Select Financial Report"
            value={activeReport}
            onChange={(e) => setActiveReport(e.target.value)}
            options={reportOptions}
          />
        </div>

        {activeReport === 'CUSTOMER_STATEMENT' && (
          <div>
            <Select
              label="Select Customer Statement"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              options={customers.map((c) => ({
                label: c.company_name || c.contact_person,
                value: c.id,
              }))}
            />
          </div>
        )}
      </div>

      {/* Report Render Switch */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          {/* Report 1: Sales Summary */}
          {activeReport === 'SALES_REPORT' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h2 className="font-bold text-sm text-slate-900">Sales Summary Register</h2>
                <span className="text-xs text-slate-500">Excludes cancelled invoices</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Invoice #</th>
                      <th className="p-2.5">Customer</th>
                      <th className="p-2.5 text-right">Net Subtotal</th>
                      <th className="p-2.5 text-right">Discount</th>
                      <th className="p-2.5 text-right">Output VAT</th>
                      <th className="p-2.5 text-right">Grand Total</th>
                      <th className="p-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(reportData as any[]).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 text-slate-500">{formatDate(row.date)}</td>
                        <td className="p-2.5 font-mono font-semibold">{row.number}</td>
                        <td className="p-2.5 font-medium text-slate-900">{row.customer}</td>
                        <td className="p-2.5 text-right font-mono">{formatCurrency(row.net_subtotal)}</td>
                        <td className="p-2.5 text-right font-mono text-slate-500">
                          {row.discount > 0 ? formatCurrency(row.discount) : '-'}
                        </td>
                        <td className="p-2.5 text-right font-mono">{formatCurrency(row.vat_amount)}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(row.grand_total)}
                        </td>
                        <td className="p-2.5 text-right">
                          <StatusBadge status={row.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Report 6: Customer Statement */}
          {activeReport === 'CUSTOMER_STATEMENT' && (
            <div className="space-y-4">
              {(() => {
                const stmt = reportData as any;
                return (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
                      <div>
                        <div className="text-xs text-slate-500 uppercase font-semibold">Statement of Account</div>
                        <h2 className="text-base font-bold text-slate-900">
                          {stmt.customer?.company_name || stmt.customer?.contact_person}
                        </h2>
                        <div className="text-xs text-slate-500">
                          TRN: {stmt.customer?.trn || 'Unregistered'} • Emirate: {stmt.customer?.billing_emirate || 'Dubai'}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-900 text-white text-right">
                        <div className="text-[10px] uppercase tracking-wider text-slate-400">Current Outstanding Balance</div>
                        <div className="text-lg font-bold font-mono text-rose-400">{formatCurrency(stmt.currentBalance)}</div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">Date</th>
                            <th className="p-2.5">Transaction Type</th>
                            <th className="p-2.5">Document Ref</th>
                            <th className="p-2.5 text-right">Billed (Debit)</th>
                            <th className="p-2.5 text-right">Paid / Credited (Credit)</th>
                            <th className="p-2.5 text-right">Running Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {stmt.ledger.map((row: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-2.5 text-slate-500">{formatDate(row.date)}</td>
                              <td className="p-2.5 font-medium text-slate-800">{row.type}</td>
                              <td className="p-2.5 font-mono font-semibold">{row.reference}</td>
                              <td className="p-2.5 text-right font-mono">
                                {row.debit > 0 ? formatCurrency(row.debit) : '-'}
                              </td>
                              <td className="p-2.5 text-right font-mono text-emerald-700 font-semibold">
                                {row.credit > 0 ? formatCurrency(row.credit) : '-'}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                                {formatCurrency(row.running_balance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Report 7: UAE VAT 201 Return Summary */}
          {activeReport === 'VAT_SUMMARY' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <div>
                    <h2 className="font-bold text-sm text-slate-900">UAE VAT Return 201 Summary</h2>
                    <p className="text-xs text-slate-500">Output VAT on Standard, Zero-Rated, and Exempt Supplies</p>
                  </div>
                </div>
              </div>

              {(() => {
                const vat = reportData as any;
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="text-xs font-semibold text-slate-700">Box 1a: Standard Rated Supplies (5%)</div>
                        <div className="flex justify-between text-xs text-slate-600">
                          <span>Taxable Sales Amount:</span>
                          <span className="font-mono font-bold">{formatCurrency(vat.standardRatedSales)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-emerald-700 font-semibold">
                          <span>Output VAT Collected (5%):</span>
                          <span className="font-mono">{formatCurrency(vat.standardVatCollected)}</span>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="text-xs font-semibold text-slate-700">Box 1c: Zero-Rated Supplies (0%)</div>
                        <div className="flex justify-between text-xs text-slate-600">
                          <span>Taxable Sales Amount:</span>
                          <span className="font-mono font-bold">{formatCurrency(vat.zeroRatedSales)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>VAT Amount:</span>
                          <span className="font-mono">AED 0.00</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 rounded-xl bg-slate-900 text-white space-y-3 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                          Net UAE VAT Liability
                        </div>
                        <div className="text-2xl font-bold font-mono text-emerald-400">
                          {formatCurrency(vat.netVatPayable)}
                        </div>
                        <p className="text-xs text-slate-300">
                          Total Output Tax payable to the Federal Tax Authority (FTA) for the current period.
                        </p>
                      </div>
                      <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                        Based on UAE Executive Regulations of Federal Decree-Law No. (8) on Value Added Tax.
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Report 11: Receivables Ageing */}
          {activeReport === 'RECEIVABLES_AGEING' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h2 className="font-bold text-sm text-slate-900">Receivables Ageing Schedule</h2>
                <span className="text-xs text-slate-500">Aging from Invoice Due Date</span>
              </div>

              {(() => {
                const aging = reportData as any;
                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[10px] font-semibold text-slate-500 uppercase">0 - 30 Days</div>
                        <div className="text-base font-bold font-mono text-slate-900 mt-1">
                          {formatCurrency(aging.buckets.current)}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200">
                        <div className="text-[10px] font-semibold text-amber-700 uppercase">31 - 60 Days</div>
                        <div className="text-base font-bold font-mono text-amber-800 mt-1">
                          {formatCurrency(aging.buckets.days31_60)}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-orange-50/50 border border-orange-200">
                        <div className="text-[10px] font-semibold text-orange-700 uppercase">61 - 90 Days</div>
                        <div className="text-base font-bold font-mono text-orange-800 mt-1">
                          {formatCurrency(aging.buckets.days61_90)}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-200">
                        <div className="text-[10px] font-semibold text-rose-700 uppercase">90+ Days (High Risk)</div>
                        <div className="text-base font-bold font-mono text-rose-700 mt-1">
                          {formatCurrency(aging.buckets.days90_plus)}
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto pt-2">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">Customer</th>
                            <th className="p-2.5">Invoice #</th>
                            <th className="p-2.5">Due Date</th>
                            <th className="p-2.5 text-right">0-30 Days</th>
                            <th className="p-2.5 text-right">31-60 Days</th>
                            <th className="p-2.5 text-right">61-90 Days</th>
                            <th className="p-2.5 text-right">90+ Days</th>
                            <th className="p-2.5 text-right">Total Due</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {aging.rows.map((row: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-2.5 font-medium text-slate-900">{row.customer}</td>
                              <td className="p-2.5 font-mono font-semibold">{row.invoice_number}</td>
                              <td className="p-2.5 text-slate-500">{formatDate(row.due_date)}</td>
                              <td className="p-2.5 text-right font-mono text-slate-600">
                                {row.current > 0 ? formatCurrency(row.current) : '-'}
                              </td>
                              <td className="p-2.5 text-right font-mono text-amber-700">
                                {row.days31_60 > 0 ? formatCurrency(row.days31_60) : '-'}
                              </td>
                              <td className="p-2.5 text-right font-mono text-orange-700">
                                {row.days61_90 > 0 ? formatCurrency(row.days61_90) : '-'}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-rose-600">
                                {row.days90_plus > 0 ? formatCurrency(row.days90_plus) : '-'}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                                {formatCurrency(row.total_due)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Generic Tabular Render for Other Reports (Invoice report, Payment report, Overdue, etc.) */}
          {activeReport !== 'SALES_REPORT' &&
            activeReport !== 'CUSTOMER_STATEMENT' &&
            activeReport !== 'VAT_SUMMARY' &&
            activeReport !== 'RECEIVABLES_AGEING' &&
            Array.isArray(reportData) && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h2 className="font-bold text-sm text-slate-900">
                    {reportOptions.find((o) => o.value === activeReport)?.label}
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        {reportData.length > 0 &&
                          Object.keys(reportData[0]).map((k) => (
                            <th key={k} className="p-2.5 capitalize">
                              {k.replace(/_/g, ' ')}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportData.map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          {Object.keys(row).map((k) => (
                            <td key={k} className="p-2.5">
                              {typeof row[k] === 'number'
                                ? formatCurrency(row[k])
                                : k === 'status'
                                ? <StatusBadge status={row[k]} />
                                : row[k] || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
