'use client';

import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Power,
  ShieldCheck,
  Tag,
  DollarSign,
  RotateCcw,
  TrendingUp,
  Percent,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/SkeletonTable';
import { FormError, AlertBanner } from '@/components/ui/FormError';
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal';
import { Product, VatTreatment, ProductCategory, VatRate } from '@/types/database';
import { productService, ProductWithMargin } from '@/services/product.service';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/lib/utils';

export function ProductsView() {
  const { user, permissions } = useAuth();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | 'ALL'>('ALL');
  const [selectedTreatment, setSelectedTreatment] = useState<VatTreatment | 'ALL'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const categories = productService.getCategories();
  const vatRates = productService.getVatRates();

  // Paged Products
  const [pagedData, setPagedData] = useState(() =>
    productService.getProducts({
      search: '',
      categoryId: 'ALL',
      vatTreatment: 'ALL',
      page: 1,
      pageSize: 10,
    })
  );

  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [unit, setUnit] = useState('Unit');
  const [costPrice, setCostPrice] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [vatRateId, setVatRateId] = useState(
    vatRates.find((v) => v.is_default)?.id || vatRates[0]?.id || ''
  );
  const [isActive, setIsActive] = useState(true);

  // Error & Feedback State
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [alertFeedback, setAlertFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Delete Confirmation State
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      await productService.syncProducts();
    } catch (e) {
      console.warn('Product cloud sync failed:', e);
    }
    const result = productService.getProducts({
      search,
      categoryId: selectedCategory,
      vatTreatment: selectedTreatment,
      page: currentPage,
      pageSize,
    });
    setPagedData(result);
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, [search, selectedCategory, selectedTreatment, currentPage, pageSize]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setName('');
    setSku('');
    setDescription('');
    setCategoryId(categories[0]?.id || '');
    setUnit('Unit');
    setCostPrice(0);
    setSellingPrice(0);
    setVatRateId(vatRates.find((v) => v.is_default)?.id || vatRates[0]?.id || '');
    setIsActive(true);
    setFieldErrors({});
    setModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingId(p.id);
    setName(p.name);
    setSku(p.sku || '');
    setDescription(p.description || '');
    setCategoryId(p.category_id || categories[0]?.id || '');
    setUnit(p.unit);
    setCostPrice(p.cost_price);
    setSellingPrice(p.selling_price);
    setVatRateId(p.vat_rate_id);
    setIsActive(p.is_active);
    setFieldErrors({});
    setModalOpen(true);
  };

  const handleSave = () => {
    setFieldErrors({});

    const payload = {
      name: name.trim(),
      sku: sku.trim() || undefined,
      description: description.trim() || undefined,
      category_id: categoryId || undefined,
      unit: unit.trim(),
      cost_price: Number(costPrice) || 0,
      selling_price: Number(sellingPrice) || 0,
      vat_rate_id: vatRateId,
      is_active: isActive,
    };

    const res = editingId
      ? productService.updateProduct(editingId, payload, user.name)
      : productService.createProduct(payload, user.name);

    if (!res.success) {
      if (res.errors) {
        setFieldErrors(res.errors);
      }
      setAlertFeedback({
        type: 'error',
        message: res.error || 'Please correct the highlighted form errors.',
      });
      return;
    }

    setModalOpen(false);
    setAlertFeedback({
      type: 'success',
      message: `Product / Service "${payload.name}" successfully ${editingId ? 'updated' : 'cataloged'}.`,
    });
    setTimeout(() => setAlertFeedback(null), 4000);
    fetchProducts();
  };

  const handleToggleActive = (p: Product) => {
    productService.toggleActive(p.id);
    fetchProducts();
  };

  const handleDeleteClick = (p: Product) => {
    setProductToDelete(p);
  };

  const handleConfirmDelete = () => {
    if (!productToDelete) return;

    setIsDeleting(true);
    try {
      const res = productService.deleteProduct(productToDelete.id, user.name);
      if (!res.success) {
        setAlertFeedback({
          type: 'error',
          message: res.error || 'Failed to delete product.',
        });
        return;
      }

      setAlertFeedback({
        type: 'success',
        message: `Product "${productToDelete.name}" deleted successfully.`,
      });
      setTimeout(() => setAlertFeedback(null), 4000);
      fetchProducts();
      setProductToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const getVatTreatmentBadge = (treatment?: VatTreatment, rate?: number) => {
    switch (treatment) {
      case 'STANDARD_RATED':
        return <Badge variant="success">Standard 5%</Badge>;
      case 'ZERO_RATED':
        return <Badge variant="info">Zero-Rated 0%</Badge>;
      case 'EXEMPT':
        return <Badge variant="warning">Exempt</Badge>;
      case 'OUT_OF_SCOPE':
        return <Badge variant="secondary">Out of Scope</Badge>;
      default:
        return <Badge variant="secondary">{rate ? `${rate}%` : 'Standard'}</Badge>;
    }
  };

  // Real-time Margin Calculations for Form
  const formCost = Number(costPrice) || 0;
  const formSell = Number(sellingPrice) || 0;
  const formProfit = formSell - formCost;
  const formMargin = formSell > 0 ? Math.round(((formSell - formCost) / formSell) * 1000) / 10 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Products & Services Catalog</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your billable items, SKU codes, pricing margins, and UAE FTA VAT tax treatments.
          </p>
        </div>

        {permissions.canManageProducts && (
          <Button variant="emerald" onClick={handleOpenCreate} className="flex items-center gap-1.5 shadow-sm font-semibold">
            <Plus className="h-4 w-4" />
            <span>Add Product or Service</span>
          </Button>
        )}
      </div>

      {alertFeedback && (
        <AlertBanner
          variant={alertFeedback.type}
          message={alertFeedback.message}
          onClose={() => setAlertFeedback(null)}
        />
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-600"
          >
            <option value="ALL">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* VAT Treatment Filter */}
          <select
            value={selectedTreatment}
            onChange={(e) => {
              setSelectedTreatment(e.target.value as VatTreatment | 'ALL');
              setCurrentPage(1);
            }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-600"
          >
            <option value="ALL">All Tax Treatments</option>
            <option value="STANDARD_RATED">Standard Rated 5%</option>
            <option value="ZERO_RATED">Zero-Rated 0%</option>
            <option value="EXEMPT">Exempt</option>
            <option value="OUT_OF_SCOPE">Out of Scope</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, SKU, or category..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>
      </div>

      {/* Catalog Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <SkeletonTable rows={5} columns={7} />
          ) : pagedData.items.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Package}
                title="No Products or Services Found"
                description={
                  search || selectedCategory !== 'ALL' || selectedTreatment !== 'ALL'
                    ? 'No items match your active filters. Try clearing your search keyword.'
                    : 'Create your first billable service or inventory product with UAE VAT rates.'
                }
                action={
                  search || selectedCategory !== 'ALL' || selectedTreatment !== 'ALL'
                    ? {
                        label: 'Clear Filters',
                        onClick: () => {
                          setSearch('');
                          setSelectedCategory('ALL');
                          setSelectedTreatment('ALL');
                        },
                        icon: RotateCcw,
                      }
                    : permissions.canManageProducts
                    ? {
                        label: 'Add Billable Item',
                        onClick: handleOpenCreate,
                        icon: Plus,
                      }
                    : undefined
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[800px]">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
                  <tr>
                    <th className="px-4 py-3">Item Name / SKU</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3 text-right">Cost (AED)</th>
                    <th className="px-4 py-3 text-right">Selling Price (AED)</th>
                    <th className="px-4 py-3 text-right">Gross Margin</th>
                    <th className="px-4 py-3">UAE VAT</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedData.items.map((p) => (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !p.is_active ? 'opacity-50 bg-slate-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          {!p.is_active && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 font-medium">
                              Inactive
                            </span>
                          )}
                        </div>
                        {p.sku && (
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            SKU: {p.sku}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                          {p.category_name || 'Uncategorized'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">{p.unit}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">
                        {p.cost_price > 0 ? formatCurrency(p.cost_price) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                        {formatCurrency(p.selling_price)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p.selling_price > 0 ? (
                          <span
                            className={`font-semibold font-mono text-[11px] ${
                              p.profitMarginPercentage >= 40
                                ? 'text-emerald-700'
                                : p.profitMarginPercentage >= 15
                                ? 'text-sky-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {p.profitMarginPercentage}%
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {getVatTreatmentBadge(p.vat_treatment, p.vat_rate_percentage)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {permissions.canManageProducts ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEdit(p)}
                                className="h-7 text-xs px-2"
                              >
                                <Edit2 className="h-3 w-3 mr-1" /> Edit
                              </Button>
                              <button
                                onClick={() => handleToggleActive(p)}
                                title={p.is_active ? 'Deactivate product' : 'Activate product'}
                                className={`p-1.5 rounded hover:bg-slate-100 cursor-pointer ${
                                  p.is_active ? 'text-slate-500 hover:text-amber-600' : 'text-amber-600'
                                }`}
                              >
                                <Power className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(p)}
                                title="Delete item (safeguarded against invoice deletion)"
                                className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Read-only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <Pagination
            currentPage={pagedData.currentPage}
            totalPages={pagedData.totalPages}
            totalItems={pagedData.totalItems}
            pageSize={pagedData.pageSize}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        </CardContent>
      </Card>

      {/* Product Create / Edit Modal */}
      <Dialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingId ? 'Edit Product / Service' : 'Add Item to Catalog'}
        description="Configure pricing, billing unit, and UAE FTA VAT tax treatment."
        maxWidth="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="emerald" onClick={handleSave}>
              {editingId ? 'Save Changes' : 'Add Item'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Name & SKU */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Input
                label="Product or Service Name *"
                placeholder="e.g. ERP Cloud Implementation"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <FormError message={fieldErrors.name} />
            </div>
            <div>
              <Input
                label="SKU Code"
                placeholder="e.g. SRV-ERP-01"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
              <FormError message={fieldErrors.sku} />
            </div>
          </div>

          {/* Category & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Product Category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={[
                { label: 'Select a category (Optional)', value: '' },
                ...categories.map((c) => ({ label: c.name, value: c.id })),
              ]}
            />
            <div>
              <Select
                label="Unit of Measure *"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                options={[
                  { label: 'Unit / Each', value: 'Unit' },
                  { label: 'Hours (Hrs)', value: 'Hours' },
                  { label: 'Days', value: 'Days' },
                  { label: 'Months', value: 'Months' },
                  { label: 'Licenses', value: 'License' },
                  { label: 'Boxes / Pack', value: 'Box' },
                  { label: 'Kilograms (Kg)', value: 'Kg' },
                  { label: 'Service Contract', value: 'Contract' },
                ]}
              />
              <FormError message={fieldErrors.unit} />
            </div>
          </div>

          {/* Pricing & VAT */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Input
                label="Selling Price (AED) *"
                type="number"
                placeholder="0.00"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(Number(e.target.value))}
              />
              <FormError message={fieldErrors.selling_price} />
            </div>
            <div>
              <Input
                label="Cost Price (AED)"
                type="number"
                placeholder="0.00"
                value={costPrice}
                onChange={(e) => setCostPrice(Number(e.target.value))}
              />
              <FormError message={fieldErrors.cost_price} />
            </div>
            <div>
              <Select
                label="UAE VAT Rate *"
                value={vatRateId}
                onChange={(e) => setVatRateId(e.target.value)}
                options={vatRates.map((v) => ({
                  label: `${v.name} (${v.rate_percentage}%)`,
                  value: v.id,
                }))}
              />
              <FormError message={fieldErrors.vat_rate_id} />
            </div>
          </div>

          {/* Real-time Margin Preview */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <span>Profit Margin Preview:</span>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <span className="text-slate-400">Profit/Unit:</span>{' '}
                <strong className={formProfit >= 0 ? 'text-slate-900' : 'text-rose-600'}>
                  {formatCurrency(formProfit)}
                </strong>
              </div>
              <div className="pl-3 border-l border-slate-200">
                <span className="text-slate-400">Margin:</span>{' '}
                <strong className={formMargin >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                  {formMargin}%
                </strong>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <Textarea
              label="Item Description (Printed on Invoices & Quotes)"
              placeholder="Detailed scope or product specification..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>
      </Dialog>

      {/* Custom Confirmation Delete Modal */}
      <ConfirmDeleteModal
        open={!!productToDelete}
        onOpenChange={(open) => {
          if (!open) setProductToDelete(null);
        }}
        title="Confirm Delete"
        itemType="product or service"
        itemName={productToDelete?.name}
        description="This action cannot be undone. Products referenced in existing invoices or quotations are safeguarded against deletion."
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
