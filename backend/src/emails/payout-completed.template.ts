import { renderEmailLayout, escapeHtml } from '../services/emailTemplates.js';

export interface PayoutCompletedData {
  recipientName: string;
  payoutAmount: string;
  currency: string;
  payoutDate: string;
  bankLast4?: string;
  transactionCount: number;
  periodStart: string;
  periodEnd: string;
  earningsUrl: string;
}

export function generatePayoutCompletedEmail(data: PayoutCompletedData): { subject: string; html: string } {
  const safeRecipientName = escapeHtml(data.recipientName);
  const safeBankLast4 = data.bankLast4 ? escapeHtml(data.bankLast4) : null;

  const subject = `Payout of ${data.currency}${data.payoutAmount} is on its way`;

  const bodyHtml = `
    <p style="margin: 0 0 20px;">Hi ${safeRecipientName},</p>

    <p style="margin: 0 0 24px;">
      Great news! Your payout has been processed and is on its way to your bank account.
    </p>

    <!-- Payout Amount Box -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 24px; background: linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%); border-radius: 12px; border: 1px solid #BBF7D0;">
      <tr>
        <td style="padding: 24px; text-align: center;">
          <p style="margin: 0 0 4px; color: #166534; font-size: 14px; font-weight: 500;">Payout Amount</p>
          <p style="margin: 0; color: #15803D; font-size: 36px; font-weight: 700;">${escapeHtml(data.currency)}${escapeHtml(data.payoutAmount)}</p>
        </td>
      </tr>
    </table>

    <!-- Payout Details Box -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 24px; background: #F8FAFC; border-radius: 12px;">
      <tr>
        <td style="padding: 20px;">
          <p style="margin: 0 0 16px; font-weight: 600; color: #1F2937; font-size: 15px;">Payout Details</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
            <tr>
              <td style="padding: 8px 0; color: #6B7280; font-size: 14px; border-bottom: 1px solid #E5E7EB;">
                <strong>Payout Date:</strong>
              </td>
              <td style="padding: 8px 0; color: #1F2937; font-size: 14px; text-align: right; border-bottom: 1px solid #E5E7EB;">
                ${escapeHtml(data.payoutDate)}
              </td>
            </tr>
            ${safeBankLast4 ? `
            <tr>
              <td style="padding: 8px 0; color: #6B7280; font-size: 14px; border-bottom: 1px solid #E5E7EB;">
                <strong>Bank Account:</strong>
              </td>
              <td style="padding: 8px 0; color: #1F2937; font-size: 14px; text-align: right; border-bottom: 1px solid #E5E7EB;">
                ****${safeBankLast4}
              </td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0; color: #6B7280; font-size: 14px; border-bottom: 1px solid #E5E7EB;">
                <strong>Bookings Included:</strong>
              </td>
              <td style="padding: 8px 0; color: #1F2937; font-size: 14px; text-align: right; border-bottom: 1px solid #E5E7EB;">
                ${data.transactionCount} booking${data.transactionCount !== 1 ? 's' : ''}
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">
                <strong>Period:</strong>
              </td>
              <td style="padding: 8px 0; color: #1F2937; font-size: 14px; text-align: right;">
                ${escapeHtml(data.periodStart)} - ${escapeHtml(data.periodEnd)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Timing Info -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 24px; background: #FEF3C7; border-radius: 12px; border-left: 4px solid #F59E0B;">
      <tr>
        <td style="padding: 16px 20px;">
          <p style="margin: 0; color: #92400E; font-size: 14px;">
            <strong>When will I receive it?</strong><br>
            Payouts typically arrive within 2-3 business days, depending on your bank.
          </p>
        </td>
      </tr>
    </table>

    <p style="margin: 0; color: #6B7280; font-size: 14px;">
      Thank you for being a SpannerWork provider! Keep up the great work.
    </p>
  `;

  const html = renderEmailLayout({
    title: subject,
    previewText: `Your payout of ${data.currency}${data.payoutAmount} has been processed`,
    heading: 'Payout Processed',
    subheading: `Money is on its way to your bank`,
    bodyHtml,
    ctaText: 'View Earnings Dashboard',
    ctaUrl: data.earningsUrl,
    footerNote: 'You received this email because you have earnings from SpannerWork.',
  });

  return { subject, html };
}
