import { EInvoiceProvider, EInvoiceSubmissionPayload, EInvoiceSubmissionResponse } from './types';

export class SimulatedUAEASPProvider implements EInvoiceProvider {
  public readonly providerName = 'Simulated UAE ASP (Accredited Service Provider)';

  async submitInvoice(payload: EInvoiceSubmissionPayload): Promise<EInvoiceSubmissionResponse> {
    // Generate deterministic simulation hash
    const docHash = `sha256:${Buffer.from(`${payload.invoiceNumber}:${payload.supplierTrn}:${payload.grandTotal}`).toString('hex').slice(0, 32)}`;
    const docUuid = `uae-einvoice-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;
    const qrData = `https://tax.gov.ae/einvoice/verify?doc=${payload.invoiceNumber}&trn=${payload.supplierTrn}&total=${payload.grandTotal}`;

    return {
      success: true,
      status: 'ACCEPTED',
      uuid: docUuid,
      hash: docHash,
      qrCodeData: qrData,
    };
  }

  async submitCreditNote(payload: EInvoiceSubmissionPayload): Promise<EInvoiceSubmissionResponse> {
    const docHash = `sha256:${Buffer.from(`CN:${payload.invoiceNumber}:${payload.grandTotal}`).toString('hex').slice(0, 32)}`;
    const docUuid = `uae-cn-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;

    return {
      success: true,
      status: 'ACCEPTED',
      uuid: docUuid,
      hash: docHash,
    };
  }

  async getStatus(documentUuid: string): Promise<EInvoiceSubmissionResponse> {
    return {
      success: true,
      status: 'ACCEPTED',
      uuid: documentUuid,
      hash: 'sha256:verified_status_signature',
    };
  }

  async cancelDocument(documentUuid: string, reason: string): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: `Document ${documentUuid} cancellation registered with ASP. Reason: ${reason}`,
    };
  }
}

let activeProvider: EInvoiceProvider = new SimulatedUAEASPProvider();

export function getEInvoiceProvider(): EInvoiceProvider {
  return activeProvider;
}

export function setEInvoiceProvider(provider: EInvoiceProvider) {
  activeProvider = provider;
}
