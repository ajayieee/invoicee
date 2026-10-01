import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface CalcLineItemInput {
  quantity: number;
  unitPrice: number;
  discountType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue?: number;
  vatRatePercentage?: number;
  vatTreatment?: string;
}

export interface CalculatedDocumentResult {
  subtotalNet: number;
  discountAmount: number;
  taxableSubtotal: number;
  vatTotal: number;
  grandTotal: number;
  items: Array<{
    quantity: number;
    unitPrice: number;
    discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
    discountValue: number;
    discountAmount: number;
    subtotalNet: number;
    vatRatePercentage: number;
    vatTreatment: string;
    vatAmount: number;
    totalGross: number;
  }>;
}

export class ServerVatCalculator {
  static calculateLineItem(item: CalcLineItemInput) {
    const qty = new Decimal(item.quantity || 0);
    const price = new Decimal(item.unitPrice || 0);
    const baseAmount = qty.mul(price);

    let lineDiscount = new Decimal(0);
    const discVal = new Decimal(item.discountValue || 0);

    if (item.discountType === 'PERCENTAGE' && discVal.gt(0)) {
      lineDiscount = baseAmount.mul(discVal).div(100);
    } else if (item.discountType === 'FIXED_AMOUNT' && discVal.gt(0)) {
      lineDiscount = Decimal.min(discVal, baseAmount);
    }

    const netAmount = Decimal.max(0, baseAmount.sub(lineDiscount));
    const vatRate = item.vatTreatment === 'STANDARD_RATED'
      ? new Decimal(item.vatRatePercentage ?? 5.0).div(100)
      : new Decimal(0);

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

  static calculateDocument(
    items: CalcLineItemInput[],
    docDiscountType?: 'PERCENTAGE' | 'FIXED_AMOUNT',
    docDiscountValue: number = 0
  ): CalculatedDocumentResult {
    const calcItems = items.map((it) => this.calculateLineItem(it));

    const totalSubtotalNet = calcItems.reduce(
      (sum, it) => sum.add(new Decimal(it.subtotalNet)),
      new Decimal(0)
    );

    let docDiscount = new Decimal(0);
    const discVal = new Decimal(docDiscountValue || 0);

    if (docDiscountType === 'PERCENTAGE' && discVal.gt(0)) {
      docDiscount = totalSubtotalNet.mul(discVal).div(100);
    } else if (docDiscountType === 'FIXED_AMOUNT' && discVal.gt(0)) {
      docDiscount = Decimal.min(discVal, totalSubtotalNet);
    }

    const taxableBase = Decimal.max(0, totalSubtotalNet.sub(docDiscount));
    const totalVat = calcItems.reduce(
      (sum, it) => sum.add(new Decimal(it.vatAmount)),
      new Decimal(0)
    );

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
