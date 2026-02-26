import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../config/logger.js';
import { validate } from '../middleware/validate.middleware.js';
import { emailService } from '../services/email.service.js';
import { sanitizeUserContent } from '../utils/sanitize.js';

const router = Router();

// Contact form validation schema with XSS sanitization
const contactSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100)
    .transform((val) => sanitizeUserContent(val, 100)),
  email: z.string().email('Invalid email address').max(254),
  subject: z
    .string()
    .min(5, 'Subject must be at least 5 characters')
    .max(200)
    .transform((val) => sanitizeUserContent(val, 200)),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(5000)
    .transform((val) => sanitizeUserContent(val, 5000)),
});

/**
 * POST /api/v1/contact
 * Submit contact form
 * @public
 */
router.post('/', validate(contactSchema), async (req: Request, res: Response) => {
  try {
    const { name, email, subject, message } = req.body;

    // Log contact submission
    logger.info('Contact form submission:', {
      name,
      email,
      subject,
      timestamp: new Date().toISOString(),
    });

    // Production email side-effects (no-op if RESEND_API_KEY is not set)
    await emailService.sendContactNotification(name, email, subject, message);
    await emailService.sendContactConfirmation(email, name);

    res.status(200).json({
      success: true,
      message: 'Your message has been sent successfully. We will get back to you soon!',
      data: {
        name,
        email,
        subject,
        submittedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Contact form error:', error);
    res.status(500).json({
      error: 'Submission failed',
      message: 'Failed to send your message. Please try again later.',
    });
  }
});

export default router;
