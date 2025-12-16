import { renderEmailLayout, escapeHtml } from '../services/emailTemplates.js';

export type BookingCancellationTemplateData = {
  userName: string | null;
  resourceName: string;
  resourceType: 'tool' | 'space' | 'service';
  startDate: Date;
  endDate: Date;
  cancelledBy: 'user' | 'provider';
  transactionUrl: string;
  searchUrl: string;
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function bookingCancellationTemplate(data: BookingCancellationTemplateData) {
  const safeName = data.userName ? escapeHtml(data.userName) : '';
  const safeResourceName = escapeHtml(data.resourceName);
  const greeting = safeName ? `Hi ${safeName},` : 'Hi,';
  const cancelledByText = data.cancelledBy === 'user' ? 'You' : 'The provider';

  const subject = `Booking cancelled: ${data.resourceName}`;
  const previewText = `Your ${data.resourceType} booking has been cancelled.`;
  
  const text = [
    greeting,
    '',
    `${cancelledByText} cancelled the booking for ${data.resourceName}.`,
    '',
    'Cancelled booking:',
    `${data.resourceType}: ${data.resourceName}`,
    `From: ${formatDate(data.startDate)}`,
    `To: ${formatDate(data.endDate)}`,
    '',
    `View details: ${data.transactionUrl}`,
    '',
    'Need to find an alternative? Search for similar items on SpannerWork.',
  ].join('\n');

  const bodyHtml = `
    <p>${greeting}</p>
    <p>${cancelledByText} cancelled the booking for <strong>${safeResourceName}</strong>.</p>
    <div style="margin: 20px 0; padding: 16px; background-color: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444;">
      <p style="margin: 0 0 8px;"><strong>Cancelled booking:</strong></p>
      <p style="margin: 0 0 8px;">${safeResourceName}</p>
      <p style="margin: 0 0 8px;"><strong>From:</strong> ${formatDate(data.startDate)}</p>
      <p style="margin: 0;"><strong>To:</strong> ${formatDate(data.endDate)}</p>
    </div>
    <p style="margin: 24px 0;">
      <a href="${data.transactionUrl}" class="button-primary">View details</a>
    </p>
    <p>Need to find an alternative? <a href="${data.searchUrl}">Search for similar items</a> on SpannerWork.</p>
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      previewText,
      heading: 'Booking Cancelled',
      bodyHtml,
    }),
  };
}
