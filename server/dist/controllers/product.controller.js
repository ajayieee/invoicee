"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeProduct = serializeProduct;
exports.getProducts = getProducts;
exports.getProductById = getProductById;
exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
exports.deleteProduct = deleteProduct;
const Product_js_1 = require("../models/Product.js");
function serializeProduct(doc) {
    if (!doc)
        return null;
    const obj = doc.toObject ? doc.toObject() : doc;
    const id = obj._id ? obj._id.toString() : obj.id;
    const cost = Number(obj.costPrice ?? obj.cost_price ?? 0);
    const selling = Number(obj.sellingPrice ?? obj.selling_price ?? obj.unitPrice ?? 0);
    return {
        ...obj,
        id,
        _id: id,
        organization_id: obj.organizationId || obj.organization_id || 'org_pixelflames_001',
        organizationId: obj.organizationId || obj.organization_id || 'org_pixelflames_001',
        name: obj.name,
        sku: obj.sku,
        description: obj.description || '',
        category_id: obj.categoryId ?? obj.category_id,
        categoryId: obj.categoryId ?? obj.category_id,
        category_name: obj.categoryName ?? obj.category_name,
        categoryName: obj.categoryName ?? obj.category_name,
        unit: obj.unit || 'Unit',
        cost_price: cost,
        costPrice: cost,
        selling_price: selling,
        sellingPrice: selling,
        unitPrice: selling,
        vat_rate_id: obj.vatRateId ?? obj.vat_rate_id ?? 'vat-001',
        vatRateId: obj.vatRateId ?? obj.vat_rate_id ?? 'vat-001',
        vat_rate_percentage: obj.vatRatePercentage ?? obj.vat_rate_percentage ?? 5.0,
        vatRatePercentage: obj.vatRatePercentage ?? obj.vat_rate_percentage ?? 5.0,
        vat_treatment: obj.vatTreatment || obj.vat_treatment || 'STANDARD_RATED',
        vatTreatment: obj.vatTreatment || obj.vat_treatment || 'STANDARD_RATED',
        is_active: obj.isActive ?? obj.is_active ?? true,
        isActive: obj.isActive ?? obj.is_active ?? true,
        created_at: obj.createdAt ? new Date(obj.createdAt).toISOString() : new Date().toISOString(),
        updated_at: obj.updatedAt ? new Date(obj.updatedAt).toISOString() : new Date().toISOString(),
    };
}
async function getProducts(req, res) {
    try {
        const { search, categoryId, vatTreatment, page = '1', pageSize = '100' } = req.query;
        const query = {};
        if (categoryId && categoryId !== 'ALL') {
            query.$or = [{ categoryId }, { category_id: categoryId }];
        }
        if (vatTreatment && vatTreatment !== 'ALL') {
            query.vatTreatment = vatTreatment;
        }
        if (search && typeof search === 'string' && search.trim()) {
            const q = search.trim();
            query.$or = [
                { name: { $regex: q, $options: 'i' } },
                { sku: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } },
            ];
        }
        const p = Math.max(1, parseInt(page, 10));
        const limit = Math.max(1, Math.min(1000, parseInt(pageSize, 10)));
        const skip = (p - 1) * limit;
        const [rawItems, totalItems] = await Promise.all([
            Product_js_1.Product.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
            Product_js_1.Product.countDocuments(query),
        ]);
        const items = rawItems.map(serializeProduct);
        const totalPages = Math.ceil(totalItems / limit) || 1;
        res.json({
            success: true,
            items,
            totalItems,
            currentPage: p,
            pageSize: limit,
            totalPages,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
async function getProductById(req, res) {
    try {
        const { id } = req.params;
        const doc = await Product_js_1.Product.findById(id);
        if (!doc) {
            res.status(404).json({ success: false, error: 'Product not found.' });
            return;
        }
        res.json({ success: true, data: serializeProduct(doc) });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
async function createProduct(req, res) {
    try {
        const body = req.body;
        const cost = Number(body.costPrice ?? body.cost_price ?? 0);
        const selling = Number(body.sellingPrice ?? body.selling_price ?? body.unitPrice ?? 0);
        const doc = await Product_js_1.Product.create({
            organizationId: body.organizationId || body.organization_id || 'org_pixelflames_001',
            name: body.name?.trim(),
            sku: body.sku?.trim() || undefined,
            description: body.description?.trim() || undefined,
            categoryId: body.categoryId || body.category_id || undefined,
            categoryName: body.categoryName || body.category_name || undefined,
            unit: body.unit?.trim() || 'Unit',
            unitPrice: selling,
            costPrice: cost,
            sellingPrice: selling,
            vatRateId: body.vatRateId || body.vat_rate_id || 'vat-001',
            vatRatePercentage: Number(body.vatRatePercentage ?? body.vat_rate_percentage ?? 5.0),
            vatTreatment: body.vatTreatment || body.vat_treatment || 'STANDARD_RATED',
            isActive: body.isActive !== undefined ? body.isActive : (body.is_active !== undefined ? body.is_active : true),
        });
        res.status(201).json({ success: true, data: serializeProduct(doc) });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
async function updateProduct(req, res) {
    try {
        const { id } = req.params;
        const body = req.body;
        const updateData = {};
        if (body.name !== undefined)
            updateData.name = body.name.trim();
        if (body.sku !== undefined)
            updateData.sku = body.sku.trim();
        if (body.description !== undefined)
            updateData.description = body.description.trim();
        if (body.categoryId !== undefined || body.category_id !== undefined) {
            updateData.categoryId = body.categoryId || body.category_id;
        }
        if (body.categoryName !== undefined || body.category_name !== undefined) {
            updateData.categoryName = body.categoryName || body.category_name;
        }
        if (body.unit !== undefined)
            updateData.unit = body.unit.trim();
        if (body.costPrice !== undefined || body.cost_price !== undefined) {
            updateData.costPrice = Number(body.costPrice ?? body.cost_price);
        }
        if (body.sellingPrice !== undefined || body.selling_price !== undefined || body.unitPrice !== undefined) {
            const sp = Number(body.sellingPrice ?? body.selling_price ?? body.unitPrice);
            updateData.sellingPrice = sp;
            updateData.unitPrice = sp;
        }
        if (body.vatRateId !== undefined || body.vat_rate_id !== undefined) {
            updateData.vatRateId = body.vatRateId || body.vat_rate_id;
        }
        if (body.vatRatePercentage !== undefined || body.vat_rate_percentage !== undefined) {
            updateData.vatRatePercentage = Number(body.vatRatePercentage ?? body.vat_rate_percentage);
        }
        if (body.vatTreatment !== undefined || body.vat_treatment !== undefined) {
            updateData.vatTreatment = body.vatTreatment || body.vat_treatment;
        }
        if (body.isActive !== undefined)
            updateData.isActive = body.isActive;
        if (body.is_active !== undefined)
            updateData.isActive = body.is_active;
        const doc = await Product_js_1.Product.findByIdAndUpdate(id, updateData, { new: true });
        if (!doc) {
            res.status(404).json({ success: false, error: 'Product not found.' });
            return;
        }
        res.json({ success: true, data: serializeProduct(doc) });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
async function deleteProduct(req, res) {
    try {
        const { id } = req.params;
        const doc = await Product_js_1.Product.findByIdAndDelete(id);
        if (!doc) {
            res.status(404).json({ success: false, error: 'Product not found.' });
            return;
        }
        res.json({ success: true, message: 'Product deleted successfully.' });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
