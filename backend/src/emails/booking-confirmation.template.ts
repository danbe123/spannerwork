import { renderEmailLayout, escapeHtml } from '../services/emailTemplates.js';

export type BookingConfirmationTemplateData = {
  userName: string | null;
  resourceName: string;
  resourceType: 'tool' | 'space' | 'service';
  startDate: Date;
  endDate: Date;
  totalAmount: number; // in pence
  transactionUrl: string;
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function bookingConfirmationTemplate(data: BookingConfirmationTemplateData) {
  const safeName = data.userName ? escapeHtml(data.userName) : '';
  const safeResourceName = escapeHtml(data.resourceName);
  const greeting = safeName ? `Hi ${safeName},` : 'Hi,';
  const formattedTotal = `£${(data.totalAmount / 100).toFixed(2)}`;
  const resourceLabel = data.resourceType === 'tool' ? 'Tool' : data.resourceType === 'space' ? 'Space' : 'Service';

  const subject = `Booking confirmed: ${data.resourceName}`;
  const previewText = `Your ${data.resourceType} booking has been confirmed.`;
  
  const text = [
    greeting,
    '',
    `Your booking for ${data.resourceName} has been confirmed!`,
    '',
    'Booking details:',
    `${resourceLabel}: ${data.resourceName}`,
    `From: ${formatDate(data.startDate)}`,
    `To: ${formatDate(data.endDate)}`,
    `Total: ${formattedTotal}`,
    '',
    `View booking: ${data.transactionUrl}`,
  ].join('\n');

  const bodyHtml = `
    <p>${greeting}</p>
    <p>Your booking for <strong>${safeResourceName}</strong> has been confirmed! 🎉</p>
    <div style="margin: 20px 0; padding: 16px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #2563eb;">
      <p style="margin: 0 0 8px;"><strong>${resourceLabel}:</strong> ${safeResourceName}</p>
      <p style="margin: 0 0 8px;"><strong>From:</strong> ${formatDate(data.startDate)}</p>
      <p style="margin: 0 0 8px;"><strong>To:</strong> ${formatDate(data.endDate)}</p>
      <p style="margin: 0;"><strong>Total:</strong> ${formattedTotal}</p>
    </div>
    <p style="margin: 24px 0;">
      <a href="${data.transactionUrl}" class="button-primary">View booking details</a>
    </p>
    <div style="margin: 20px 0; padding: 16px; background-color: #fefce8; border-radius: 8px;">
      <p style="margin: 0 0 8px; font-weight: 600;">📋 What to do next:</p>
      <ol style="margin: 0; padding-left: 20px; color: #374151; font-size: 14px;">
        <li style="margin-bottom: 4px;">Message the provider to arrange pickup/delivery</li>
        <li style="margin-bottom: 4px;">Check the item when you receive it</li>
        <li style="margin-bottom: 4px;">Leave a review when you're done</li>
      </ol>
    </div>
    <p style="font-size: 13px; color: #6b7280;">
      <strong>Need help?</strong> Keep all communication on SpannerWork to stay protected by our buyer guarantee. 
      If anything goes wrong, our support team is here to help.
    </p>
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      previewText,
      heading: 'Booking Confirmed',
      bodyHtml,
    }),
  };
}
