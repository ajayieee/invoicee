'use client';

import React, { useState, useEffect } from 'react';
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
import { InitialAdminSetupModal } from '@/components/auth/InitialAdminSetupModal';
import { LoginPage } from '@/components/auth/LoginPage';
import { Invoice } from '@/types/database';
import { db } from '@/lib/db/repository';
import { AuthProvider, useAuth } from '@/context/AuthContext';

function AppHomeContent() {
  const { organization, refreshOrgContext } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
  const [setupModalOpen, setSetupModalOpen] = useState(false);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    fetch(`${apiUrl}/auth/setup-status`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.setupRequired) {
          setSetupModalOpen(true);
        }
      })
      .catch(() => {
        // Backend offline or local standalone
      });
  }, []);

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
                setMobileMenuOpen(false);
              }}
              orgName={organization.name}
              trn={organization.trn}
              emirate={organization.emirate}
              mobileOpen={mobileMenuOpen}
              onCloseMobile={() => setMobileMenuOpen(false)}
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
                onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
              />
            </div>
          )}

          {/* Body Canvas */}
          <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto" key={refreshKey}>
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

      <InitialAdminSetupModal
        open={setupModalOpen}
        onOpenChange={setSetupModalOpen}
        onSetupSuccess={(user) => {
          triggerRefresh();
        }}
      />
    </div>
  );
}

function AppAuthGate() {
  const { isAuthenticated, isLoading, login } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent shadow-lg shadow-emerald-500/20" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white tracking-wide">Pixelflames</h3>
            <p className="text-xs text-slate-400">Verifying secure session...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={login} />;
  }

  return <AppHomeContent />;
}

export default function AppHome() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent shadow-lg shadow-emerald-500/20" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white tracking-wide">Pixelflames</h3>
            <p className="text-xs text-slate-400">Loading UAE Invoicing & Sales Engine...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <AppAuthGate />
    </AuthProvider>
  );
}
