export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const ValidationRules = {
  required(value: unknown, fieldName: string): ValidationResult {
    if (value === undefined || value === null) {
      return { isValid: false, error: `${fieldName} is required.` };
    }
    if (typeof value === 'string' && value.trim() === '') {
      return { isValid: false, error: `${fieldName} is required.` };
    }
    return { isValid: true };
  },

  /**
   * UAE Federal Tax Authority (FTA) 15-digit Tax Registration Number (TRN)
   * Pattern: Exactly 15 numeric digits, starting with 100 and usually ending with 0003
   */
  trn(value?: string, isRequired = false): ValidationResult {
    if (!value || value.trim() === '') {
      if (isRequired) {
        return { isValid: false, error: 'UAE TRN is required.' };
      }
      return { isValid: true };
    }

    const clean = value.replace(/\s+/g, '');
    if (!/^\d{15}$/.test(clean)) {
      return {
        isValid: false,
        error: 'UAE TRN must be exactly 15 numeric digits (e.g., 100284759600003).',
      };
    }

    if (!clean.startsWith('100')) {
      return {
        isValid: false,
        error: 'UAE FTA TRNs must start with 100.',
      };
    }

    return { isValid: true };
  },

  email(value?: string, isRequired = false): ValidationResult {
    if (!value || value.trim() === '') {
      if (isRequired) {
        return { isValid: false, error: 'Email address is required.' };
      }
      return { isValid: true };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(value.trim())) {
      return { isValid: false, error: 'Please enter a valid email address.' };
    }

    return { isValid: true };
  },

  phone(value?: string, isRequired = false): ValidationResult {
    if (!value || value.trim() === '') {
      if (isRequired) {
        return { isValid: false, error: 'Phone number is required.' };
      }
      return { isValid: true };
    }

    // Allow +971 ..., 05..., 04..., digits, spaces, hyphens, min 7 digits
    const digits = value.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      return { isValid: false, error: 'Phone number must contain between 7 and 15 digits.' };
    }

    return { isValid: true };
  },

  /**
   * UAE International Bank Account Number (IBAN)
   * Format: AE + 21 digits (23 alphanumeric characters total)
   */
  iban(value?: string, isRequired = false): ValidationResult {
    if (!value || value.trim() === '') {
      if (isRequired) {
        return { isValid: false, error: 'IBAN is required.' };
      }
      return { isValid: true };
    }

    const clean = value.replace(/\s+/g, '').toUpperCase();
    if (!/^AE\d{21}$/.test(clean)) {
      return {
        isValid: false,
        error: 'UAE IBAN must start with "AE" followed by 21 digits (23 characters total).',
      };
    }

    return { isValid: true };
  },

  positiveNumber(value: number, fieldName: string, allowZero = true): ValidationResult {
    if (typeof value !== 'number' || isNaN(value)) {
      return { isValid: false, error: `${fieldName} must be a valid number.` };
    }
    if (allowZero && value < 0) {
      return { isValid: false, error: `${fieldName} cannot be negative.` };
    }
    if (!allowZero && value <= 0) {
      return { isValid: false, error: `${fieldName} must be greater than zero.` };
    }
    return { isValid: true };
  },

  prefix(value: string, fieldName: string): ValidationResult {
    if (!value || value.trim() === '') {
      return { isValid: false, error: `${fieldName} is required.` };
    }
    const clean = value.trim();
    if (!/^[A-Za-z0-9_-]{2,10}$/.test(clean)) {
      return {
        isValid: false,
        error: `${fieldName} must be 2 to 10 characters (letters, numbers, hyphens or underscores).`,
      };
    }
    return { isValid: true };
  },

  sku(value?: string): ValidationResult {
    if (!value || value.trim() === '') {
      return { isValid: true };
    }
    const clean = value.trim();
    if (!/^[A-Za-z0-9_\-\.\/]{2,30}$/.test(clean)) {
      return {
        isValid: false,
        error: 'SKU must be 2 to 30 alphanumeric characters (hyphens, dots, underscores allowed).',
      };
    }
    return { isValid: true };
  },
};
