/**
 * Email Templates Index
 * 
 * This module exports all email template functions.
 * Each template returns HTML content for a specific email type.
 */

export { passwordResetTemplate } from './password-reset.template.js';
export { emailVerificationTemplate } from './email-verification.template.js';
export { welcomeTemplate } from './welcome.template.js';
export { bookingConfirmationTemplate } from './booking-confirmation.template.js';
export { bookingCancellationTemplate } from './booking-cancellation.template.js';
export { newMessageTemplate } from './new-message.template.js';
export { reviewReceivedTemplate } from './review-received.template.js';
export { disputeUpdateTemplate } from './dispute-update.template.js';
export { paymentReceivedTemplate } from './payment-received.template.js';
export { referralInvitationTemplate } from './referral-invitation.template.js';

// Re-export the base layout renderer
export { renderEmailLayout, escapeHtml } from '../services/emailTemplates.js';
