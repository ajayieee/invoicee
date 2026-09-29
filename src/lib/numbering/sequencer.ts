import { DocType } from '@/types/database';

export interface DocumentSequenceState {
  docType: DocType;
  prefix: string;
  year: number;
  currentNumber: number;
  padding: number;
}

export class DocumentSequencer {
  /**
   * Formats a document sequence number into standard legal string: e.g. INV-2026-0001
   */
  public static format(prefix: string, year: number, sequenceNum: number, padding: number = 4): string {
    const padded = String(sequenceNum).padStart(padding, '0');
    return `${prefix}-${year}-${padded}`;
  }

  /**
   * Generates a temporary identifier for Draft documents that do NOT consume the legal sequence.
   */
  public static generateDraftId(prefix: string): string {
    const randomHex = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `DRAFT-${prefix}-${randomHex}`;
  }
}
