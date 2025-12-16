import { renderEmailLayout, escapeHtml } from '../services/emailTemplates.js';

export type PaymentReceivedTemplateData = {
  recipientName: string | null;
  amount: number; // in pence
  resourceName: string;
  resourceType: 'tool' | 'space' | 'service';
  transactionId: string;
  transactionUrl: string;
  earningsUrl: string;
};

export function paymentReceivedTemplate(data: PaymentReceivedTemplateData) {
  const safeName = data.recipientName ? escapeHtml(data.recipientName) : '';
  const safeResourceName = escapeHtml(data.resourceName);
  const greeting = safeName ? `Hi ${safeName},` : 'Hi,';
  const formattedAmount = `£${(data.amount / 100).toFixed(2)}`;
  const resourceLabel = data.resourceType === 'tool' ? 'tool' : data.resourceType === 'space' ? 'space' : 'service';

  const subject = `Payment received: ${formattedAmount} 💰`;
  const previewText = `You received ${formattedAmount} for your ${resourceLabel} rental on SpannerWork.`;
  
  const text = [
    greeting,
    '',
    `Great news! You've received a payment of ${formattedAmount}.`,
    '',
    `For: ${data.resourceName}`,
    `Transaction ID: ${data.transactionId}`,
    '',
    `View transaction: ${data.transactionUrl}`,
    `View all earnings: ${data.earningsUrl}`,
  ].join('\n');

  const bodyHtml = `
    <p>${greeting}</p>
    <p>Great news! You've received a payment.</p>
    <div style="margin: 20px 0; padding: 20px; background-color: #f0fdf4; border-radius: 8px; border-left: 4px solid #22c55e; text-align: center;">
      <p style="margin: 0; font-size: 32px; font-weight: 700; color: #22c55e;">${formattedAmount}</p>
      <p style="margin: 8px 0 0; color: #374151;">For: ${safeResourceName}</p>
    </div>
    <p style="margin: 24px 0;">
      <a href="${data.transactionUrl}" class="button-primary">View transaction</a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">
      Transaction ID: ${data.transactionId}<br/>
      <a href="${data.earningsUrl}">View all your earnings →</a>
    </p>
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      previewText,
      heading: 'Payment Received',
      bodyHtml,
    }),
  };
}
