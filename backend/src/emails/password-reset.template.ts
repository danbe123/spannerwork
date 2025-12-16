import { renderEmailLayout } from '../services/emailTemplates.js';

export type PasswordResetTemplateData = {
  resetUrl: string;
};

export function passwordResetTemplate(data: PasswordResetTemplateData) {
  const subject = 'Reset your SpannerWork password';
  const previewText = 'Reset your SpannerWork password in just a few clicks.';
  
  const text = [
    'Hi,',
    '',
    'We received a request to reset your SpannerWork password.',
    `Reset link: ${data.resetUrl}`,
    '',
    'This link will expire in 1 hour.',
    '',
    'If you did not request this, you can safely ignore this email.',
  ].join('\n');

  const bodyHtml = `
    <p>Hi,</p>
    <p>We received a request to reset your SpannerWork password.</p>
    <p style="margin: 20px 0;">
      <a href="${data.resetUrl}" class="button-primary">Reset password</a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">
      If the button doesn't work, copy and paste this link into your browser:<br/>
      <a href="${data.resetUrl}">${data.resetUrl}</a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">This link will expire in 1 hour.</p>
    <p>If you did not request this, you can safely ignore this email.</p>
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      previewText,
      heading: 'Reset your password',
      bodyHtml,
    }),
  };
}
