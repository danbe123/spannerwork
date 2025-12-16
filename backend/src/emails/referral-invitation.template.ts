import { renderEmailLayout, escapeHtml } from '../services/emailTemplates.js';

export type ReferralInvitationTemplateData = {
  referrerName: string | null;
  referralCode: string;
  signupUrl: string;
};

export function referralInvitationTemplate(data: ReferralInvitationTemplateData) {
  const safeReferrerName = data.referrerName ? escapeHtml(data.referrerName) : 'A friend';
  const displayName = data.referrerName || 'A friend';

  const subject = `${displayName} invited you to SpannerWork`;
  const previewText = 'Join SpannerWork and start renting tools, spaces, and services in your community.';
  
  const text = [
    `${displayName} has invited you to join SpannerWork!`,
    '',
    'SpannerWork is a peer-to-peer marketplace where you can:',
    '• Rent tools from your neighbors',
    '• Find workspace and equipment',
    '• Offer your own tools and services to earn extra income',
    '',
    `Your referral code: ${data.referralCode}`,
    `Sign up: ${data.signupUrl}`,
  ].join('\n');

  const bodyHtml = `
    <p><strong>${safeReferrerName}</strong> has invited you to join SpannerWork!</p>
    <p>SpannerWork is a peer-to-peer marketplace where you can:</p>
    <ul style="margin: 16px 0; padding-left: 20px;">
      <li style="margin-bottom: 8px;">Rent tools from your neighbors</li>
      <li style="margin-bottom: 8px;">Find workspace and equipment</li>
      <li style="margin-bottom: 8px;">Offer your own tools and services to earn extra income</li>
    </ul>
    <div style="margin: 20px 0; padding: 16px; background-color: #f8fafc; border-radius: 8px; text-align: center;">
      <p style="margin: 0; font-size: 13px; color: #6b7280;">Your referral code:</p>
      <p style="margin: 8px 0 0; font-size: 24px; font-weight: 700; letter-spacing: 2px; color: #1d4ed8;">${data.referralCode}</p>
    </div>
    <p style="margin: 24px 0;">
      <a href="${data.signupUrl}" class="button-primary">Join SpannerWork</a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">
      If the button doesn't work, copy and paste this link into your browser:<br/>
      <a href="${data.signupUrl}">${data.signupUrl}</a>
    </p>
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      previewText,
      heading: 'You\'ve Been Invited!',
      bodyHtml,
    }),
  };
}
