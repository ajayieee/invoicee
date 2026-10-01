"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerVatCalculator = void 0;
const decimal_js_1 = __importDefault(require("decimal.js"));
decimal_js_1.default.set({ precision: 20, rounding: decimal_js_1.default.ROUND_HALF_UP });
class ServerVatCalculator {
    static calculateLineItem(item) {
        const qty = new decimal_js_1.default(item.quantity || 0);
        const price = new decimal_js_1.default(item.unitPrice || 0);
        const baseAmount = qty.mul(price);
        let lineDiscount = new decimal_js_1.default(0);
        const discVal = new decimal_js_1.default(item.discountValue || 0);
        if (item.discountType === 'PERCENTAGE' && discVal.gt(0)) {
            lineDiscount = baseAmount.mul(discVal).div(100);
        }
        else if (item.discountType === 'FIXED_AMOUNT' && discVal.gt(0)) {
            lineDiscount = decimal_js_1.default.min(discVal, baseAmount);
        }
        const netAmount = decimal_js_1.default.max(0, baseAmount.sub(lineDiscount));
        const vatRate = item.vatTreatment === 'STANDARD_RATED'
            ? new decimal_js_1.default(item.vatRatePercentage ?? 5.0).div(100)
            : new decimal_js_1.default(0);
        const vatAmount = netAmount.mul(vatRate);
        const grossAmount = netAmount.add(vatAmount);
        return {
            quantity: qty.toNumber(),
            unitPrice: price.toDecimalPlaces(2).toNumber(),
            discountType: item.discountType || 'PERCENTAGE',
            discountValue: discVal.toNumber(),
            discountAmount: lineDiscount.toDecimalPlaces(2).toNumber(),
            subtotalNet: netAmount.toDecimalPlaces(2).toNumber(),
            vatRatePercentage: item.vatTreatment === 'STANDARD_RATED' ? (item.vatRatePercentage ?? 5.0) : 0,
            vatTreatment: item.vatTreatment || 'STANDARD_RATED',
            vatAmount: vatAmount.toDecimalPlaces(2).toNumber(),
            totalGross: grossAmount.toDecimalPlaces(2).toNumber(),
        };
    }
    static calculateDocument(items, docDiscountType, docDiscountValue = 0) {
        const calcItems = items.map((it) => this.calculateLineItem(it));
        const totalSubtotalNet = calcItems.reduce((sum, it) => sum.add(new decimal_js_1.default(it.subtotalNet)), new decimal_js_1.default(0));
        let docDiscount = new decimal_js_1.default(0);
        const discVal = new decimal_js_1.default(docDiscountValue || 0);
        if (docDiscountType === 'PERCENTAGE' && discVal.gt(0)) {
            docDiscount = totalSubtotalNet.mul(discVal).div(100);
        }
        else if (docDiscountType === 'FIXED_AMOUNT' && discVal.gt(0)) {
            docDiscount = decimal_js_1.default.min(discVal, totalSubtotalNet);
        }
        const taxableBase = decimal_js_1.default.max(0, totalSubtotalNet.sub(docDiscount));
        const totalVat = calcItems.reduce((sum, it) => sum.add(new decimal_js_1.default(it.vatAmount)), new decimal_js_1.default(0));
        const grandTotal = taxableBase.add(totalVat);
        return {
            subtotalNet: totalSubtotalNet.toDecimalPlaces(2).toNumber(),
            discountAmount: docDiscount.toDecimalPlaces(2).toNumber(),
            taxableSubtotal: taxableBase.toDecimalPlaces(2).toNumber(),
            vatTotal: totalVat.toDecimalPlaces(2).toNumber(),
            grandTotal: grandTotal.toDecimalPlaces(2).toNumber(),
            items: calcItems,
        };
    }
}
exports.ServerVatCalculator = ServerVatCalculator;
