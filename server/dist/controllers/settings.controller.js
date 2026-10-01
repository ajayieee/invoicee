"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompanySettings = getCompanySettings;
exports.updateCompanySettings = updateCompanySettings;
exports.getVatRates = getVatRates;
exports.getPaymentMethods = getPaymentMethods;
const CompanySettings_js_1 = require("../models/CompanySettings.js");
const VatRate_js_1 = require("../models/VatRate.js");
const PaymentMethod_js_1 = require("../models/PaymentMethod.js");
async function getCompanySettings(req, res) {
    try {
        let settings = await CompanySettings_js_1.CompanySettings.findOne();
        if (!settings) {
            settings = await CompanySettings_js_1.CompanySettings.create({
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
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
async function updateCompanySettings(req, res) {
    try {
        const settings = await CompanySettings_js_1.CompanySettings.findOneAndUpdate({}, { ...req.body }, { new: true, upsert: true, runValidators: true });
        res.json({ success: true, data: settings });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
async function getVatRates(req, res) {
    try {
        const rates = await VatRate_js_1.VatRate.find({ isActive: true });
        res.json({ success: true, data: rates });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
async function getPaymentMethods(req, res) {
    try {
        const methods = await PaymentMethod_js_1.PaymentMethod.find({ isActive: true });
        res.json({ success: true, data: methods });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
