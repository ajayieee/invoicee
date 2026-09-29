import { CompanySettings, AuditLog } from '@/types/database';
import { ServiceResponse } from '@/types/service';
import { db } from '@/lib/db/repository';
import { ValidationRules } from '@/lib/validation/rules';

class CompanyService {
  getSettings(): CompanySettings {
    return db.getCompanySettings();
  }

  validateSettings(data: Partial<CompanySettings>): Record<string, string> {
    const errors: Record<string, string> = {};

    // Legal Name
    const nameCheck = ValidationRules.required(data.legal_company_name, 'Legal Company Name');
    if (!nameCheck.isValid && nameCheck.error) {
      errors.legal_company_name = nameCheck.error;
    }

    // UAE TRN (Mandatory for UAE corporate entity)
    const trnCheck = ValidationRules.trn(data.trn, true);
    if (!trnCheck.isValid && trnCheck.error) {
      errors.trn = trnCheck.error;
    }

    // Address
    const addressCheck = ValidationRules.required(data.address_line_1, 'Address');
    if (!addressCheck.isValid && addressCheck.error) {
      errors.address_line_1 = addressCheck.error;
    }

    const cityCheck = ValidationRules.required(data.city, 'City');
    if (!cityCheck.isValid && cityCheck.error) {
      errors.city = cityCheck.error;
    }

    // Email & Phone
    const emailCheck = ValidationRules.email(data.email, true);
    if (!emailCheck.isValid && emailCheck.error) {
      errors.email = emailCheck.error;
    }

    const phoneCheck = ValidationRules.phone(data.phone, true);
    if (!phoneCheck.isValid && phoneCheck.error) {
      errors.phone = phoneCheck.error;
    }

    // Bank IBAN (if provided)
    if (data.bank_iban) {
      const ibanCheck = ValidationRules.iban(data.bank_iban, false);
      if (!ibanCheck.isValid && ibanCheck.error) {
        errors.bank_iban = ibanCheck.error;
      }
    }

    // Document Numbering Prefixes
    if (data.invoice_prefix !== undefined) {
      const prefixCheck = ValidationRules.prefix(data.invoice_prefix, 'Invoice Prefix');
      if (!prefixCheck.isValid && prefixCheck.error) {
        errors.invoice_prefix = prefixCheck.error;
      }
    }

    if (data.quote_prefix !== undefined) {
      const prefixCheck = ValidationRules.prefix(data.quote_prefix, 'Quote Prefix');
      if (!prefixCheck.isValid && prefixCheck.error) {
        errors.quote_prefix = prefixCheck.error;
      }
    }

    if (data.credit_note_prefix !== undefined) {
      const prefixCheck = ValidationRules.prefix(data.credit_note_prefix, 'Credit Note Prefix');
      if (!prefixCheck.isValid && prefixCheck.error) {
        errors.credit_note_prefix = prefixCheck.error;
      }
    }

    if (data.payment_prefix !== undefined) {
      const prefixCheck = ValidationRules.prefix(data.payment_prefix, 'Payment Prefix');
      if (!prefixCheck.isValid && prefixCheck.error) {
        errors.payment_prefix = prefixCheck.error;
      }
    }

    // Terms
    if (data.default_payment_terms_days !== undefined) {
      const termsCheck = ValidationRules.positiveNumber(
        data.default_payment_terms_days,
        'Default Payment Terms',
        true
      );
      if (!termsCheck.isValid && termsCheck.error) {
        errors.default_payment_terms_days = termsCheck.error;
      }
    }

    return errors;
  }

  updateSettings(
    data: Partial<CompanySettings>,
    performedBy = 'Administrator'
  ): ServiceResponse<CompanySettings> {
    const current = this.getSettings();
    const merged = { ...current, ...data };
    const errors = this.validateSettings(merged);
    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        errors,
        error: 'Please resolve form validation errors before saving.',
      };
    }

    try {
      const updated = db.updateCompanySettings({
        ...merged,
      });

      return {
        success: true,
        data: updated,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || 'Failed to update company settings.',
      };
    }
  }

  getAuditTrail(): AuditLog[] {
    return db.getAuditLogs();
  }
}

export const companyService = new CompanyService();
