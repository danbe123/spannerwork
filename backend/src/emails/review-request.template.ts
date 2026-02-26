import { renderEmailLayout, escapeHtml } from '../services/emailTemplates.js';

export interface ReviewRequestData {
  recipientName: string;
  isProvider: boolean;
  resourceName: string;
  resourceType: 'tool' | 'space' | 'service';
  otherPartyName: string;
  completedDate: string;
  transactionId: string;
  reviewUrl: string;
}

export function generateReviewRequestEmail(data: ReviewRequestData): { subject: string; html: string } {
  const safeRecipientName = escapeHtml(data.recipientName);
  const safeResourceName = escapeHtml(data.resourceName);
  const safeOtherPartyName = escapeHtml(data.otherPartyName);

  const subject = `How was your experience with ${safeOtherPartyName}?`;

  const bodyHtml = `
    <p style="margin: 0 0 20px;">Hi ${safeRecipientName},</p>

    <p style="margin: 0 0 24px;">
      Your recent booking has been completed. We'd love to hear how it went!
    </p>

    <!-- Booking Summary Box -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 24px; background: #F8FAFC; border-radius: 12px; border-left: 4px solid #C43B12;">
      <tr>
        <td style="padding: 20px;">
          <p style="margin: 0 0 8px; font-weight: 600; color: #1F2937; font-size: 17px;">
            ${safeResourceName}
          </p>
          <p style="margin: 0; color: #6B7280; font-size: 14px;">
            ${data.isProvider ? 'Customer' : 'Provider'}: ${safeOtherPartyName}<br>
            Completed: ${escapeHtml(data.completedDate)}
          </p>
        </td>
      </tr>
    </table>

    <!-- Why Reviews Matter -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 24px; background: #FEF3C7; border-radius: 12px; border-left: 4px solid #F59E0B;">
      <tr>
        <td style="padding: 16px 20px;">
          <p style="margin: 0 0 8px; font-weight: 600; color: #92400E; font-size: 14px;">
            Why Your Review Matters
          </p>
          <ul style="margin: 0; padding-left: 20px; color: #A16207; font-size: 14px; line-height: 1.6;">
            <li>Helps other users make informed decisions</li>
            <li>Rewards great ${data.isProvider ? 'customers' : 'providers'}</li>
            <li>Builds trust in the SpannerWork community</li>
          </ul>
        </td>
      </tr>
    </table>

    <!-- Star Rating Preview -->
    <div style="text-align: center; margin: 0 0 24px;">
      <p style="margin: 0 0 12px; color: #6B7280; font-size: 14px;">Rate your experience:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
        <tr>
          <td style="padding: 0 4px; font-size: 32px; color: #FFC107;">&#9733;</td>
          <td style="padding: 0 4px; font-size: 32px; color: #FFC107;">&#9733;</td>
          <td style="padding: 0 4px; font-size: 32px; color: #FFC107;">&#9733;</td>
          <td style="padding: 0 4px; font-size: 32px; color: #FFC107;">&#9733;</td>
          <td style="padding: 0 4px; font-size: 32px; color: #FFC107;">&#9733;</td>
        </tr>
      </table>
    </div>

    <p style="margin: 0 0 8px; color: #6B7280; font-size: 14px; text-align: center;">
      It only takes a minute to leave a review.
    </p>
  `;

  const html = renderEmailLayout({
    title: subject,
    previewText: `Share your experience with ${safeOtherPartyName} on SpannerWork`,
    heading: 'Leave a Review',
    subheading: `How was your experience?`,
    bodyHtml,
    ctaText: 'Write Your Review',
    ctaUrl: data.reviewUrl,
    footerNote: 'You received this email because you completed a booking on SpannerWork.',
  });

  return { subject, html };
}
