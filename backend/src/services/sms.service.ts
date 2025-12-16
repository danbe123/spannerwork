import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { Buffer } from 'node:buffer';

const hasTwilioConfig =
  !!env.TWILIO_ACCOUNT_SID && !!env.TWILIO_AUTH_TOKEN && !!env.TWILIO_FROM_NUMBER;

/**
 * Mask phone number for safe logging
 * Example: +447123456789 -> +44***456789
 */
function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 6) return '***';
  // Keep first 3 chars and last 6 chars, mask the middle
  const prefix = phone.slice(0, 3);
  const suffix = phone.slice(-6);
  return `${prefix}***${suffix}`;
}

type SendSmsParams = {
  to: string;
  body: string;
};

/**
 * Validate and normalize phone number
 * Accepts UK formats: 07xxx, +447xxx, 447xxx
 * Returns E.164 format (+44...) or null if invalid
 */
function validatePhoneNumber(phone: string): string | null {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Handle UK mobile numbers
  if (cleaned.startsWith('07')) {
    // UK mobile starting with 07 - convert to +44
    cleaned = '+44' + cleaned.substring(1);
  } else if (cleaned.startsWith('447')) {
    // UK mobile without + prefix
    cleaned = '+' + cleaned;
  } else if (cleaned.startsWith('+447')) {
    // Already in correct format
  } else {
    // Allow other international numbers starting with +
    if (!cleaned.startsWith('+')) {
      return null;
    }
  }
  
  // Basic validation: E.164 should be 10-15 digits after +
  const digits = cleaned.replace('+', '');
  if (digits.length < 10 || digits.length > 15) {
    return null;
  }
  
  return cleaned;
}

async function sendSms({ to, body }: SendSmsParams) {
  // Development mode: log the SMS instead of sending it
  if (env.NODE_ENV === 'development') {
    // Mask phone number in logs to prevent PII exposure
    const maskedPhone = maskPhoneNumber(to);
    logger.info('📱 SMS (Development Mode - Not Sent)', {
      to: maskedPhone,
      message: body,
    });
    return;
  }

  if (!hasTwilioConfig) {
    logger.warn(
      'SMS send skipped: Twilio not fully configured (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER)',
    );
    return;
  }

  // Validate and normalize phone number
  const normalizedPhone = validatePhoneNumber(to);
  if (!normalizedPhone) {
    // Don't log the actual phone number to prevent PII exposure
    logger.warn('SMS send skipped: invalid phone number format');
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;

  const authString = `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`;
  const basicAuth = Buffer.from(authString, 'utf8').toString('base64');

  const bodyParams = new URLSearchParams({
    To: normalizedPhone,
    From: env.TWILIO_FROM_NUMBER!,
    Body: body,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams.toString(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.error('Twilio SMS send failed', {
        status: response.status,
        body: text,
      });
      return;
    }

    const data = (await response.json().catch(() => null)) as { sid?: string } | null;
    // Mask phone number in logs to prevent PII exposure
    logger.info('Twilio SMS sent', {
      sid: data?.sid,
      to: maskPhoneNumber(normalizedPhone),
    });
  } catch (error) {
    logger.error('Error sending SMS via Twilio', error);
  }
}

export const smsService = {
  sendSms,
};
