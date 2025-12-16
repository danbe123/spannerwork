import { renderEmailLayout, escapeHtml } from '../services/emailTemplates.js';

export type NewMessageTemplateData = {
  recipientName: string | null;
  senderName: string;
  messagePreview: string;
  conversationUrl: string;
};

export function newMessageTemplate(data: NewMessageTemplateData) {
  const safeRecipientName = data.recipientName ? escapeHtml(data.recipientName) : '';
  const safeSenderName = escapeHtml(data.senderName);
  const safePreview = escapeHtml(data.messagePreview);
  const greeting = safeRecipientName ? `Hi ${safeRecipientName},` : 'Hi,';

  const subject = `New message from ${data.senderName}`;
  const previewText = `${data.senderName} sent you a message on SpannerWork.`;
  
  const text = [
    greeting,
    '',
    `You have a new message from ${data.senderName}:`,
    '',
    `"${data.messagePreview}"`,
    '',
    `Reply: ${data.conversationUrl}`,
  ].join('\n');

  const bodyHtml = `
    <p>${greeting}</p>
    <p>You have a new message from <strong>${safeSenderName}</strong>:</p>
    <div style="margin: 20px 0; padding: 16px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #2563eb;">
      <p style="margin: 0; font-style: italic; color: #374151;">"${safePreview}"</p>
    </div>
    <p style="margin: 24px 0;">
      <a href="${data.conversationUrl}" class="button-primary">View & Reply</a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">Keep your conversations on SpannerWork to stay protected by our buyer/seller guarantees.</p>
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      previewText,
      heading: 'New Message',
      bodyHtml,
    }),
  };
}
