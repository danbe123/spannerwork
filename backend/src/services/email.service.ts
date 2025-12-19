import { Resend } from 'resend';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { renderEmailLayout } from './emailTemplates.js';

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char]);
}

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
      <p style="margin: 0 0 24px; font-size: 12px; color: #D84315; word-break: break-all; text-align: center;">
        <a href="${resetUrl}" style="color: #D84315;">${resetUrl}</a>
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
        <a href="${verifyUrl}" style="color: #D84315;">${verifyUrl}</a>
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
        Ready to earn? <a href="${createListingUrl}" style="color: #D84315; font-weight: 500;">List your first tool or service →</a>
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
};
