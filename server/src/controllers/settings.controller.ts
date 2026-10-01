import { Request, Response } from 'express';
import { CompanySettings } from '../models/CompanySettings.js';
import { VatRate } from '../models/VatRate.js';
import { PaymentMethod } from '../models/PaymentMethod.js';

export async function getCompanySettings(req: Request, res: Response): Promise<void> {
  try {
    let settings = await CompanySettings.findOne();
    if (!settings) {
      settings = await CompanySettings.create({
        organizationId: 'org_pixelflames_001',
        companyNameEn: 'Pixelflames',
        companyNameAr: '',
        trn: '100000000000003',
        tradeLicenseNumber: 'TL-00000',
        email: 'ajay@pixelflames.com',
        phone: '+971 4 000 0000',
        website: 'https://pixelflames.com',
        addressEn: {
          city: 'Dubai',
          emirate: 'DUBAI',
          country: 'United Arab Emirates',
        },
        currency: 'AED',
        bankAccounts: [],
      });
    }
    res.json({ success: true, data: settings });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateCompanySettings(req: Request, res: Response): Promise<void> {
  try {
    const settings = await CompanySettings.findOneAndUpdate(
      {},
      { ...req.body },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ success: true, data: settings });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getVatRates(req: Request, res: Response): Promise<void> {
  try {
    const rates = await VatRate.find({ isActive: true });
    res.json({ success: true, data: rates });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getPaymentMethods(req: Request, res: Response): Promise<void> {
  try {
    const methods = await PaymentMethod.find({ isActive: true });
    res.json({ success: true, data: methods });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
