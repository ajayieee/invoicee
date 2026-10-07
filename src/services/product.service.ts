import { Product, ProductCategory, VatRate, VatTreatment } from '@/types/database';
import { PaginatedResult, ServiceResponse } from '@/types/service';
import { db } from '@/lib/db/repository';
import { ValidationRules } from '@/lib/validation/rules';
import { apiClient } from '@/lib/api/client';

export interface ProductQuery {
  search?: string;
  categoryId?: string | 'ALL';
  vatTreatment?: VatTreatment | 'ALL';
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ProductInput {
  name: string;
  sku?: string;
  description?: string;
  category_id?: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  vat_rate_id: string;
  is_active?: boolean;
}

export interface ProductWithMargin extends Product {
  profitMarginPercentage: number;
  profitPerUnit: number;
}

class ProductService {
  /**
   * Synchronize all products from MongoDB Atlas Express API directly into local store.
   */
  async syncProducts(): Promise<Product[]> {
    try {
      const res = await apiClient.get<{ success: boolean; items: Product[] }>('/products', {
        pageSize: 1000,
      });

      if (res && res.success && Array.isArray(res.items)) {
        res.items.forEach((p) => {
          db.upsertProduct(p);
        });
        return res.items;
      }
    } catch (err) {
      console.warn('[ProductService] Atlas sync failed, using cached store:', err);
    }
    return db.getProducts();
  }

  getCategories(): ProductCategory[] {
    return db.getProductCategories();
  }

  addCategory(name: string, description?: string): ProductCategory {
    return db.addProductCategory({ name, description });
  }

  getVatRates(): VatRate[] {
    return db.getVatRates();
  }

  validateProduct(data: Partial<ProductInput>, currentProductId?: string): Record<string, string> {
    const errors: Record<string, string> = {};

    // Name
    const nameCheck = ValidationRules.required(data.name, 'Product / Service Name');
    if (!nameCheck.isValid && nameCheck.error) {
      errors.name = nameCheck.error;
    }

    // Unit
    const unitCheck = ValidationRules.required(data.unit, 'Unit of Measure');
    if (!unitCheck.isValid && unitCheck.error) {
      errors.unit = unitCheck.error;
    }

    // Selling Price
    if (data.selling_price === undefined || data.selling_price === null) {
      errors.selling_price = 'Selling price is required.';
    } else {
      const spCheck = ValidationRules.positiveNumber(data.selling_price, 'Selling Price', true);
      if (!spCheck.isValid && spCheck.error) {
        errors.selling_price = spCheck.error;
      }
    }

    // Cost Price
    if (data.cost_price !== undefined && data.cost_price !== null) {
      const cpCheck = ValidationRules.positiveNumber(data.cost_price, 'Cost Price', true);
      if (!cpCheck.isValid && cpCheck.error) {
        errors.cost_price = cpCheck.error;
      }
    }

    // SKU Validation & Uniqueness
    if (data.sku && data.sku.trim()) {
      const skuCheck = ValidationRules.sku(data.sku);
      if (!skuCheck.isValid && skuCheck.error) {
        errors.sku = skuCheck.error;
      } else {
        const cleanSku = data.sku.trim().toUpperCase();
        const allProducts = db.getProducts();
        const duplicate = allProducts.find(
          (p) => p.sku && p.sku.toUpperCase() === cleanSku && p.id !== currentProductId
        );
        if (duplicate) {
          errors.sku = `SKU "${data.sku.trim()}" is already assigned to "${duplicate.name}".`;
        }
      }
    }

    // VAT Rate
    if (!data.vat_rate_id) {
      errors.vat_rate_id = 'VAT rate configuration is required.';
    } else {
      const vatRates = db.getVatRates();
      if (!vatRates.some((v) => v.id === data.vat_rate_id)) {
        errors.vat_rate_id = 'Selected VAT rate is invalid.';
      }
    }

    return errors;
  }

  private enrichProductWithMargin(p: Product): ProductWithMargin {
    const cost = Number(p.cost_price) || 0;
    const sell = Number(p.selling_price) || 0;
    const profitPerUnit = Math.round((sell - cost) * 100) / 100;
    const margin = sell > 0 ? Math.round(((sell - cost) / sell) * 1000) / 10 : 0;

    return {
      ...p,
      profitMarginPercentage: margin,
      profitPerUnit,
    };
  }

  getProducts(query: ProductQuery = {}): PaginatedResult<ProductWithMargin> {
    const {
      search = '',
      categoryId = 'ALL',
      vatTreatment = 'ALL',
      isActive,
      page = 1,
      pageSize = 10,
    } = query;

    const all = db.getProducts();

    const filtered = all.filter((p) => {
      if (isActive !== undefined && p.is_active !== isActive) return false;
      if (categoryId !== 'ALL' && p.category_id !== categoryId) return false;
      if (vatTreatment !== 'ALL' && p.vat_treatment !== vatTreatment) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchSku = p.sku && p.sku.toLowerCase().includes(q);
        const matchDesc = p.description && p.description.toLowerCase().includes(q);
        const matchCategory = p.category_name && p.category_name.toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchDesc && !matchCategory) return false;
      }

      return true;
    });

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const pagedItems = filtered.slice(startIndex, startIndex + pageSize);

    const enriched = pagedItems.map((p) => this.enrichProductWithMargin(p));

    return {
      items: enriched,
      totalItems,
      currentPage: safePage,
      totalPages,
      pageSize,
    };
  }

  getProductById(id: string): ProductWithMargin | null {
    const product = db.getProductById(id);
    if (!product) return null;
    return this.enrichProductWithMargin(product);
  }

  async createProduct(data: ProductInput, performedBy = 'Current User'): Promise<ServiceResponse<Product>> {
    const errors = this.validateProduct(data);
    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        errors,
        error: 'Please resolve form validation errors before saving.',
      };
    }

    const vatRates = db.getVatRates();
    const selectedVat = vatRates.find((v) => v.id === data.vat_rate_id);
    const categories = db.getProductCategories();
    const selectedCat = categories.find((c) => c.id === data.category_id);

    const payload = {
      name: data.name.trim(),
      sku: data.sku?.trim() ? data.sku.trim().toUpperCase() : undefined,
      description: data.description?.trim() || undefined,
      categoryId: data.category_id || undefined,
      category_id: data.category_id || undefined,
      categoryName: selectedCat?.name,
      category_name: selectedCat?.name,
      unit: data.unit.trim(),
      costPrice: Number(data.cost_price) || 0,
      cost_price: Number(data.cost_price) || 0,
      sellingPrice: Number(data.selling_price) || 0,
      selling_price: Number(data.selling_price) || 0,
      vatRateId: data.vat_rate_id,
      vat_rate_id: data.vat_rate_id,
      vatRatePercentage: selectedVat?.rate_percentage ?? 5.0,
      vat_rate_percentage: selectedVat?.rate_percentage ?? 5.0,
      vatTreatment: selectedVat?.treatment ?? 'STANDARD_RATED',
      vat_treatment: selectedVat?.treatment ?? 'STANDARD_RATED',
      isActive: data.is_active ?? true,
      is_active: data.is_active ?? true,
    };

    try {
      // 1. Save directly to MongoDB Atlas first
      const cloudRes = await apiClient.post<{ success: boolean; data: Product }>('/products', payload);
      if (cloudRes && cloudRes.success && cloudRes.data) {
        // 2. Synchronize to local DB with confirmed MongoDB ID
        const saved = db.upsertProduct(cloudRes.data);
        return {
          success: true,
          data: saved,
        };
      }
      throw new Error('Unexpected response from product API');
    } catch (e: any) {
      console.warn('[ProductService] Cloud create failed, saving to local store:', e.message);
      try {
        const localSaved = db.saveProduct({
          name: payload.name,
          sku: payload.sku,
          description: payload.description,
          category_id: payload.category_id,
          category_name: payload.category_name,
          unit: payload.unit,
          cost_price: payload.cost_price,
          selling_price: payload.selling_price,
          vat_rate_id: payload.vat_rate_id,
          vat_rate_percentage: payload.vat_rate_percentage,
          vat_treatment: payload.vat_treatment,
          is_active: payload.is_active,
        });
        return {
          success: true,
          data: localSaved,
        };
      } catch (localErr: any) {
        return {
          success: false,
          error: e.message || localErr.message || 'Failed to create product or service.',
        };
      }
    }
  }

  async updateProduct(
    id: string,
    data: ProductInput,
    performedBy = 'Current User'
  ): Promise<ServiceResponse<Product>> {
    const errors = this.validateProduct(data, id);
    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        errors,
        error: 'Please resolve form validation errors before saving.',
      };
    }

    try {
      const existing = db.getProductById(id);
      if (!existing) {
        return { success: false, error: 'Product not found.' };
      }

      const vatRates = db.getVatRates();
      const selectedVat = vatRates.find((v) => v.id === data.vat_rate_id);
      const categories = db.getProductCategories();
      const selectedCat = categories.find((c) => c.id === data.category_id);

      const payload = {
        name: data.name ? data.name.trim() : existing.name,
        sku: data.sku?.trim() ? data.sku.trim().toUpperCase() : existing.sku,
        description: data.description?.trim() ?? existing.description,
        categoryId: data.category_id ?? existing.category_id,
        category_id: data.category_id ?? existing.category_id,
        categoryName: selectedCat?.name ?? existing.category_name,
        category_name: selectedCat?.name ?? existing.category_name,
        unit: data.unit ? data.unit.trim() : existing.unit,
        costPrice: data.cost_price !== undefined ? Number(data.cost_price) : existing.cost_price,
        cost_price: data.cost_price !== undefined ? Number(data.cost_price) : existing.cost_price,
        sellingPrice: data.selling_price !== undefined ? Number(data.selling_price) : existing.selling_price,
        selling_price: data.selling_price !== undefined ? Number(data.selling_price) : existing.selling_price,
        vatRateId: data.vat_rate_id ?? existing.vat_rate_id,
        vat_rate_id: data.vat_rate_id ?? existing.vat_rate_id,
        vatRatePercentage: selectedVat?.rate_percentage ?? existing.vat_rate_percentage ?? 5.0,
        vat_rate_percentage: selectedVat?.rate_percentage ?? existing.vat_rate_percentage ?? 5.0,
        vatTreatment: selectedVat?.treatment ?? existing.vat_treatment ?? 'STANDARD_RATED',
        vat_treatment: selectedVat?.treatment ?? existing.vat_treatment ?? 'STANDARD_RATED',
        isActive: data.is_active ?? existing.is_active,
        is_active: data.is_active ?? existing.is_active,
      };

      try {
        const cloudRes = await apiClient.put<{ success: boolean; data: Product }>(`/products/${id}`, payload);
        if (cloudRes && cloudRes.success && cloudRes.data) {
          const saved = db.upsertProduct(cloudRes.data);
          return { success: true, data: saved };
        }
      } catch (cloudErr: any) {
        console.warn('[ProductService] Cloud update failed, updating locally:', cloudErr.message);
      }

      const saved = db.saveProduct({
        id,
        ...payload,
      });

      return {
        success: true,
        data: saved,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || 'Failed to update product or service.',
      };
    }
  }

  async deleteProduct(id: string, performedBy = 'Current User'): Promise<ServiceResponse<boolean>> {
    // Audit check if referenced in invoices
    const invoices = db.getInvoices();
    const isUsedInInvoices = invoices.some((inv) =>
      inv.items.some((item) => item.product_id === id)
    );
    if (isUsedInInvoices) {
      return {
        success: false,
        error:
          'Cannot delete product: It is referenced in issued tax invoices. In accordance with UAE accounting integrity rules, historical invoice line items must remain auditable. You can toggle this product to Inactive instead.',
      };
    }

    const quotes = db.getQuotes();
    const isUsedInQuotes = quotes.some((q) => q.items.some((item) => item.product_id === id));
    if (isUsedInQuotes) {
      return {
        success: false,
        error:
          'Cannot delete product: It is referenced in existing quotations. You can deactivate this product instead.',
      };
    }

    try {
      // 1. Delete from MongoDB Atlas cloud first (awaiting completion)
      try {
        await apiClient.delete(`/products/${id}`);
      } catch (cloudErr: any) {
        console.warn('[ProductService] Cloud delete error (or offline):', cloudErr.message);
      }

      // 2. Delete locally from repository store
      db.deleteProduct(id);

      return {
        success: true,
        data: true,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || 'Failed to delete product.',
      };
    }
  }

  toggleActive(id: string): ServiceResponse<Product> {
    const existing = db.getProductById(id);
    if (!existing) {
      return { success: false, error: 'Product not found.' };
    }

    const updated = db.saveProduct({
      ...existing,
      is_active: !existing.is_active,
    });

    apiClient
      .put<{ success: boolean; data: Product }>(`/products/${id}`, {
        isActive: updated.is_active,
      })
      .catch((e) => {
        console.warn('[ProductService] Cloud toggleActive error:', e.message);
      });

    return { success: true, data: updated };
  }
}

export const productService = new ProductService();
