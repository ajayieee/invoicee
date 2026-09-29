import Decimal from 'decimal.js';
import { DiscountType, VatTreatment } from '@/types/database';

export interface LineItemInput {
  quantity: number;
  unit_price: number;
  discount_type?: DiscountType;
  discount_value?: number;
  vat_rate_percentage: number;
  vat_treatment?: VatTreatment;
}

export interface CalculatedLineItem {
  gross_price: number;
  discount_amount: number;
  subtotal_net: number;
  vat_amount: number;
  total_gross: number;
}

export interface VatSummaryBucket {
  treatment: VatTreatment;
  rate_percentage: number;
  taxable_amount: number;
  vat_amount: number;
}

export interface CalculationResult {
  items: CalculatedLineItem[];
  subtotal_net: number;
  invoice_discount_amount: number;
  vat_total: number;
  grand_total: number;
  vat_breakdown: VatSummaryBucket[];
}

export class VatCalculator {
  /**
   * Calculates a single line item with half-up 2-decimal precision.
   */
  public static calculateLine(item: LineItemInput): CalculatedLineItem {
    const qty = new Decimal(item.quantity || 0);
    const unitPrice = new Decimal(item.unit_price || 0);
    const lineGross = qty.times(unitPrice);

    let discountAmount = new Decimal(0);
    if (item.discount_value && item.discount_value > 0) {
      if (item.discount_type === 'PERCENTAGE') {
        discountAmount = lineGross.times(item.discount_value).dividedBy(100);
      } else {
        discountAmount = new Decimal(item.discount_value);
      }
    }

    // Discount cannot exceed line gross
    if (discountAmount.greaterThan(lineGross)) {
      discountAmount = lineGross;
    }

    const subtotalNet = lineGross.minus(discountAmount);

    let vatAmount = new Decimal(0);
    const rate = new Decimal(item.vat_rate_percentage || 0);
    const treatment = item.vat_treatment || (rate.greaterThan(0) ? 'STANDARD_RATED' : 'ZERO_RATED');

    if (treatment === 'STANDARD_RATED' && rate.greaterThan(0)) {
      vatAmount = subtotalNet.times(rate).dividedBy(100);
    }

    // Half-up commercial rounding to nearest 2 decimals (fils)
    const roundedDiscount = discountAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
    const roundedNet = subtotalNet.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
    const roundedVat = vatAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
    const roundedGross = new Decimal(roundedNet).plus(roundedVat).toNumber();

    return {
      gross_price: lineGross.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      discount_amount: roundedDiscount,
      subtotal_net: roundedNet,
      vat_amount: roundedVat,
      total_gross: roundedGross,
    };
  }

  /**
   * Calculates entire document with optional document-level discount and generates UAE VAT summary buckets.
   */
  public static calculateDocument(
    items: LineItemInput[],
    invoiceDiscountType?: DiscountType,
    invoiceDiscountValue: number = 0
  ): CalculationResult {
    // 1. Calculate raw line amounts before document discount
    const rawLines = items.map((item) => this.calculateLine(item));

    let totalSubtotalNet = new Decimal(0);
    rawLines.forEach((line) => {
      totalSubtotalNet = totalSubtotalNet.plus(line.subtotal_net);
    });

    // 2. Determine document-level discount amount
    let invoiceDiscountAmount = new Decimal(0);
    if (invoiceDiscountValue > 0 && totalSubtotalNet.greaterThan(0)) {
      if (invoiceDiscountType === 'PERCENTAGE') {
        invoiceDiscountAmount = totalSubtotalNet.times(invoiceDiscountValue).dividedBy(100);
      } else {
        invoiceDiscountAmount = new Decimal(invoiceDiscountValue);
      }
    }

    if (invoiceDiscountAmount.greaterThan(totalSubtotalNet)) {
      invoiceDiscountAmount = totalSubtotalNet;
    }

    // 3. Apportion document discount across lines and calculate final VAT & taxable bases
    let totalVat = new Decimal(0);
    const breakdownMap = new Map<string, { treatment: VatTreatment; rate: number; taxable: Decimal; vat: Decimal }>();

    const finalLines: CalculatedLineItem[] = rawLines.map((line, index) => {
      const rawItem = items[index];
      const rate = new Decimal(rawItem.vat_rate_percentage || 0);
      const treatment = rawItem.vat_treatment || (rate.greaterThan(0) ? 'STANDARD_RATED' : 'ZERO_RATED');

      let apportionedDocDiscount = new Decimal(0);
      if (invoiceDiscountAmount.greaterThan(0) && totalSubtotalNet.greaterThan(0)) {
        apportionedDocDiscount = new Decimal(line.subtotal_net)
          .dividedBy(totalSubtotalNet)
          .times(invoiceDiscountAmount);
      }

      const lineTaxableNet = new Decimal(line.subtotal_net).minus(apportionedDocDiscount);

      let lineVat = new Decimal(0);
      if (treatment === 'STANDARD_RATED' && rate.greaterThan(0)) {
        lineVat = lineTaxableNet.times(rate).dividedBy(100);
      }

      totalVat = totalVat.plus(lineVat);

      // Aggregate VAT summary buckets
      const key = `${treatment}_${rate.toNumber()}`;
      if (!breakdownMap.has(key)) {
        breakdownMap.set(key, {
          treatment,
          rate: rate.toNumber(),
          taxable: new Decimal(0),
          vat: new Decimal(0),
        });
      }
      const bucket = breakdownMap.get(key)!;
      bucket.taxable = bucket.taxable.plus(lineTaxableNet);
      bucket.vat = bucket.vat.plus(lineVat);

      const roundedVat = lineVat.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
      const roundedGross = new Decimal(line.subtotal_net)
        .plus(lineVat)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();

      return {
        gross_price: line.gross_price,
        discount_amount: line.discount_amount,
        subtotal_net: line.subtotal_net,
        vat_amount: roundedVat,
        total_gross: roundedGross,
      };
    });

    const roundedInvoiceDiscount = invoiceDiscountAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
    const finalSubtotalNet = totalSubtotalNet.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
    const finalVatTotal = totalVat.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
    const grandTotal = new Decimal(finalSubtotalNet)
      .minus(roundedInvoiceDiscount)
      .plus(finalVatTotal)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();

    const vatBreakdown: VatSummaryBucket[] = Array.from(breakdownMap.values()).map((b) => ({
      treatment: b.treatment,
      rate_percentage: b.rate,
      taxable_amount: b.taxable.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      vat_amount: b.vat.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    }));

    return {
      items: finalLines,
      subtotal_net: finalSubtotalNet,
      invoice_discount_amount: roundedInvoiceDiscount,
      vat_total: finalVatTotal,
      grand_total: Math.max(0, grandTotal),
      vat_breakdown: vatBreakdown,
    };
  }
}
