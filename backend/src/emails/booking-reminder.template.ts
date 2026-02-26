import { renderEmailLayout, escapeHtml } from '../services/emailTemplates.js';

export interface BookingReminderData {
  recipientName: string;
  isProvider: boolean;
  resourceName: string;
  resourceType: 'tool' | 'space' | 'service';
  otherPartyName: string;
  bookingDate: string;
  bookingTime?: string;
  location?: string;
  transactionId: string;
  viewBookingUrl: string;
  messageUrl: string;
}

export function generateBookingReminderEmail(data: BookingReminderData): { subject: string; html: string } {
  const safeRecipientName = escapeHtml(data.recipientName);
  const safeResourceName = escapeHtml(data.resourceName);
  const safeOtherPartyName = escapeHtml(data.otherPartyName);
  const safeLocation = data.location ? escapeHtml(data.location) : null;

  const subject = `Reminder: Your ${data.resourceType} booking is tomorrow`;

  const bodyHtml = `
    <p style="margin: 0 0 20px;">Hi ${safeRecipientName},</p>

    <p style="margin: 0 0 24px;">
      This is a friendly reminder that your booking is <strong>tomorrow</strong>.
    </p>

    <!-- Booking Details Box -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 24px; background: #F8FAFC; border-radius: 12px; border-left: 4px solid #C43B12;">
      <tr>
        <td style="padding: 20px;">
          <p style="margin: 0 0 12px; font-weight: 600; color: #1F2937; font-size: 17px;">
            ${safeResourceName}
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
            <tr>
              <td style="padding: 4px 0; color: #6B7280; font-size: 14px;">
                <strong>Date:</strong> ${escapeHtml(data.bookingDate)}${data.bookingTime ? ` at ${escapeHtml(data.bookingTime)}` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #6B7280; font-size: 14px;">
                <strong>${data.isProvider ? 'Customer' : 'Provider'}:</strong> ${safeOtherPartyName}
              </td>
            </tr>
            ${safeLocation ? `
            <tr>
              <td style="padding: 4px 0; color: #6B7280; font-size: 14px;">
                <strong>Location:</strong> ${safeLocation}
              </td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 4px 0; color: #6B7280; font-size: 14px;">
                <strong>Booking ID:</strong> ${escapeHtml(data.transactionId.slice(-8).toUpperCase())}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Tips Box -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 24px; background: #F0FDF4; border-radius: 12px; border-left: 4px solid #10B981;">
      <tr>
        <td style="padding: 16px 20px;">
          <p style="margin: 0 0 8px; font-weight: 600; color: #065F46; font-size: 14px;">
            ${data.isProvider ? 'Provider Tips' : 'Getting Ready'}
          </p>
          <ul style="margin: 0; padding-left: 20px; color: #047857; font-size: 14px; line-height: 1.6;">
            ${data.isProvider ? `
              <li>Ensure your ${data.resourceType} is ready and in good condition</li>
              <li>Review any special requirements from the customer</li>
              <li>Be available at the agreed time</li>
            ` : `
              <li>Confirm the pickup/meeting location</li>
              <li>Bring any required ID or documents</li>
              <li>Message the provider if you have questions</li>
            `}
          </ul>
        </td>
      </tr>
    </table>

    <p style="margin: 0 0 24px; color: #6B7280; font-size: 14px;">
      Need to make changes or have questions?
      <a href="${data.messageUrl}" style="color: #C43B12; font-weight: 500;">Message ${safeOtherPartyName}</a>
    </p>
  `;

  const html = renderEmailLayout({
    title: subject,
    previewText: `Your ${data.resourceType} booking with ${safeOtherPartyName} is tomorrow`,
    heading: 'Booking Reminder',
    subheading: `Your booking is tomorrow`,
    bodyHtml,
    ctaText: 'View Booking Details',
    ctaUrl: data.viewBookingUrl,
    footerNote: 'You received this reminder because you have an upcoming booking on SpannerWork.',
  });

  return { subject, html };
}
