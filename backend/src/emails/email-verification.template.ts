import { renderEmailLayout } from '../services/emailTemplates.js';

export type EmailVerificationTemplateData = {
  verifyUrl: string;
  name?: string;
};

export function emailVerificationTemplate(data: EmailVerificationTemplateData) {
  const subject = 'Verify your email for SpannerWork';
  const previewText = 'One click to activate your SpannerWork account and start connecting with local mechanics.';
  const greeting = data.name ? `Hey ${data.name}!` : 'Hey there!';
  
  const text = [
    greeting,
    '',
    'Welcome to SpannerWork! Please verify your email to complete your registration.',
    `Verification link: ${data.verifyUrl}`,
    '',
    'This link expires in 24 hours.',
    '',
    '- The SpannerWork Team',
  ].join('\n');

  const bodyHtml = `
    <p style="margin: 0 0 20px; font-size: 18px; font-weight: 500; color: #111827;">${greeting}</p>
    
    <p style="margin: 0 0 24px; color: #4B5563;">
      Welcome to the community! You're just one click away from connecting with local mechanics, renting tools, and finding workshop space.
    </p>
    
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 24px; background: #FFF8F6; border-radius: 12px; border-left: 4px solid #D84315;">
      <tr>
        <td style="padding: 16px 20px;">
          <p style="margin: 0; font-size: 14px; color: #6B7280;">
            ⏰ This verification link expires in <strong style="color: #374151;">24 hours</strong>
          </p>
        </td>
      </tr>
    </table>
    
    <p style="margin: 32px 0 12px; font-size: 13px; color: #9CA3AF; text-align: center;">
      Button not working? Copy and paste this link:
    </p>
    <p style="margin: 0; font-size: 12px; color: #D84315; word-break: break-all; text-align: center;">
      <a href="${data.verifyUrl}" style="color: #D84315;">${data.verifyUrl}</a>
    </p>
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      previewText,
      heading: 'Verify Your Email',
      subheading: 'Complete your registration to get started',
      bodyHtml,
      ctaText: 'Verify My Email',
      ctaUrl: data.verifyUrl,
    }),
  };
}
