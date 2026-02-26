import { prisma } from '../config/database.js';
import { InvoiceSettings } from '@prisma/client';
import { logger } from '../config/logger.js';

export interface UpdateInvoiceSettingsData {
  businessName?: string | null;
  logoUrl?: string | null;
  address?: string | null;
  city?: string | null;
  postcode?: string | null;
  country?: string | null;
  vatNumber?: string | null;
  vatRegistered?: boolean;
}

export class InvoiceSettingsService {
  /**
   * Get invoice settings for a user
   * Creates default settings if they don't exist
   */
  async get(userId: string): Promise<InvoiceSettings> {
    let settings = await prisma.invoiceSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      // Create default settings
      settings = await prisma.invoiceSettings.create({
        data: {
          userId,
          country: 'GB',
          vatRegistered: false,
        },
      });
      logger.info('Created default invoice settings', { userId });
    }

    return settings;
  }

  /**
   * Update invoice settings for a user
   */
  async update(userId: string, data: UpdateInvoiceSettingsData): Promise<InvoiceSettings> {
    // Ensure settings exist first
    await this.get(userId);

    // Validate VAT number format if provided (UK format: GB followed by 9 or 12 digits)
    if (data.vatNumber) {
      const vatRegex = /^GB[0-9]{9}([0-9]{3})?$/i;
      if (!vatRegex.test(data.vatNumber.replace(/\s/g, ''))) {
        // Don't throw error, just log - user might have non-UK VAT number
        logger.warn('Non-standard VAT number format', { userId, vatNumber: data.vatNumber });
      }
      // Normalize VAT number - remove spaces and uppercase
      data.vatNumber = data.vatNumber.replace(/\s/g, '').toUpperCase();
    }

    const updated = await prisma.invoiceSettings.update({
      where: { userId },
      data: {
        businessName: data.businessName,
        logoUrl: data.logoUrl,
        address: data.address,
        city: data.city,
        postcode: data.postcode?.toUpperCase(),
        country: data.country || 'GB',
        vatNumber: data.vatNumber,
        vatRegistered: data.vatRegistered ?? false,
      },
    });

    logger.info('Updated invoice settings', { userId });
    return updated;
  }

  /**
   * Check if a user has VAT registration
   */
  async isVatRegistered(userId: string): Promise<boolean> {
    const settings = await this.get(userId);
    return settings.vatRegistered && !!settings.vatNumber;
  }
}

export const invoiceSettingsService = new InvoiceSettingsService();
