'use client';

import React, { useState } from 'react';
import { Sidebar, NavTab } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { DashboardView } from '@/components/dashboard/DashboardView';
import { CustomersView } from '@/components/customers/CustomersView';
import { ProductsView } from '@/components/products/ProductsView';
import { QuotesView } from '@/components/quotes/QuotesView';
import { InvoicesView } from '@/components/invoices/InvoicesView';
import { PaymentsView } from '@/components/payments/PaymentsView';
import { CreditNotesView } from '@/components/credit-notes/CreditNotesView';
import { ReportsView } from '@/components/reports/ReportsView';
import { SettingsView } from '@/components/settings/SettingsView';
import { PrintableDocument } from '@/components/documents/PrintableDocument';
import { QuoteBuilderModal } from '@/components/quotes/QuoteBuilderModal';
import { InvoiceBuilderModal } from '@/components/invoices/InvoiceBuilderModal';
import { RecordPaymentModal } from '@/components/payments/RecordPaymentModal';
import { CreateCreditNoteModal } from '@/components/credit-notes/CreateCreditNoteModal';
import { Invoice } from '@/types/database';
import { db } from '@/lib/db/repository';
import { AuthProvider, useAuth } from '@/context/AuthContext';

function AppHomeContent() {
  const { organization, refreshOrgContext } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [printDoc, setPrintDoc] = useState<{
    docType: 'QUOTE' | 'INVOICE' | 'CREDIT_NOTE' | 'STATEMENT';
    docId: string;
  } | null>(null);

  // Global Quick Action Modals
  const [newQuoteOpen, setNewQuoteOpen] = useState(false);
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [paymentTargetInvoice, setPaymentTargetInvoice] = useState<Invoice | null>(null);
  const [creditNoteOpen, setCreditNoteOpen] = useState(false);
  const [creditNoteTargetInvoice, setCreditNoteTargetInvoice] = useState<Invoice | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => {
    setRefreshKey((prev) => prev + 1);
    refreshOrgContext();
  };

  const handleQuickAction = (action: 'NEW_QUOTE' | 'NEW_INVOICE' | 'RECORD_PAYMENT' | 'NEW_CUSTOMER') => {
    switch (action) {
      case 'NEW_QUOTE':
        setNewQuoteOpen(true);
        break;
      case 'NEW_INVOICE':
        setNewInvoiceOpen(true);
        break;
      case 'RECORD_PAYMENT':
        setPaymentTargetInvoice(null);
        setRecordPaymentOpen(true);
        break;
      case 'NEW_CUSTOMER':
        setCurrentTab('customers');
        break;
    }
  };

  const handleResetData = () => {
    db.resetToDefault();
    triggerRefresh();
    alert('Database successfully reset to initial UAE seed state.');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased">
      <div className="flex flex-1">
        {/* Persistent Collapsible Sidebar (Hidden during print) */}
        {!printDoc && (
          <div className="no-print">
            <Sidebar
              currentTab={currentTab}
              onSelectTab={(tab) => {
                setPrintDoc(null);
                setCurrentTab(tab);
              }}
              orgName={organization.name}
              trn={organization.trn}
              emirate={organization.emirate}
            />
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* TopBar (Hidden during print) */}
          {!printDoc && (
            <div className="no-print">
              <TopBar
                onQuickAction={handleQuickAction}
                onSearchChange={setSearchQuery}
                searchQuery={searchQuery}
                onResetData={handleResetData}
              />
            </div>
          )}

          {/* Body Canvas */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto" key={refreshKey}>
            {printDoc ? (
              <PrintableDocument
                docType={printDoc.docType}
                docId={printDoc.docId}
                onBack={() => setPrintDoc(null)}
              />
            ) : (
              <>
                {currentTab === 'dashboard' && (
                  <DashboardView
                    onNavigate={(tab) => setCurrentTab(tab)}
                    onQuickAction={handleQuickAction}
                  />
                )}

                {currentTab === 'customers' && (
                  <CustomersView
                    onSelectCustomerForInvoice={(c) => {
                      setNewInvoiceOpen(true);
                    }}
                    onSelectCustomerForQuote={(c) => {
                      setNewQuoteOpen(true);
                    }}
                  />
                )}

                {currentTab === 'products' && <ProductsView />}

                {currentTab === 'quotes' && (
                  <QuotesView
                    onViewInvoice={(invoiceId) => {
                      setCurrentTab('invoices');
                    }}
                    onPrintDocument={(docType, docId) => {
                      setPrintDoc({ docType, docId });
                    }}
                  />
                )}

                {currentTab === 'invoices' && (
                  <InvoicesView
                    onRecordPayment={(inv) => {
                      setPaymentTargetInvoice(inv);
                      setRecordPaymentOpen(true);
                    }}
                    onCreateCreditNote={(inv) => {
                      setCreditNoteTargetInvoice(inv);
                      setCreditNoteOpen(true);
                    }}
                    onPrintInvoice={(invId) => {
                      setPrintDoc({ docType: 'INVOICE', docId: invId });
                    }}
                  />
                )}

                {currentTab === 'payments' && (
                  <PaymentsView
                    onViewInvoice={(invoiceId) => {
                      setCurrentTab('invoices');
                    }}
                  />
                )}

                {currentTab === 'credit-notes' && (
                  <CreditNotesView
                    onViewInvoice={(invoiceId) => {
                      setCurrentTab('invoices');
                    }}
                    onPrintDocument={(docType, docId) => {
                      setPrintDoc({ docType, docId });
                    }}
                  />
                )}

                {currentTab === 'reports' && <ReportsView />}

                {currentTab === 'settings' && <SettingsView />}
              </>
            )}
          </main>
        </div>
      </div>

      {/* Global Modals for Quick Actions */}
      <QuoteBuilderModal
        open={newQuoteOpen}
        onOpenChange={setNewQuoteOpen}
        onSuccess={() => {
          triggerRefresh();
          setCurrentTab('quotes');
        }}
      />

      <InvoiceBuilderModal
        open={newInvoiceOpen}
        onOpenChange={setNewInvoiceOpen}
        onSuccess={() => {
          triggerRefresh();
          setCurrentTab('invoices');
        }}
      />

      <RecordPaymentModal
        open={recordPaymentOpen}
        onOpenChange={setRecordPaymentOpen}
        targetInvoice={paymentTargetInvoice}
        onSuccess={() => {
          triggerRefresh();
          setCurrentTab('payments');
        }}
      />

      <CreateCreditNoteModal
        open={creditNoteOpen}
        onOpenChange={setCreditNoteOpen}
        targetInvoice={creditNoteTargetInvoice}
        onSuccess={() => {
          triggerRefresh();
          setCurrentTab('credit-notes');
        }}
      />
    </div>
  );
}

export default function AppHome() {
  return (
    <AuthProvider>
      <AppHomeContent />
    </AuthProvider>
  );
}
