import { Resend } from 'resend';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { renderEmailLayout } from './emailTemplates.js';
import { escapeHtml } from '../utils/sanitize.js';
import {
  generateBookingReminderEmail,
  type BookingReminderData
} from '../emails/booking-reminder.template.js';
import {
  generateReviewRequestEmail,
  type ReviewRequestData
} from '../emails/review-request.template.js';
import {
  generatePayoutCompletedEmail,
  type PayoutCompletedData
} from '../emails/payout-completed.template.js';
import {
  generateWeeklyEarningsSummaryEmail,
  type WeeklyEarningsSummaryData
} from '../emails/weekly-earnings-summary.template.js';

const hasResendApiKey = !!env.RESEND_API_KEY;
const resend = hasResendApiKey ? new Resend(env.RESEND_API_KEY!) : null;
const hasMailtrapApiKey = !!env.MAILTRAP_API_KEY;

type SenderType = 'default' | 'support' | 'sales';

type SendEmailParams = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  category?: string;
  replyTo?: string;
  senderType?: SenderType;
};

type MailtrapSendParams = SendEmailParams & {
  fromEmail: string;
  fromName: string;
};

function getSender(type: SenderType = 'default') {
  switch (type) {
    case 'support':
      return {
        email: env.EMAIL_FROM,
        name: `${env.EMAIL_FROM_NAME} Support`,
      };
    case 'sales':
      return {
        email: env.EMAIL_FROM,
        name: `${env.EMAIL_FROM_NAME} Sales`,
      };
    default:
      return {
        email: env.EMAIL_FROM,
        name: env.EMAIL_FROM_NAME,
      };
  }
}

async function sendViaMailtrap(params: MailtrapSendParams) {
  if (!hasMailtrapApiKey) {
    return;
  }

  try {
    const response = await fetch('https://send.api.mailtrap.io/api/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.MAILTRAP_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: {
          email: params.fromEmail,
          name: params.fromName,
        },
        to: [{ email: params.to }],
        subject: params.subject,
        text: params.text,
        html: params.html,
        category: params.category,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      logger.error('Mailtrap email send failed', {
        status: response.status,
        body,
      });
    }
  } catch (error) {
    logger.error('Error sending email via Mailtrap', error);
  }
}

async function safeSend(params: SendEmailParams) {
  const sender = getSender(params.senderType);

  if (hasMailtrapApiKey) {
    await sendViaMailtrap({
      ...params,
      fromEmail: sender.email,
      fromName: sender.name,
    });
    return;
  }

  if (!resend) {
    logger.warn('Email sending skipped: no email provider configured (MAILTRAP_API_KEY or RESEND_API_KEY)');
    return;
  }

  try {
    await resend.emails.send({
      to: params.to,
      from: `${sender.name} <${sender.email}>`,
      subject: params.subject,
      html: params.html,
      text: params.text ?? '',
      replyTo: params.replyTo,
    });
  } catch (error) {
    logger.error('Error sending email via Resend', error);
  }
}

export const emailService = {
  /**
   * Send magic link email for passwordless login
   */
  async sendMagicLinkEmail(to: string, token: string) {
    const magicUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/magic-login?token=${encodeURIComponent(token)}`;

    const subject = 'Your SpannerWork login link';
    const previewText = 'Click to sign in to your SpannerWork account instantly.';
    const text = [
      'Hi,',
      '',
      'You requested a login link for your SpannerWork account.',
      `Login link: ${magicUrl}`,
      '',
      'This link expires in 15 minutes and can only be used once.',
      '',
      "Didn't request this? You can safely ignore this email.",
      '',
      '- The SpannerWork Team',
    ].join('\n');

    const bodyHtml = `
      <p style="margin: 0 0 20px; color: #4B5563;">
        You requested a login link for your SpannerWork account. Click the button below to sign in instantly — no password needed.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 24px; background: #FEF3C7; border-radius: 12px; border-left: 4px solid #F59E0B;">
        <tr>
          <td style="padding: 16px 20px;">
            <p style="margin: 0; font-size: 14px; color: #92400E;">
              ⏱️ This link expires in <strong>15 minutes</strong> and can only be used once
            </p>
          </td>
        </tr>
      </table>

      <p style="margin: 32px 0 12px; font-size: 13px; color: #9CA3AF; text-align: center;">
        Button not working? Copy and paste this link:
      </p>
      <p style="margin: 0 0 24px; font-size: 12px; color: #C43B12; word-break: break-all; text-align: center;">
        <a href="${magicUrl}" style="color: #C43B12;">${magicUrl}</a>
      </p>

      <p style="margin: 0; padding-top: 16px; border-top: 1px solid #F3E8E5; font-size: 13px; color: #9CA3AF;">
        Didn't request this? No worries — your account is safe. Someone may have typed your email by mistake.
      </p>
    `;

    await safeSend({
      to,
      subject,
      html: renderEmailLayout({
        title: subject,
        previewText,
        heading: 'Sign In Instantly',
        subheading: 'No password required',
        bodyHtml,
        ctaText: 'Sign In Now',
        ctaUrl: magicUrl,
      }),
      text,
      category: 'magic-link',
      senderType: 'support',
    });
  },

  async sendPasswordResetEmail(to: string, token: string) {
    const resetUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(
      token,
    )}`;

    const subject = 'Reset your SpannerWork password';
    const previewText = 'Someone requested a password reset for your account. Click to reset it securely.';
    const text = [
      'Hi,',
      '',
      'Someone requested a password reset for your SpannerWork account.',
      `Reset link: ${resetUrl}`,
      '',
      'This link expires in 1 hour.',
      '',
      "Didn't request this? You can safely ignore this email.",
      '',
      '- The SpannerWork Team',
    ].join('\n');

    const bodyHtml = `
      <p style="margin: 0 0 20px; color: #4B5563;">
        Someone requested a password reset for your SpannerWork account. Click the button below to choose a new password.
      </p>
      
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 24px; background: #FEF3C7; border-radius: 12px; border-left: 4px solid #F59E0B;">
        <tr>
          <td style="padding: 16px 20px;">
            <p style="margin: 0; font-size: 14px; color: #92400E;">
              ⚠️ This link expires in <strong>1 hour</strong> for your security
            </p>
          </td>
        </tr>
      </table>
      
      <p style="margin: 32px 0 12px; font-size: 13px; color: #9CA3AF; text-align: center;">
        Button not working? Copy and paste this link:
      </p>
      <p style="margin: 0 0 24px; font-size: 12px; color: #C43B12; word-break: break-all; text-align: center;">
        <a href="${resetUrl}" style="color: #C43B12;">${resetUrl}</a>
      </p>
      
      <p style="margin: 0; padding-top: 16px; border-top: 1px solid #F3E8E5; font-size: 13px; color: #9CA3AF;">
        Didn't request this? No worries — your password won't change unless you click the button above.
      </p>
    `;

    await safeSend({
      to,
      subject,
      html: renderEmailLayout({
        title: subject,
        previewText,
        heading: 'Reset Your Password',
        subheading: 'Choose a new password for your account',
        bodyHtml,
        ctaText: 'Reset My Password',
        ctaUrl: resetUrl,
      }),
      text,
      category: 'password-reset',
      senderType: 'support',
    });
  },

  /**
   * Send password changed notification email
   * Alerts user when their password has been changed for security awareness
   */
  async sendPasswordChangedEmail(to: string, userName?: string) {
    const subject = 'Your SpannerWork password has been changed';
    const previewText = 'Your password was successfully changed. If this wasn\'t you, please take action immediately.';
    const text = [
      `Hi${userName ? ` ${userName}` : ''},`,
      '',
      'Your SpannerWork password was just changed.',
      '',
      'If you made this change, no further action is needed.',
      '',
      'If you did NOT change your password, your account may have been compromised.',
      'Please contact us immediately at support@spannerwork.com',
      '',
      '- The SpannerWork Security Team',
    ].join('\n');

    const bodyHtml = `
      <p style="margin: 0 0 20px; color: #4B5563;">
        Hi${userName ? ` ${escapeHtml(userName)}` : ''},
      </p>

      <p style="margin: 0 0 20px; color: #4B5563;">
        Your SpannerWork password was just changed successfully.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 24px; background: #FEF3C7; border-radius: 12px; border-left: 4px solid #F59E0B;">
        <tr>
          <td style="padding: 16px 20px;">
            <p style="margin: 0; font-size: 14px; color: #92400E;">
              ⚠️ <strong>Didn't make this change?</strong><br>
              Your account may be compromised. Please contact us immediately at
              <a href="mailto:support@spannerwork.com" style="color: #92400E;">support@spannerwork.com</a>
            </p>
          </td>
        </tr>
      </table>

      <p style="margin: 0; padding-top: 16px; border-top: 1px solid #F3E8E5; font-size: 13px; color: #9CA3AF;">
        If you made this change, no further action is required.
      </p>
    `;

    await safeSend({
      to,
      subject,
      html: renderEmailLayout({
        title: subject,
        previewText,
        heading: 'Password Changed',
        subheading: 'Your account password has been updated',
        bodyHtml,
      }),
      text,
      category: 'security-alert',
      senderType: 'support',
    });
  },

  async sendEmailVerificationEmail(to: string, token: string, name?: string) {
    const verifyUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/Verification?token=${encodeURIComponent(
      token,
    )}`;

    const subject = 'Verify your email for SpannerWork';
    const previewText = 'One click to activate your SpannerWork account and start connecting with local mechanics.';
    const greeting = name ? `Hey ${name}!` : 'Hey there!';
    const text = [
      greeting,
      '',
      'Welcome to SpannerWork! Please verify your email to complete your registration.',
      `Verification link: ${verifyUrl}`,
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
      
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 24px; background: #FFF8F6; border-radius: 12px; border-left: 4px solid #C43B12;">
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
      <p style="margin: 0; font-size: 12px; color: #C43B12; word-break: break-all; text-align: center;">
        <a href="${verifyUrl}" style="color: #C43B12;">${verifyUrl}</a>
      </p>
    `;

    await safeSend({
      to,
      subject,
      html: renderEmailLayout({
        title: subject,
        previewText,
        heading: 'Verify Your Email',
        subheading: 'Complete your registration to get started',
        bodyHtml,
        ctaText: 'Verify My Email',
        ctaUrl: verifyUrl,
      }),
      text,
      category: 'email-verification',
      senderType: 'support',
    });
  },

  async sendInsuranceStatusUpdateEmail(to: string, data: {
    userName: string | null;
    status: 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'PENDING_REVIEW';
    rejectionReason?: string | null;
  }) {
    const insuranceUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/verification`;
    const safeName = data.userName ? escapeHtml(data.userName) : '';
    const greeting = safeName ? `Hi ${safeName},` : 'Hi,';

    if (data.status === 'APPROVED') {
      const subject = 'Your insurance has been approved';
      const previewText = 'You can now list and accept bookings for services that require insurance.';
      const text = [
        greeting,
        '',
        'Good news — your insurance document has been approved.',
        '',
        `View status: ${insuranceUrl}`,
        '',
        '- The SpannerWork Team',
      ].join('\n');

      const bodyHtml = `
        <p style="margin: 0 0 20px; font-size: 18px; font-weight: 500; color: #111827;">${greeting}</p>
        <p style="margin: 0 0 24px; color: #4B5563;">Good news — your insurance document has been <strong>approved</strong>.</p>
        <p style="margin: 0 0 24px; color: #4B5563;">You can now list and accept bookings for services that require insurance.</p>
      `;

      await safeSend({
        to,
        subject,
        html: renderEmailLayout({
          title: subject,
          previewText,
          heading: 'Insurance approved',
          subheading: 'You are good to go',
          bodyHtml,
          ctaText: 'View Insurance Status',
          ctaUrl: insuranceUrl,
        }),
        text,
        category: 'insurance-status',
        senderType: 'support',
      });
      return;
    }

    if (data.status === 'REJECTED') {
      const subject = 'Your insurance needs attention';
      const previewText = 'Your insurance document was rejected. Please upload an updated document.';
      const safeReason = data.rejectionReason ? escapeHtml(data.rejectionReason) : '';
      const reasonLine = safeReason ? `Reason: ${safeReason}` : '';
      const text = [
        greeting,
        '',
        'Your insurance document was rejected.',
        reasonLine,
        '',
        `Upload a new document: ${insuranceUrl}`,
        '',
        '- The SpannerWork Team',
      ].filter(Boolean).join('\n');

      const bodyHtml = `
        <p style="margin: 0 0 20px; font-size: 18px; font-weight: 500; color: #111827;">${greeting}</p>
        <p style="margin: 0 0 16px; color: #4B5563;">Your insurance document was <strong>rejected</strong>.</p>
        ${safeReason ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 24px; background: #FEF3C7; border-radius: 12px; border-left: 4px solid #F59E0B;"><tr><td style="padding: 16px 20px;"><p style="margin: 0; font-size: 14px; color: #92400E;"><strong>Reason:</strong> ${safeReason}</p></td></tr></table>` : ''}
        <p style="margin: 0 0 24px; color: #4B5563;">Please upload an updated document so you can continue offering services that require insurance.</p>
      `;

      await safeSend({
        to,
        subject,
        html: renderEmailLayout({
          title: subject,
          previewText,
          heading: 'Insurance rejected',
          subheading: 'Action required',
          bodyHtml,
          ctaText: 'Upload New Document',
          ctaUrl: insuranceUrl,
        }),
        text,
        category: 'insurance-status',
        senderType: 'support',
      });
    }
  },

  async sendContactNotification(name: string, fromEmail: string, subject: string, message: string) {
    const fullSubject = `Contact form: ${subject}`;
    const previewText = 'New contact form submission from your SpannerWork site.';
    const text = [
      'New contact form submission:',
      `Name: ${name}`,
      `Email: ${fromEmail}`,
      `Subject: ${subject}`,
      '',
      'Message:',
      message,
    ].join('\n');

    // Escape all user-provided content to prevent XSS
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(fromEmail);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br/>');

    const bodyHtml = `
      <p>New contact form submission:</p>
      <p><strong>Name:</strong> ${safeName}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p><strong>Subject:</strong> ${safeSubject}</p>
      <p><strong>Message:</strong></p>
      <p>${safeMessage}</p>
    `;

    await safeSend({
      to: env.EMAIL_FROM,
      replyTo: fromEmail,
      subject: fullSubject,
      html: renderEmailLayout({
        title: fullSubject,
        previewText,
        heading: 'New contact message',
        bodyHtml,
      }),
      text,
      category: 'contact-notification',
      senderType: 'support',
    });
  },

  async sendContactConfirmation(to: string, name: string) {
    const subject = 'We received your message';
    const previewText = 'Thanks for contacting SpannerWork. We will get back to you soon.';
    const greetingName = name || '';
    const text = [
      greetingName ? `Hi ${greetingName},` : 'Hi,',
      '',
      "Thanks for contacting SpannerWork. We've received your message and will get back to you soon.",
    ].join('\n');

    const bodyHtml = `
      <p>Hi ${greetingName || ''},</p>
      <p>Thanks for contacting SpannerWork. We've received your message and will get back to you soon.</p>
    `;

    await safeSend({
      to,
      subject,
      html: renderEmailLayout({
        title: subject,
        previewText,
        heading: 'Thanks for getting in touch',
        bodyHtml,
      }),
      text,
      category: 'contact-confirmation',
      senderType: 'support',
    });
  },

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(to: string, name: string | null) {
    const dashboardUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/feed`;
    const createListingUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/Create?intent=offer`;
    const profileUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/Profile`;
    
    const safeName = name ? escapeHtml(name) : '';
    const greeting = safeName ? `Welcome aboard, ${safeName}!` : 'Welcome aboard!';

    const subject = 'Welcome to SpannerWork! 🔧';
    const previewText = "You're in! Start finding tools, workspace, and skilled help in your local community.";
    const text = [
      greeting,
      '',
      "You've just joined a community of mechanics helping each other out.",
      '',
      'Here\'s what you can do:',
      '• Find specialist tools when you need them',
      '• Book workshop space with lifts and equipment',  
      '• Connect with skilled mechanics nearby',
      '• Earn money from your own tools and skills',
      '',
      `Get started: ${dashboardUrl}`,
      '',
      '- The SpannerWork Team',
    ].join('\n');

    const bodyHtml = `
      <p style="margin: 0 0 20px; font-size: 18px; font-weight: 500; color: #111827;">${greeting}</p>
      
      <p style="margin: 0 0 24px; color: #4B5563;">
        You've just joined a community of mechanics helping each other out. Whether you need a specialist tool, workshop space, or expert help — we've got you covered.
      </p>
      
      <!-- Feature Grid -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 28px;">
        <tr>
          <td style="padding: 16px; background: #FFF8F6; border-radius: 12px; vertical-align: top;" width="50%">
            <p style="margin: 0 0 4px; font-size: 20px;">🔧</p>
            <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #111827;">Find Tools</p>
            <p style="margin: 0; font-size: 13px; color: #6B7280;">Specialist equipment when you need it</p>
          </td>
          <td style="width: 12px;"></td>
          <td style="padding: 16px; background: #FFF8F6; border-radius: 12px; vertical-align: top;" width="50%">
            <p style="margin: 0 0 4px; font-size: 20px;">🏭</p>
            <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #111827;">Book Space</p>
            <p style="margin: 0; font-size: 13px; color: #6B7280;">Lifts, bays, and workshop access</p>
          </td>
        </tr>
        <tr><td colspan="3" style="height: 12px;"></td></tr>
        <tr>
          <td style="padding: 16px; background: #FFF8F6; border-radius: 12px; vertical-align: top;" width="50%">
            <p style="margin: 0 0 4px; font-size: 20px;">👨‍🔧</p>
            <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #111827;">Get Help</p>
            <p style="margin: 0; font-size: 13px; color: #6B7280;">Skilled mechanics in your area</p>
          </td>
          <td style="width: 12px;"></td>
          <td style="padding: 16px; background: #FFF8F6; border-radius: 12px; vertical-align: top;" width="50%">
            <p style="margin: 0 0 4px; font-size: 20px;">💰</p>
            <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #111827;">Earn Money</p>
            <p style="margin: 0; font-size: 13px; color: #6B7280;">Rent out your tools and skills</p>
          </td>
        </tr>
      </table>
      
      <!-- Next Steps -->
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 24px; background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%); border-radius: 12px; border-left: 4px solid #10B981;">
        <tr>
          <td style="padding: 16px 20px;">
            <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #065F46;">🎯 Next Step: Complete Your Profile</p>
            <p style="margin: 0; font-size: 13px; color: #047857;">
              <a href="${profileUrl}" style="color: #047857; text-decoration: underline;">Add your postcode and verify your account</a> to see what's available near you.
            </p>
          </td>
        </tr>
      </table>
      
      <p style="margin: 0; text-align: center; font-size: 14px; color: #6B7280;">
        Ready to earn? <a href="${createListingUrl}" style="color: #C43B12; font-weight: 500;">List your first tool or service →</a>
      </p>
    `;

    await safeSend({
      to,
      subject,
      html: renderEmailLayout({
        title: subject,
        previewText,
        heading: "You're In! 🎉",
        subheading: 'Welcome to the SpannerWork community',
        bodyHtml,
        ctaText: 'Browse Listings',
        ctaUrl: dashboardUrl,
      }),
      text,
      category: 'welcome',
    });
  },

  /**
   * Send booking confirmation email
   */
  async sendBookingConfirmationEmail(
    to: string,
    data: {
      userName: string | null;
      resourceName: string;
      resourceType: 'tool' | 'space' | 'service';
      startDate: Date;
      endDate: Date;
      totalAmount: number; // in pence
      transactionId: string;
    }
  ) {
    const transactionUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/transactions/${data.transactionId}`;
    const safeName = data.userName ? escapeHtml(data.userName) : '';
    const safeResourceName = escapeHtml(data.resourceName);
    const greeting = safeName ? `Hi ${safeName},` : 'Hi,';
    
    const formatDate = (date: Date) => date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    
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
      `View booking: ${transactionUrl}`,
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
        <a href="${transactionUrl}" class="button-primary">View booking details</a>
      </p>
      <p style="font-size: 13px; color: #6b7280;">Remember to coordinate pickup/delivery details with the provider through SpannerWork messages.</p>
    `;

    await safeSend({
      to,
      subject,
      html: renderEmailLayout({
        title: subject,
        previewText,
        heading: 'Booking Confirmed',
        bodyHtml,
      }),
      text,
      category: 'booking-confirmation',
    });
  },

  /**
   * Send booking cancellation email
   */
  async sendBookingCancellationEmail(
    to: string,
    data: {
      userName: string | null;
      resourceName: string;
      resourceType: 'tool' | 'space' | 'service';
      startDate: Date;
      endDate: Date;
      cancelledBy: 'user' | 'provider';
      transactionId: string;
    }
  ) {
    const transactionUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/transactions/${data.transactionId}`;
    const searchUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/feed`;
    const safeName = data.userName ? escapeHtml(data.userName) : '';
    const safeResourceName = escapeHtml(data.resourceName);
    const greeting = safeName ? `Hi ${safeName},` : 'Hi,';
    
    const formatDate = (date: Date) => date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    
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
      `View details: ${transactionUrl}`,
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
        <a href="${transactionUrl}" class="button-primary">View details</a>
      </p>
      <p>Need to find an alternative? <a href="${searchUrl}">Search for similar items</a> on SpannerWork.</p>
    `;

    await safeSend({
      to,
      subject,
      html: renderEmailLayout({
        title: subject,
        previewText,
        heading: 'Booking Cancelled',
        bodyHtml,
      }),
      text,
      category: 'booking-cancellation',
    });
  },

  async sendReferralInvitation(to: string, referrerName: string | null, referralCode: string) {
    const signupUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/signup?ref=${encodeURIComponent(
      referralCode,
    )}`;

    const subject = `${referrerName || 'A friend'} invited you to SpannerWork`;
    const previewText = 'Join SpannerWork and claim your referral invitation.';
    const text = [
      `${referrerName || 'A friend'} has invited you to join SpannerWork.`,
      '',
      `Your referral code: ${referralCode}`,
      `Sign up link: ${signupUrl}`,
    ].join('\n');

    const bodyHtml = `
      <p>${referrerName || 'A friend'} has invited you to join SpannerWork.</p>
      <p>Your referral code: <strong>${referralCode}</strong></p>
      <p style="margin: 20px 0;">
        <a href="${signupUrl}" class="button-primary">Sign up to SpannerWork</a>
      </p>
      <p style="font-size: 13px; color: #6b7280;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <a href="${signupUrl}">${signupUrl}</a>
      </p>
    `;

    await safeSend({
      to,
      subject,
      html: renderEmailLayout({
        title: subject,
        previewText,
        heading: 'You have been invited to SpannerWork',
        bodyHtml,
      }),
      text,
      category: 'referral-invitation',
      senderType: 'sales',
    });
  },

  /**
   * Send payment failed notification
   */
  async sendPaymentFailedEmail(
    to: string,
    data: {
      userName: string | null;
      transactionId: string;
      amount: number; // in pence
      errorMessage: string;
    }
  ) {
    const transactionUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/transactions/${data.transactionId}`;
    const safeName = data.userName ? escapeHtml(data.userName) : '';
    const safeError = escapeHtml(data.errorMessage);
    const greeting = safeName ? `Hi ${safeName},` : 'Hi,';
    const formattedAmount = `£${(data.amount / 100).toFixed(2)}`;

    const subject = 'Payment failed for your booking';
    const previewText = 'Your payment could not be processed. Please try again.';
    const text = [
      greeting,
      '',
      `Your payment of ${formattedAmount} could not be processed.`,
      '',
      `Error: ${data.errorMessage}`,
      '',
      'Please try again or use a different payment method.',
      '',
      `View booking: ${transactionUrl}`,
    ].join('\n');

    const bodyHtml = `
      <p>${greeting}</p>
      <p>Unfortunately, your payment of <strong>${formattedAmount}</strong> could not be processed.</p>
      <div style="margin: 20px 0; padding: 16px; background-color: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444;">
        <p style="margin: 0;"><strong>Error:</strong> ${safeError}</p>
      </div>
      <p>Please try again or use a different payment method to complete your booking.</p>
      <p style="margin: 24px 0;">
        <a href="${transactionUrl}" class="button-primary">Retry Payment</a>
      </p>
    `;

    await safeSend({
      to,
      subject,
      html: renderEmailLayout({
        title: subject,
        previewText,
        heading: 'Payment Failed',
        bodyHtml,
      }),
      text,
      category: 'payment-failed',
      senderType: 'support',
    });
  },

  /**
   * Send Stripe account issue notification
   */
  async sendStripeAccountIssueEmail(
    to: string,
    data: {
      userName: string | null;
      issue: string;
      requirements: string[];
    }
  ) {
    const dashboardUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/provider/dashboard`;
    const safeName = data.userName ? escapeHtml(data.userName) : '';
    const safeIssue = escapeHtml(data.issue);
    const greeting = safeName ? `Hi ${safeName},` : 'Hi,';

    const subject = 'Action required: Your payment account needs attention';
    const previewText = 'Your Stripe payment account requires attention to continue receiving payments.';
    const text = [
      greeting,
      '',
      'Your payment account requires attention to continue receiving payments.',
      '',
      `Issue: ${data.issue}`,
      '',
      data.requirements.length > 0 ? `Requirements: ${data.requirements.join(', ')}` : '',
      '',
      `Update your account: ${dashboardUrl}`,
    ].filter(Boolean).join('\n');

    const requirementsList = data.requirements.length > 0
      ? `<ul style="margin: 12px 0; padding-left: 20px;">${data.requirements.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>`
      : '';

    const bodyHtml = `
      <p>${greeting}</p>
      <p>Your payment account requires attention to continue receiving payments from SpannerWork.</p>
      <div style="margin: 20px 0; padding: 16px; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <p style="margin: 0 0 8px;"><strong>Issue:</strong> ${safeIssue}</p>
        ${requirementsList}
      </div>
      <p>Please update your payment account details to avoid any interruption to your earnings.</p>
      <p style="margin: 24px 0;">
        <a href="${dashboardUrl}" class="button-primary">Update Account</a>
      </p>
    `;

    await safeSend({
      to,
      subject,
      html: renderEmailLayout({
        title: subject,
        previewText,
        heading: 'Payment Account Needs Attention',
        bodyHtml,
      }),
      text,
      category: 'stripe-account-issue',
      senderType: 'support',
    });
  },

  /**
   * Send refund confirmation to customer
   */
  async sendRefundConfirmationEmail(
    to: string,
    data: {
      userName: string | null;
      transactionId: string;
      amount: number; // in pence
    }
  ) {
    const transactionUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/transactions/${data.transactionId}`;
    const safeName = data.userName ? escapeHtml(data.userName) : '';
    const greeting = safeName ? `Hi ${safeName},` : 'Hi,';
    const formattedAmount = `£${(data.amount / 100).toFixed(2)}`;

    const subject = 'Your refund has been processed';
    const previewText = `A refund of ${formattedAmount} has been processed for your booking.`;
    const text = [
      greeting,
      '',
      `A refund of ${formattedAmount} has been processed for your booking.`,
      '',
      'The refund should appear in your account within 5-10 business days, depending on your bank.',
      '',
      `View details: ${transactionUrl}`,
    ].join('\n');

    const bodyHtml = `
      <p>${greeting}</p>
      <p>A refund of <strong>${formattedAmount}</strong> has been processed for your booking.</p>
      <div style="margin: 20px 0; padding: 16px; background-color: #ecfdf5; border-radius: 8px; border-left: 4px solid #10b981;">
        <p style="margin: 0;"><strong>Refund amount:</strong> ${formattedAmount}</p>
      </div>
      <p>The refund should appear in your account within 5-10 business days, depending on your bank.</p>
      <p style="margin: 24px 0;">
        <a href="${transactionUrl}" class="button-primary">View Transaction</a>
      </p>
    `;

    await safeSend({
      to,
      subject,
      html: renderEmailLayout({
        title: subject,
        previewText,
        heading: 'Refund Processed',
        bodyHtml,
      }),
      text,
      category: 'refund-confirmation',
      senderType: 'support',
    });
  },

  /**
   * Send refund notification to provider
   */
  async sendRefundNotificationToProviderEmail(
    to: string,
    data: {
      providerName: string | null;
      transactionId: string;
      amount: number; // in pence
    }
  ) {
    const transactionUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/transactions/${data.transactionId}`;
    const safeName = data.providerName ? escapeHtml(data.providerName) : '';
    const greeting = safeName ? `Hi ${safeName},` : 'Hi,';
    const formattedAmount = `£${(data.amount / 100).toFixed(2)}`;

    const subject = 'A refund has been issued for a booking';
    const previewText = `A refund of ${formattedAmount} has been issued for one of your bookings.`;
    const text = [
      greeting,
      '',
      `A refund of ${formattedAmount} has been issued for one of your bookings.`,
      '',
      'The corresponding amount will be deducted from your next payout.',
      '',
      `View details: ${transactionUrl}`,
    ].join('\n');

    const bodyHtml = `
      <p>${greeting}</p>
      <p>A refund of <strong>${formattedAmount}</strong> has been issued for one of your bookings.</p>
      <div style="margin: 20px 0; padding: 16px; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <p style="margin: 0;"><strong>Refund amount:</strong> ${formattedAmount}</p>
      </div>
      <p>The corresponding amount will be deducted from your next payout.</p>
      <p style="margin: 24px 0;">
        <a href="${transactionUrl}" class="button-primary">View Transaction</a>
      </p>
    `;

    await safeSend({
      to,
      subject,
      html: renderEmailLayout({
        title: subject,
        previewText,
        heading: 'Refund Issued',
        bodyHtml,
      }),
      text,
      category: 'refund-notification-provider',
      senderType: 'support',
    });
  },

  /**
   * Send dispute alert to admin
   */
  async sendDisputeAlertEmail(
    to: string,
    data: {
      adminName: string | null;
      disputeId: string;
      chargeId: string;
      amount: number; // in pence
      reason: string;
      transactionId?: string;
      customerEmail?: string;
      providerEmail?: string;
      evidenceDueBy?: Date;
    }
  ) {
    const adminUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/admin`;
    const safeName = data.adminName ? escapeHtml(data.adminName) : '';
    const safeReason = escapeHtml(data.reason);
    const greeting = safeName ? `Hi ${safeName},` : 'Hi Admin,';
    const formattedAmount = `£${(data.amount / 100).toFixed(2)}`;
    const evidenceDue = data.evidenceDueBy
      ? data.evidenceDueBy.toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'Unknown';

    const subject = `⚠️ URGENT: Payment dispute received - ${formattedAmount}`;
    const previewText = `A payment dispute has been filed for ${formattedAmount}. Evidence due by ${evidenceDue}.`;
    const text = [
      greeting,
      '',
      `A payment dispute has been filed for ${formattedAmount}.`,
      '',
      `Dispute ID: ${data.disputeId}`,
      `Charge ID: ${data.chargeId}`,
      `Reason: ${data.reason}`,
      `Amount: ${formattedAmount}`,
      data.transactionId ? `Transaction: ${data.transactionId}` : '',
      data.customerEmail ? `Customer: ${data.customerEmail}` : '',
      data.providerEmail ? `Provider: ${data.providerEmail}` : '',
      '',
      `Evidence due by: ${evidenceDue}`,
      '',
      'Please respond to this dispute in the Stripe Dashboard immediately.',
    ].filter(Boolean).join('\n');

    const bodyHtml = `
      <p>${greeting}</p>
      <p><strong>A payment dispute has been filed and requires immediate attention.</strong></p>
      <div style="margin: 20px 0; padding: 16px; background-color: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444;">
        <p style="margin: 0 0 8px;"><strong>Dispute ID:</strong> ${escapeHtml(data.disputeId)}</p>
        <p style="margin: 0 0 8px;"><strong>Charge ID:</strong> ${escapeHtml(data.chargeId)}</p>
        <p style="margin: 0 0 8px;"><strong>Reason:</strong> ${safeReason}</p>
        <p style="margin: 0 0 8px;"><strong>Amount:</strong> ${formattedAmount}</p>
        ${data.transactionId ? `<p style="margin: 0 0 8px;"><strong>Transaction:</strong> ${escapeHtml(data.transactionId)}</p>` : ''}
        ${data.customerEmail ? `<p style="margin: 0 0 8px;"><strong>Customer:</strong> ${escapeHtml(data.customerEmail)}</p>` : ''}
        ${data.providerEmail ? `<p style="margin: 0;"><strong>Provider:</strong> ${escapeHtml(data.providerEmail)}</p>` : ''}
      </div>
      <div style="margin: 20px 0; padding: 16px; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <p style="margin: 0;"><strong>⏰ Evidence due by:</strong> ${evidenceDue}</p>
      </div>
      <p>Please respond to this dispute in the Stripe Dashboard immediately to avoid automatic loss.</p>
      <p style="margin: 24px 0;">
        <a href="${adminUrl}" class="button-primary">Go to Admin Panel</a>
      </p>
    `;

    await safeSend({
      to,
      subject,
      html: renderEmailLayout({
        title: subject,
        previewText,
        heading: '⚠️ Payment Dispute Alert',
        bodyHtml,
      }),
      text,
      category: 'dispute-alert',
      senderType: 'support',
    });
  },

  /**
   * Send insurance expiry reminder to provider
   */
  async sendInsuranceExpiryReminderEmail(
    to: string,
    data: {
      userName: string | null;
      documentType: string;
      expiryDate: Date;
      daysUntilExpiry: number;
    }
  ) {
    const insuranceUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/verification`;

    const safeName = data.userName ? escapeHtml(data.userName) : '';
    const greeting = safeName ? `Hi ${safeName},` : 'Hi,';
    const formattedDate = data.expiryDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const urgencyColor = data.daysUntilExpiry <= 7 ? '#ef4444' : '#f59e0b';
    const urgencyBg = data.daysUntilExpiry <= 7 ? '#fef2f2' : '#fef3c7';

    const subject = data.daysUntilExpiry <= 7
      ? `⚠️ Urgent: Your insurance expires in ${data.daysUntilExpiry} days`
      : `Reminder: Your insurance expires on ${formattedDate}`;

    const previewText = `Your ${data.documentType.replace(/_/g, ' ').toLowerCase()} insurance will expire soon. Update it to continue offering services.`;

    const text = [
      greeting,
      '',
      `Your ${data.documentType.replace(/_/g, ' ').toLowerCase()} insurance will expire on ${formattedDate} (in ${data.daysUntilExpiry} days).`,
      '',
      'To continue offering services on SpannerWork, please upload your new insurance certificate before it expires.',
      '',
      `Update your insurance: ${insuranceUrl}`,
      '',
      'If you have already renewed your insurance, please upload the new certificate to keep your listings active.',
      '',
      'Best regards,',
      'The SpannerWork Team',
    ].join('\n');

    const bodyHtml = `
      <p>${greeting}</p>
      <div style="margin: 20px 0; padding: 16px; background-color: ${urgencyBg}; border-radius: 8px; border-left: 4px solid ${urgencyColor};">
        <p style="margin: 0 0 8px;"><strong>${data.daysUntilExpiry <= 7 ? '⚠️ ' : ''}Your ${escapeHtml(data.documentType.replace(/_/g, ' ').toLowerCase())} insurance will expire on ${formattedDate}</strong></p>
        <p style="margin: 0;">That's in <strong>${data.daysUntilExpiry} day${data.daysUntilExpiry === 1 ? '' : 's'}</strong>.</p>
      </div>
      <p>To continue offering services on SpannerWork, please upload your new insurance certificate before it expires.</p>
      <p style="margin: 24px 0;">
        <a href="${insuranceUrl}" class="button-primary">Update Insurance</a>
      </p>
      <p>If you have already renewed your insurance, please upload the new certificate to keep your listings active.</p>
    `;

    await safeSend({
      to,
      subject,
      html: renderEmailLayout({
        title: subject,
        previewText,
        heading: 'Insurance Renewal Reminder',
        bodyHtml,
      }),
      text,
      category: 'insurance-reminder',
      senderType: 'support',
    });
  },

  /**
   * Send generic notification email
   * Used by unified notification service for simple notifications
   */
  async sendNotificationEmail(to: string, userName: string, title: string, body: string) {
    const safeName = escapeHtml(userName);
    const safeTitle = escapeHtml(title);
    const safeBody = escapeHtml(body);
    const greeting = safeName ? `Hi ${safeName},` : 'Hi,';
    const dashboardUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/feed`;

    const subject = title;
    const previewText = body.length > 100 ? body.slice(0, 97) + '...' : body;

    const text = [
      greeting,
      '',
      body,
      '',
      'Best regards,',
      'The SpannerWork Team',
    ].join('\n');

    const bodyHtml = `
      <p>${greeting}</p>
      <p>${safeBody}</p>
    `;

    await safeSend({
      to,
      subject,
      html: renderEmailLayout({
        title: safeTitle,
        previewText,
        heading: safeTitle,
        bodyHtml,
        ctaText: 'Go to SpannerWork',
        ctaUrl: dashboardUrl,
      }),
      text,
      category: 'notification',
    });
  },

  /**
   * Send booking reminder email
   * Sent 24 hours before a booking to both provider and seeker
   */
  async sendBookingReminderEmail(to: string, data: BookingReminderData) {
    const { subject, html } = generateBookingReminderEmail(data);

    const text = [
      `Hi ${data.recipientName},`,
      '',
      `Reminder: Your booking for ${data.resourceName} is tomorrow.`,
      `${data.isProvider ? 'Customer' : 'Provider'}: ${data.otherPartyName}`,
      `Date: ${data.bookingDate}${data.bookingTime ? ` at ${data.bookingTime}` : ''}`,
      data.location ? `Location: ${data.location}` : '',
      '',
      `View booking: ${data.viewBookingUrl}`,
      '',
      'Best regards,',
      'The SpannerWork Team',
    ].filter(Boolean).join('\n');

    await safeSend({
      to,
      subject,
      html,
      text,
      category: 'booking-reminder',
    });
  },

  /**
   * Send review request email
   * Sent after a booking is completed to request a review
   */
  async sendReviewRequestEmail(to: string, data: ReviewRequestData) {
    const { subject, html } = generateReviewRequestEmail(data);

    const text = [
      `Hi ${data.recipientName},`,
      '',
      `How was your experience with ${data.otherPartyName}?`,
      `Your booking for ${data.resourceName} has been completed.`,
      '',
      `We'd love to hear how it went. Leave a review to help others in the community.`,
      '',
      `Write your review: ${data.reviewUrl}`,
      '',
      'Best regards,',
      'The SpannerWork Team',
    ].join('\n');

    await safeSend({
      to,
      subject,
      html,
      text,
      category: 'review-request',
    });
  },

  /**
   * Send payout completed email
   * Sent to providers when their payout has been processed
   */
  async sendPayoutCompletedEmail(to: string, data: PayoutCompletedData) {
    const { subject, html } = generatePayoutCompletedEmail(data);

    const text = [
      `Hi ${data.recipientName},`,
      '',
      `Great news! Your payout of ${data.currency}${data.payoutAmount} has been processed.`,
      '',
      `Payout Date: ${data.payoutDate}`,
      data.bankLast4 ? `Bank Account: ****${data.bankLast4}` : '',
      `Bookings Included: ${data.transactionCount}`,
      `Period: ${data.periodStart} - ${data.periodEnd}`,
      '',
      `Payouts typically arrive within 2-3 business days.`,
      '',
      `View your earnings: ${data.earningsUrl}`,
      '',
      'Best regards,',
      'The SpannerWork Team',
    ].filter(Boolean).join('\n');

    await safeSend({
      to,
      subject,
      html,
      text,
      category: 'payout',
    });
  },

  /**
   * Send weekly earnings summary email
   * Sent to providers with a summary of their weekly activity
   */
  async sendWeeklyEarningsSummaryEmail(to: string, data: WeeklyEarningsSummaryData) {
    const { subject, html } = generateWeeklyEarningsSummaryEmail(data);

    const text = [
      `Hi ${data.recipientName},`,
      '',
      `Here's your SpannerWork activity for ${data.weekStart} - ${data.weekEnd}:`,
      '',
      `Earnings: ${data.currency}${data.totalEarnings}`,
      `Bookings: ${data.totalBookings}`,
      `Pending Payouts: ${data.currency}${data.pendingPayouts}`,
      `Upcoming Bookings: ${data.upcomingBookings}`,
      data.averageRating ? `Your Rating: ${data.averageRating.toFixed(1)} stars` : '',
      '',
      data.topPerformingListing
        ? `Top Listing: ${data.topPerformingListing.name} (${data.currency}${data.topPerformingListing.earnings})`
        : '',
      '',
      `View your dashboard: ${data.dashboardUrl}`,
      '',
      'Best regards,',
      'The SpannerWork Team',
    ].filter(Boolean).join('\n');

    await safeSend({
      to,
      subject,
      html,
      text,
      category: 'weekly-summary',
    });
  },

  /**
   * Send rate limit alert to admins
   * Sent when a user hits the rate limit and lands on the rate limit page
   */
  async sendRateLimitAlertEmail(
    to: string,
    data: {
      timestamp: string;
      returnPath: string;
      userAgent?: string;
      ip?: string;
      userId?: string;
      userEmail?: string;
    }
  ) {
    const adminUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/admin`;
    const safeReturnPath = escapeHtml(data.returnPath);
    const safeUserAgent = data.userAgent ? escapeHtml(data.userAgent) : 'Unknown';
    const safeIp = data.ip ? escapeHtml(data.ip) : 'Unknown';
    const safeUserId = data.userId ? escapeHtml(data.userId) : 'Not logged in';
    const safeUserEmail = data.userEmail ? escapeHtml(data.userEmail) : 'Unknown';

    const subject = '⚠️ Rate Limit Alert: User hit rate limit';
    const previewText = 'A user has hit the API rate limit and landed on the rate limit page.';

    const text = [
      'Rate Limit Alert',
      '',
      'A user has hit the API rate limit.',
      '',
      `Timestamp: ${data.timestamp}`,
      `Path: ${data.returnPath}`,
      `IP: ${data.ip || 'Unknown'}`,
      `User ID: ${data.userId || 'Not logged in'}`,
      `User Email: ${data.userEmail || 'Unknown'}`,
      `User Agent: ${data.userAgent || 'Unknown'}`,
      '',
      'This could indicate:',
      '- Legitimate heavy usage',
      '- Polling intervals too short',
      '- Potential abuse',
      '',
      'Please review the system metrics for more details.',
    ].join('\n');

    const bodyHtml = `
      <p><strong>A user has hit the API rate limit and landed on the rate limit page.</strong></p>
      <div style="margin: 20px 0; padding: 16px; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <p style="margin: 0 0 8px;"><strong>Timestamp:</strong> ${escapeHtml(data.timestamp)}</p>
        <p style="margin: 0 0 8px;"><strong>Path:</strong> ${safeReturnPath}</p>
        <p style="margin: 0 0 8px;"><strong>IP:</strong> ${safeIp}</p>
        <p style="margin: 0 0 8px;"><strong>User ID:</strong> ${safeUserId}</p>
        <p style="margin: 0 0 8px;"><strong>User Email:</strong> ${safeUserEmail}</p>
        <p style="margin: 0;"><strong>User Agent:</strong> ${safeUserAgent}</p>
      </div>
      <p>This could indicate:</p>
      <ul style="margin: 12px 0; padding-left: 20px;">
        <li>Legitimate heavy usage</li>
        <li>Polling intervals too short in the frontend</li>
        <li>Potential abuse or scraping</li>
      </ul>
      <p>Please review the system metrics for more details.</p>
      <p style="margin: 24px 0;">
        <a href="${adminUrl}" class="button-primary">View Admin Panel</a>
      </p>
    `;

    await safeSend({
      to,
      subject,
      html: renderEmailLayout({
        title: subject,
        previewText,
        heading: '⚠️ Rate Limit Alert',
        bodyHtml,
      }),
      text,
      category: 'rate-limit-alert',
      senderType: 'support',
    });
  },

  /**
   * Send team invitation email for B2B trade accounts
   */
  async sendTeamInvitation(data: {
    to: string;
    invitedByName: string;
    companyName: string;
    acceptUrl: string;
  }) {
    const subject = `You've been invited to join ${escapeHtml(data.companyName)} on SpannerWork`;
    const previewText = `${data.invitedByName} has invited you to join their trade account`;

    const text = [
      `You've been invited to join ${data.companyName}`,
      '',
      `${data.invitedByName} has invited you to join their trade account on SpannerWork.`,
      '',
      'As a team member, you can:',
      '- Book tools, spaces, and services on behalf of the company',
      '- View shared transaction history',
      '- Access team invoices',
      '',
      `Accept the invitation: ${data.acceptUrl}`,
      '',
      'This invitation will expire in 7 days.',
    ].join('\n');

    const bodyHtml = `
      <p><strong>${escapeHtml(data.invitedByName)}</strong> has invited you to join <strong>${escapeHtml(data.companyName)}</strong> on SpannerWork.</p>
      <div style="margin: 20px 0; padding: 16px; background-color: #f0fdf4; border-radius: 8px; border-left: 4px solid #22c55e;">
        <p style="margin: 0 0 12px; font-weight: 600;">As a team member, you can:</p>
        <ul style="margin: 0; padding-left: 20px;">
          <li>Book tools, spaces, and services on behalf of the company</li>
          <li>View shared transaction history</li>
          <li>Access team invoices</li>
        </ul>
      </div>
      <p style="margin: 24px 0;">
        <a href="${escapeHtml(data.acceptUrl)}" class="button-primary">Accept Invitation</a>
      </p>
      <p style="color: #666; font-size: 14px;">This invitation will expire in 7 days.</p>
    `;

    await safeSend({
      to: data.to,
      subject,
      html: renderEmailLayout({
        title: subject,
        previewText,
        heading: '🤝 Team Invitation',
        bodyHtml,
      }),
      text,
      category: 'team-invitation',
    });
  },

  /**
   * Send escrow auto-completed email
   * Notifies customer when payment was auto-captured due to no action
   */
  async sendEscrowAutoCompletedEmail(to: string, data: {
    userName?: string | null;
    resourceName: string;
    transactionId: string;
    amount: number;
  }) {
    const safeName = escapeHtml(data.userName || 'User');
    const safeResourceName = escapeHtml(data.resourceName);
    const formattedAmount = `£${(data.amount / 100).toFixed(2)}`;
    const transactionUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/transactions/${data.transactionId}`;

    const subject = 'Your booking has been auto-completed';
    const previewText = `Payment of ${formattedAmount} has been released for your booking`;

    const text = [
      `Hi ${data.userName || 'User'},`,
      '',
      `Your booking for "${data.resourceName}" has been automatically completed.`,
      '',
      `Since no action was taken within the review period, the payment of ${formattedAmount} has been released to the provider.`,
      '',
      `View transaction: ${transactionUrl}`,
      '',
      'Best regards,',
      'The SpannerWork Team',
    ].join('\n');

    const bodyHtml = `
      <p>Hi ${safeName},</p>
      <p>Your booking for <strong>${safeResourceName}</strong> has been automatically completed.</p>
      <div style="margin: 20px 0; padding: 16px; background-color: #f0fdf4; border-radius: 8px; border-left: 4px solid #22c55e;">
        <p style="margin: 0;">Since no action was taken within the review period, the payment of <strong>${formattedAmount}</strong> has been released to the provider.</p>
      </div>
      <p>If you experienced any issues with this booking, please contact support within 48 hours.</p>
    `;

    await safeSend({
      to,
      subject,
      html: renderEmailLayout({
        title: subject,
        previewText,
        heading: '✅ Booking Auto-Completed',
        bodyHtml,
        ctaText: 'View Transaction',
        ctaUrl: transactionUrl,
      }),
      text,
      category: 'escrow-auto-completed',
    });
  },

  /**
   * Send payment released email
   * Notifies provider when payment has been released to them
   */
  async sendPaymentReleasedEmail(to: string, data: {
    providerName?: string | null;
    resourceName: string;
    transactionId: string;
    amount: number;
  }) {
    const safeName = escapeHtml(data.providerName || 'Provider');
    const safeResourceName = escapeHtml(data.resourceName);
    const formattedAmount = `£${(data.amount / 100).toFixed(2)}`;
    const transactionUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/transactions/${data.transactionId}`;

    const subject = `Payment of ${formattedAmount} has been released`;
    const previewText = `Your payment for ${data.resourceName} is on its way`;

    const text = [
      `Hi ${data.providerName || 'Provider'},`,
      '',
      `Great news! Payment of ${formattedAmount} for "${data.resourceName}" has been released to your account.`,
      '',
      'The funds will be available in your connected bank account within 2-7 business days.',
      '',
      `View transaction: ${transactionUrl}`,
      '',
      'Best regards,',
      'The SpannerWork Team',
    ].join('\n');

    const bodyHtml = `
      <p>Hi ${safeName},</p>
      <p>Great news! Payment of <strong>${formattedAmount}</strong> for <strong>${safeResourceName}</strong> has been released to your account.</p>
      <div style="margin: 20px 0; padding: 16px; background-color: #f0fdf4; border-radius: 8px; border-left: 4px solid #22c55e;">
        <p style="margin: 0;">The funds will be available in your connected bank account within 2-7 business days.</p>
      </div>
    `;

    await safeSend({
      to,
      subject,
      html: renderEmailLayout({
        title: subject,
        previewText,
        heading: '💰 Payment Released',
        bodyHtml,
        ctaText: 'View Transaction',
        ctaUrl: transactionUrl,
      }),
      text,
      category: 'payment-released',
    });
  },

  /**
   * Send escrow expiry reminder email (48h warning)
   */
  async sendEscrowExpiryReminderEmail(to: string, data: {
    userName?: string | null;
    resourceName: string;
    transactionId: string;
    hoursRemaining: number;
    providerName: string;
  }) {
    const safeName = escapeHtml(data.userName || 'User');
    const safeResourceName = escapeHtml(data.resourceName);
    const safeProviderName = escapeHtml(data.providerName);
    const transactionUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/transactions/${data.transactionId}`;

    const subject = `Action required: Review your booking within ${Math.round(data.hoursRemaining)} hours`;
    const previewText = `Your booking payment will be auto-released soon`;

    const text = [
      `Hi ${data.userName || 'User'},`,
      '',
      `Reminder: Your booking for "${data.resourceName}" with ${data.providerName} is awaiting your review.`,
      '',
      `The payment will be automatically released to the provider in approximately ${Math.round(data.hoursRemaining)} hours unless you take action.`,
      '',
      'If everything went well, you can release the payment now.',
      'If there was an issue, please open a dispute before the deadline.',
      '',
      `Review booking: ${transactionUrl}`,
      '',
      'Best regards,',
      'The SpannerWork Team',
    ].join('\n');

    const bodyHtml = `
      <p>Hi ${safeName},</p>
      <p>Reminder: Your booking for <strong>${safeResourceName}</strong> with <strong>${safeProviderName}</strong> is awaiting your review.</p>
      <div style="margin: 20px 0; padding: 16px; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <p style="margin: 0;"><strong>⏰ ${Math.round(data.hoursRemaining)} hours remaining</strong></p>
        <p style="margin: 8px 0 0;">The payment will be automatically released to the provider unless you take action.</p>
      </div>
      <p><strong>If everything went well:</strong> Release the payment now</p>
      <p><strong>If there was an issue:</strong> Open a dispute before the deadline</p>
    `;

    await safeSend({
      to,
      subject,
      html: renderEmailLayout({
        title: subject,
        previewText,
        heading: '⏰ Payment Review Reminder',
        bodyHtml,
        ctaText: 'Review Booking',
        ctaUrl: transactionUrl,
      }),
      text,
      category: 'escrow-reminder',
    });
  },

  /**
   * Send urgent escrow expiry email (24h warning)
   */
  async sendEscrowExpiryUrgentEmail(to: string, data: {
    userName?: string | null;
    resourceName: string;
    transactionId: string;
    hoursRemaining: number;
    providerName: string;
  }) {
    const safeName = escapeHtml(data.userName || 'User');
    const safeResourceName = escapeHtml(data.resourceName);
    const safeProviderName = escapeHtml(data.providerName);
    const transactionUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/transactions/${data.transactionId}`;

    const subject = `URGENT: Only ${Math.round(data.hoursRemaining)} hours left to review your booking`;
    const previewText = `Your booking payment will be auto-released very soon`;

    const text = [
      `Hi ${data.userName || 'User'},`,
      '',
      `URGENT: Your booking for "${data.resourceName}" with ${data.providerName} needs your attention.`,
      '',
      `Only ${Math.round(data.hoursRemaining)} hours remain before the payment is automatically released.`,
      '',
      'Please review your booking now:',
      '- If satisfied, release the payment',
      '- If there was an issue, open a dispute immediately',
      '',
      `Review booking: ${transactionUrl}`,
      '',
      'Best regards,',
      'The SpannerWork Team',
    ].join('\n');

    const bodyHtml = `
      <p>Hi ${safeName},</p>
      <p><strong>URGENT:</strong> Your booking for <strong>${safeResourceName}</strong> with <strong>${safeProviderName}</strong> needs your attention.</p>
      <div style="margin: 20px 0; padding: 16px; background-color: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444;">
        <p style="margin: 0; font-size: 18px;"><strong>⚠️ Only ${Math.round(data.hoursRemaining)} hours remaining!</strong></p>
        <p style="margin: 8px 0 0;">The payment will be automatically released unless you take action.</p>
      </div>
      <p><strong>Please review your booking now:</strong></p>
      <ul>
        <li>If satisfied, release the payment</li>
        <li>If there was an issue, open a dispute immediately</li>
      </ul>
    `;

    await safeSend({
      to,
      subject,
      html: renderEmailLayout({
        title: subject,
        previewText,
        heading: '🚨 Urgent: Review Required',
        bodyHtml,
        ctaText: 'Review Now',
        ctaUrl: transactionUrl,
      }),
      text,
      category: 'escrow-urgent',
    });
  },

  /**
   * Send admin action notification email
   * Notifies users when an admin takes action on their account/transaction
   */
  async sendAdminActionNotificationEmail(to: string, data: {
    userName?: string | null;
    action: string;
    resourceType: string;
    resourceName: string;
    reason: string;
  }) {
    const safeName = escapeHtml(data.userName || 'User');
    const safeAction = escapeHtml(data.action);
    const safeResourceType = escapeHtml(data.resourceType);
    const safeResourceName = escapeHtml(data.resourceName);
    const safeReason = escapeHtml(data.reason);
    const dashboardUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/feed`;

    const subject = `Admin Action: ${data.action}`;
    const previewText = `An administrator has taken action on your ${data.resourceType}`;

    const text = [
      `Hi ${data.userName || 'User'},`,
      '',
      `An administrator has performed the following action:`,
      '',
      `Action: ${data.action}`,
      `Resource: ${data.resourceName} (${data.resourceType})`,
      '',
      `Details: ${data.reason}`,
      '',
      'If you have questions about this action, please contact support.',
      '',
      'Best regards,',
      'The SpannerWork Team',
    ].join('\n');

    const bodyHtml = `
      <p>Hi ${safeName},</p>
      <p>An administrator has performed the following action:</p>
      <div style="margin: 20px 0; padding: 16px; background-color: #f3f4f6; border-radius: 8px; border-left: 4px solid #6366f1;">
        <p style="margin: 0 0 8px;"><strong>Action:</strong> ${safeAction}</p>
        <p style="margin: 0 0 8px;"><strong>Resource:</strong> ${safeResourceName} (${safeResourceType})</p>
        <p style="margin: 0;"><strong>Details:</strong> ${safeReason}</p>
      </div>
      <p>If you have questions about this action, please contact support.</p>
    `;

    await safeSend({
      to,
      subject,
      html: renderEmailLayout({
        title: subject,
        previewText,
        heading: '🔔 Admin Action Notification',
        bodyHtml,
        ctaText: 'Go to SpannerWork',
        ctaUrl: dashboardUrl,
      }),
      text,
      category: 'admin-notification',
    });
  },
};
