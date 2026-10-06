"use strict";
/**
 * Email Service - Brevo (formerly Sendinblue) Transactional REST API
 * Sends transactional emails, such as password reset OTP codes, via Brevo API.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.sendPasswordResetEmail = sendPasswordResetEmail;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
/**
 * Sends an email using Brevo's Transactional Email REST API.
 * If BREVO_API_KEY is not configured or in development mode, it provides detailed diagnostic logs.
 */
async function sendEmail({ toEmail, toName, subject, htmlContent, textContent, }) {
    const apiKey = process.env.BREVO_API_KEY?.trim();
    const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim() || 'ajay@pixelflames.com';
    const senderName = process.env.BREVO_SENDER_NAME?.trim() || 'Pixelflames Invoicing';
    if (!apiKey) {
        console.warn('\n======================================================');
        console.warn(' [BREVO EMAIL SERVICE - NOTICE]');
        console.warn(' BREVO_API_KEY is not defined in server/.env');
        console.warn(` Recipient:     ${toEmail}`);
        console.warn(` Subject:       ${subject}`);
        console.warn(' To enable real email delivery to inboxes, add:');
        console.warn('   BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxx');
        console.warn('   BREVO_SENDER_EMAIL=your-verified-sender@domain.com');
        console.warn('   BREVO_SENDER_NAME=Pixelflames Invoicing');
        console.warn('======================================================\n');
        return {
            success: false,
            deliveredVia: 'console_fallback',
            error: 'BREVO_API_KEY is not configured in server/.env. Add your Brevo API key to enable live email delivery.',
        };
    }
    try {
        const payload = {
            sender: {
                name: senderName,
                email: senderEmail,
            },
            to: [
                {
                    email: toEmail,
                    name: toName || toEmail.split('@')[0],
                },
            ],
            subject,
            htmlContent,
            textContent: textContent || subject,
        };
        const response = await fetch(BREVO_API_URL, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        const data = (await response.json().catch(() => ({})));
        if (!response.ok) {
            const errorMessage = data?.message || `Brevo API responded with HTTP ${response.status}: ${response.statusText}`;
            console.error(`[BREVO EMAIL ERROR] Failed to send email to ${toEmail}:`, errorMessage);
            return {
                success: false,
                error: errorMessage,
            };
        }
        console.log(`[BREVO EMAIL SUCCESS] Email delivered to ${toEmail} | Message ID: ${data.messageId}`);
        return {
            success: true,
            messageId: data.messageId,
            deliveredVia: 'brevo',
        };
    }
    catch (err) {
        console.error(`[BREVO EMAIL EXCEPTION] Failed to connect to Brevo API:`, err.message);
        return {
            success: false,
            error: err.message || 'Network error while contacting Brevo API.',
        };
    }
}
/**
 * Builds and sends a UAE FTA Pixelflames-branded Password Reset Verification Email
 */
async function sendPasswordResetEmail(toEmail, recipientName, code, expiryMinutes = 15) {
    const subject = `Your Verification Code: ${code} - Pixelflames Invoicing`;
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0f172a; padding: 40px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #065f46 0%, #047857 50%, #059669 100%); padding: 32px 30px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 12px; padding: 8px 16px; margin-bottom: 12px;">
                      <span style="color: #ffffff; font-size: 13px; font-weight: 600; letter-spacing: 0.5px;">🇦🇪 UAE FTA TAX INVOICING</span>
                    </div>
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Pixelflames</h1>
                    <p style="margin: 4px 0 0 0; color: #d1fae5; font-size: 12px;">Enterprise Financial Management Gateway</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 18px; font-weight: 700;">Password Reset Request</h2>
              <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; line-height: 22px;">
                Hello <strong>${recipientName || 'Team Member'}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; color: #475569; font-size: 14px; line-height: 22px;">
                We received a request to reset your password for your <strong>Pixelflames Invoicing</strong> account (<code>${toEmail}</code>). Use the verification code below to complete your password reset:
              </p>

              <!-- OTP Code Display Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center" style="background-color: #f8fafc; border: 2px dashed #059669; border-radius: 12px; padding: 20px 10px;">
                    <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #059669; letter-spacing: 1px; margin-bottom: 6px;">Your 6-Digit Verification Code</div>
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; color: #0f172a; letter-spacing: 8px;">
                      ${code}
                    </div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 6px;">
                      ⏱️ Valid for <strong>${expiryMinutes} minutes</strong> only
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Security Information Note -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 6px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px 16px;">
                    <p style="margin: 0; color: #1e40af; font-size: 12px; line-height: 18px;">
                      <strong>Security Tip:</strong> Pixelflames support will never ask you for this code. Do not share it with anyone.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px; line-height: 20px;">
                If you did not request this password reset, you can safely ignore this email. Your account remains secure and your current password will not be changed.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center;">
              <p style="margin: 0 0 6px 0; color: #64748b; font-size: 11px;">
                Pixelflames Technologies • Dubai, United Arab Emirates
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 10px;">
                Automated Transactional Notification • Compliant with UAE Federal Decree-Law No. (8) of 2017
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
    const textContent = `
Pixelflames Invoicing - Password Reset Verification Code

Hello ${recipientName || 'Team Member'},

We received a request to reset your password for your Pixelflames Invoicing account (${toEmail}).

Your 6-digit verification code is: ${code}

This code will expire in ${expiryMinutes} minutes.

If you did not request this password reset, please ignore this email. Your password will not be changed.

Pixelflames Technologies, Dubai, United Arab Emirates.
  `.trim();
    return sendEmail({
        toEmail,
        toName: recipientName,
        subject,
        htmlContent,
        textContent,
    });
}
