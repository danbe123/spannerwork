import { prisma } from '../config/database.js';
import { Invoice, InvoiceType, Transaction, Prisma } from '@prisma/client';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { logger } from '../config/logger.js';
import { invoiceSettingsService } from './invoiceSettings.service.js';
import PDFDocument from 'pdfkit';

const VAT_RATE = 0.20; // 20% UK VAT

export interface LineItem {
  description: string;
  quantity?: number;
  unitPrice?: number; // in pence (optional for fixed-price items)
  amount: number; // in pence
}

export interface InvoiceFilters {
  type?: InvoiceType;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface TaxSummary {
  year: number;
  totalIncome: number; // pence
  totalExpenses: number; // pence
  totalVatCollected: number; // pence
  totalVatPaid: number; // pence
  transactionCount: number;
  invoiceCount: number;
  byMonth: Array<{
    month: number;
    income: number;
    expenses: number;
    vatCollected: number;
    vatPaid: number;
  }>;
}

export class InvoiceService {
  /**
   * Generate a unique invoice number using atomic database operation
   * Format: INV-YYYY-NNNNN
   *
   * FIX #8: Uses dedicated invoice_sequences table to prevent race conditions
   * This ensures unique numbers even when no invoices exist for the year,
   * which the previous FOR UPDATE approach couldn't handle.
   */
  async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    // Use upsert with atomic increment to guarantee unique numbers
    // This handles the race condition where no invoices exist for the year
    const result = await prisma.$transaction(async (tx) => {
      // Use raw SQL with FOR UPDATE to lock the sequence row
      // If row doesn't exist, create it with value 0
      await tx.$executeRaw`
        INSERT INTO invoice_sequences (year, "lastNumber", "updatedAt")
        VALUES (${year}, 0, NOW())
        ON CONFLICT (year) DO NOTHING
      `;

      // Lock and increment atomically
      const sequences = await tx.$queryRaw<Array<{ lastNumber: number }>>`
        UPDATE invoice_sequences
        SET "lastNumber" = "lastNumber" + 1, "updatedAt" = NOW()
        WHERE year = ${year}
        RETURNING "lastNumber"
      `;

      if (sequences.length === 0) {
        // This should never happen given the upsert above, but handle it safely
        throw new Error('Failed to generate invoice number - sequence not found');
      }

      const nextNumber = sequences[0].lastNumber;
      return `${prefix}${nextNumber.toString().padStart(5, '0')}`;
    }, {
      isolationLevel: 'Serializable', // Strongest isolation to prevent any race conditions
    });

    return result;
  }

  /**
   * Calculate VAT breakdown
   */
  calculateVat(amountPence: number, includesVat: boolean = false): {
    net: number;
    vat: number;
    gross: number;
  } {
    if (includesVat) {
      // Amount includes VAT - extract it
      const gross = amountPence;
      const net = Math.round(amountPence / (1 + VAT_RATE));
      const vat = gross - net;
      return { net, vat, gross };
    } else {
      // Amount is net - add VAT
      const net = amountPence;
      const vat = Math.round(amountPence * VAT_RATE);
      const gross = net + vat;
      return { net, vat, gross };
    }
  }

  /**
   * Create an invoice for a transaction
   */
  async createForTransaction(
    transactionId: string,
    type: InvoiceType,
    userId: string,
    purchaseOrder?: string
  ): Promise<Invoice> {
    // Get the transaction with all related data
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        user: true,
        provider: true,
        tool: true,
        space: true,
        service: true,
        request: true,
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    // Check authorization
    if (type === 'RENTER' && transaction.userId !== userId) {
      throw new BadRequestError('You can only generate renter invoices for your own transactions');
    }
    if (type === 'PROVIDER' && transaction.providerId !== userId) {
      throw new BadRequestError('You can only generate provider invoices for transactions where you are the provider');
    }

    // Check if invoice already exists
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        transactionId,
        type,
        userId,
      },
    });

    if (existingInvoice) {
      logger.info('Returning existing invoice', { invoiceId: existingInvoice.id });
      return existingInvoice;
    }

    // Get invoice settings for the user
    const settings = await invoiceSettingsService.get(userId);

    // Build line items based on transaction type
    const lineItems = this.buildLineItems(transaction, type);

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

    // Only add VAT if the issuing user is VAT registered
    const isVatRegistered = settings.vatRegistered && !!settings.vatNumber;
    const vatAmount = isVatRegistered ? Math.round(subtotal * VAT_RATE) : 0;
    const totalAmount = subtotal + vatAmount;

    // Determine recipient info
    let recipientName: string;
    let recipientAddress: string | undefined;
    let recipientVat: string | undefined;

    if (type === 'RENTER') {
      // Renter invoice - recipient is the renter (user)
      recipientName = transaction.user.name || 'Customer';
      // Get renter's invoice settings if they have any
      const renterSettings = await prisma.invoiceSettings.findUnique({
        where: { userId: transaction.userId },
      });
      if (renterSettings) {
        recipientAddress = [renterSettings.address, renterSettings.city, renterSettings.postcode]
          .filter(Boolean)
          .join(', ');
        recipientVat = renterSettings.vatNumber || undefined;
      }
    } else {
      // Provider invoice - recipient is the provider
      recipientName = transaction.provider?.name || 'Provider';
      recipientAddress = [settings.address, settings.city, settings.postcode]
        .filter(Boolean)
        .join(', ');
      recipientVat = settings.vatNumber || undefined;
    }

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber();

    // Create the invoice
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        transactionId,
        userId,
        type,
        recipientName,
        recipientAddress,
        recipientVat,
        subtotal,
        vatAmount,
        totalAmount,
        lineItems: lineItems as unknown as Prisma.InputJsonValue,
        purchaseOrder: purchaseOrder || transaction.purchaseOrderNumber,
      },
    });

    logger.info('Created invoice', { invoiceId: invoice.id, type, transactionId });
    return invoice;
  }

  /**
   * Build line items for an invoice
   */
  private buildLineItems(
    transaction: Transaction & {
      tool?: { name: string; dailyRate: number } | null;
      space?: { name: string; dailyRate: number; hourlyRate: number } | null;
      service?: { name: string; hourlyRate: number } | null;
      request?: { title: string } | null;
    } & {
      // Sponsor fee fields (from Transaction model)
      providerSponsorCpaPercent?: number;
      providerSponsorCpaFee?: number;
      renterSponsorCpaPercent?: number;
      renterSponsorCpaFee?: number;
    },
    type: InvoiceType
  ): LineItem[] {
    const items: LineItem[] = [];
    const startDate = new Date(transaction.startDate);
    const endDate = new Date(transaction.endDate);
    const days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const hours = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)));

    if (type === 'RENTER') {
      // Customer invoice - they paid the full amount
      if (transaction.tool) {
        items.push({
          description: `Tool Rental: ${transaction.tool.name} (${days} day${days > 1 ? 's' : ''})`,
          quantity: days,
          unitPrice: transaction.tool.dailyRate,
          amount: transaction.rentalFee,
        });
      } else if (transaction.space) {
        items.push({
          description: `Space Rental: ${transaction.space.name} (${days} day${days > 1 ? 's' : ''})`,
          quantity: days,
          unitPrice: transaction.space.dailyRate,
          amount: transaction.rentalFee,
        });
      } else if (transaction.service) {
        items.push({
          description: `Service: ${transaction.service.name} (${hours} hour${hours > 1 ? 's' : ''})`,
          quantity: hours,
          unitPrice: transaction.service.hourlyRate,
          amount: transaction.rentalFee,
        });
      } else if (transaction.request) {
        items.push({
          description: `Request: ${transaction.request.title}`,
          amount: transaction.rentalFee,
        });
      }

      // Add platform fee for transparency
      if (transaction.platformFee > 0) {
        items.push({
          description: 'Platform Service Fee',
          amount: transaction.platformFee,
        });
      }

      // Add insurance fees if selected
      if (transaction.insuranceDamageProtectionSelected && transaction.insuranceDamageProtectionFee > 0) {
        items.push({
          description: 'Damage Protection Insurance',
          amount: transaction.insuranceDamageProtectionFee,
        });
      }
      if (transaction.insuranceLiabilitySelected && transaction.insuranceLiabilityFee > 0) {
        items.push({
          description: 'Liability Insurance',
          amount: transaction.insuranceLiabilityFee,
        });
      }

      // Renter sponsor fee (only visible to renter, private from provider)
      if (transaction.renterSponsorCpaFee && transaction.renterSponsorCpaFee > 0) {
        items.push({
          description: `Sponsored Request Fee (${transaction.renterSponsorCpaPercent || 0}%)`,
          amount: transaction.renterSponsorCpaFee,
        });
      }
    } else {
      // Provider invoice - their earnings
      const providerEarnings = transaction.rentalFee - transaction.platformFee;

      if (transaction.tool) {
        items.push({
          description: `Tool Rental Income: ${transaction.tool.name} (${days} day${days > 1 ? 's' : ''})`,
          quantity: days,
          unitPrice: Math.round(providerEarnings / days),
          amount: providerEarnings,
        });
      } else if (transaction.space) {
        items.push({
          description: `Space Rental Income: ${transaction.space.name}`,
          amount: providerEarnings,
        });
      } else if (transaction.service) {
        items.push({
          description: `Service Income: ${transaction.service.name}`,
          amount: providerEarnings,
        });
      }

      // Show platform fee as a deduction (negative)
      if (transaction.platformFee > 0) {
        items.push({
          description: `Platform Fee (${transaction.platformFeePercent}%)`,
          amount: -transaction.platformFee,
        });
      }

      // Show instant payout fee if applicable
      if (transaction.instantPayoutSelected && transaction.instantPayoutFee > 0) {
        items.push({
          description: 'Instant Payout Fee',
          amount: -transaction.instantPayoutFee,
        });
      }

      // Provider sponsor fee (only visible to provider, private from renter)
      if (transaction.providerSponsorCpaFee && transaction.providerSponsorCpaFee > 0) {
        items.push({
          description: `Sponsored Listing Fee (${transaction.providerSponsorCpaPercent || 0}%)`,
          amount: -transaction.providerSponsorCpaFee,
        });
      }
    }

    return items;
  }

  /**
   * Generate PDF for an invoice
   */
  async generatePdf(invoiceId: string): Promise<{ pdfUrl: string; buffer: Buffer }> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        user: true,
        transaction: {
          include: {
            tool: true,
            space: true,
            service: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    // Get issuer's invoice settings
    const settings = await invoiceSettingsService.get(invoice.userId);

    // Generate PDF
    const pdfBuffer = await this.createPdfDocument(invoice, settings);

    // Save PDF locally
    const fs = await import('fs/promises');
    const path = await import('path');

    const invoiceDir = path.join(process.cwd(), 'uploads', 'invoices', invoice.userId);
    await fs.mkdir(invoiceDir, { recursive: true });

    const fileName = `${invoice.invoiceNumber}.pdf`;
    const filePath = path.join(invoiceDir, fileName);
    await fs.writeFile(filePath, pdfBuffer);

    const pdfUrl = `/uploads/invoices/${invoice.userId}/${fileName}`;

    // Update invoice with PDF URL
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { pdfUrl },
    });

    logger.info('Generated PDF for invoice', { invoiceId, pdfUrl });
    return { pdfUrl, buffer: pdfBuffer };
  }

  /**
   * Create PDF document
   */
  private createPdfDocument(
    invoice: Invoice & { user: { name: string | null } },
    settings: { businessName: string | null; address: string | null; city: string | null; postcode: string | null; vatNumber: string | null; logoUrl: string | null }
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(24).text('INVOICE', { align: 'right' });
      doc.fontSize(10).text(invoice.invoiceNumber, { align: 'right' });
      doc.moveDown();

      // Issuer details
      doc.fontSize(12).text(settings.businessName || invoice.user.name || 'SpannerWork User');
      if (settings.address) doc.fontSize(10).text(settings.address);
      if (settings.city) doc.text(settings.city);
      if (settings.postcode) doc.text(settings.postcode);
      if (settings.vatNumber) doc.text(`VAT: ${settings.vatNumber}`);
      doc.moveDown();

      // Invoice details
      doc.fontSize(10);
      doc.text(`Date: ${invoice.issueDate.toLocaleDateString('en-GB')}`);
      if (invoice.purchaseOrder) {
        doc.text(`PO Number: ${invoice.purchaseOrder}`);
      }
      doc.moveDown();

      // Bill To
      doc.fontSize(12).text('Bill To:', { underline: true });
      doc.fontSize(10).text(invoice.recipientName);
      if (invoice.recipientAddress) doc.text(invoice.recipientAddress);
      if (invoice.recipientVat) doc.text(`VAT: ${invoice.recipientVat}`);
      doc.moveDown(2);

      // Line items table
      const tableTop = doc.y;
      doc.fontSize(10);

      // Table header
      doc.font('Helvetica-Bold');
      doc.text('Description', 50, tableTop);
      doc.text('Amount', 450, tableTop, { align: 'right' });
      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
      doc.font('Helvetica');

      // Table rows
      let y = tableTop + 25;
      const lineItems = invoice.lineItems as unknown as LineItem[];

      for (const item of lineItems) {
        doc.text(item.description, 50, y);
        const amount = item.amount / 100;
        const sign = amount < 0 ? '-' : '';
        doc.text(`${sign}£${Math.abs(amount).toFixed(2)}`, 450, y, { align: 'right' });
        y += 20;
      }

      // Totals
      y += 10;
      doc.moveTo(350, y).lineTo(550, y).stroke();
      y += 10;

      doc.text('Subtotal:', 350, y);
      doc.text(`£${(invoice.subtotal / 100).toFixed(2)}`, 450, y, { align: 'right' });
      y += 15;

      if (invoice.vatAmount > 0) {
        doc.text('VAT (20%):', 350, y);
        doc.text(`£${(invoice.vatAmount / 100).toFixed(2)}`, 450, y, { align: 'right' });
        y += 15;
      }

      doc.font('Helvetica-Bold');
      doc.text('Total:', 350, y);
      doc.text(`£${(invoice.totalAmount / 100).toFixed(2)}`, 450, y, { align: 'right' });
      doc.font('Helvetica');

      // Footer
      doc.moveDown(4);
      doc.fontSize(8).fillColor('#666');
      doc.text('Payment processed via SpannerWork', { align: 'center' });
      doc.text(`Transaction ID: ${invoice.transactionId}`, { align: 'center' });

      doc.end();
    });
  }

  /**
   * Get invoices for a user
   */
  async getForUser(userId: string, filters: InvoiceFilters = {}): Promise<{
    invoices: Invoice[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {
      userId,
    };

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.startDate || filters.endDate) {
      where.issueDate = {};
      if (filters.startDate) {
        where.issueDate.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.issueDate.lte = filters.endDate;
      }
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          transaction: {
            select: {
              id: true,
              startDate: true,
              endDate: true,
              status: true,
            },
          },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    return { invoices, total, page, limit };
  }

  /**
   * Get annual tax summary for a user
   */
  async getAnnualTaxSummary(userId: string, year: number): Promise<TaxSummary> {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    // Get all provider transactions (income)
    const incomeTransactions = await prisma.transaction.findMany({
      where: {
        providerId: userId,
        status: 'COMPLETED',
        completedDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        rentalFee: true,
        platformFee: true,
        completedDate: true,
      },
    });

    // Get all renter transactions (expenses)
    const expenseTransactions = await prisma.transaction.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        completedDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        totalAmount: true,
        completedDate: true,
      },
    });

    // Get invoices for VAT calculation
    const invoices = await prisma.invoice.findMany({
      where: {
        userId,
        issueDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        type: true,
        vatAmount: true,
        issueDate: true,
      },
    });

    // Calculate monthly breakdown
    const byMonth: TaxSummary['byMonth'] = [];
    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

      const monthIncome = incomeTransactions
        .filter(t => t.completedDate && t.completedDate >= monthStart && t.completedDate <= monthEnd)
        .reduce((sum, t) => sum + (t.rentalFee - t.platformFee), 0);

      const monthExpenses = expenseTransactions
        .filter(t => t.completedDate && t.completedDate >= monthStart && t.completedDate <= monthEnd)
        .reduce((sum, t) => sum + t.totalAmount, 0);

      const monthVatCollected = invoices
        .filter(i => i.type === 'PROVIDER' && i.issueDate >= monthStart && i.issueDate <= monthEnd)
        .reduce((sum, i) => sum + i.vatAmount, 0);

      const monthVatPaid = invoices
        .filter(i => i.type === 'RENTER' && i.issueDate >= monthStart && i.issueDate <= monthEnd)
        .reduce((sum, i) => sum + i.vatAmount, 0);

      byMonth.push({
        month: month + 1,
        income: monthIncome,
        expenses: monthExpenses,
        vatCollected: monthVatCollected,
        vatPaid: monthVatPaid,
      });
    }

    return {
      year,
      totalIncome: incomeTransactions.reduce((sum, t) => sum + (t.rentalFee - t.platformFee), 0),
      totalExpenses: expenseTransactions.reduce((sum, t) => sum + t.totalAmount, 0),
      totalVatCollected: invoices.filter(i => i.type === 'PROVIDER').reduce((sum, i) => sum + i.vatAmount, 0),
      totalVatPaid: invoices.filter(i => i.type === 'RENTER').reduce((sum, i) => sum + i.vatAmount, 0),
      transactionCount: incomeTransactions.length + expenseTransactions.length,
      invoiceCount: invoices.length,
      byMonth,
    };
  }

  /**
   * Export transactions as CSV
   */
  async exportCsv(
    userId: string,
    dateRange?: { startDate?: Date; endDate?: Date }
  ): Promise<string> {
    const startDate = dateRange?.startDate;
    const endDate = dateRange?.endDate;
    const where: Prisma.TransactionWhereInput = {
      OR: [
        { userId },
        { providerId: userId },
      ],
      status: 'COMPLETED',
    };

    if (startDate || endDate) {
      where.completedDate = {};
      if (startDate) where.completedDate.gte = startDate;
      if (endDate) where.completedDate.lte = endDate;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        tool: { select: { name: true } },
        space: { select: { name: true } },
        service: { select: { name: true } },
        user: { select: { name: true } },
        provider: { select: { name: true } },
      },
      orderBy: { completedDate: 'desc' },
    });

    // Build CSV
    const headers = [
      'Date',
      'Type',
      'Description',
      'Other Party',
      'Amount (£)',
      'Platform Fee (£)',
      'Net Amount (£)',
      'Transaction ID',
    ];

    const rows = transactions.map(t => {
      const isProvider = t.providerId === userId;
      const description = t.tool?.name || t.space?.name || t.service?.name || 'Transaction';
      const otherParty = isProvider ? t.user.name : t.provider?.name;
      const amount = isProvider ? (t.rentalFee - t.platformFee) : t.totalAmount;

      return [
        t.completedDate?.toISOString().split('T')[0] || '',
        isProvider ? 'Income' : 'Expense',
        description,
        otherParty || '',
        (t.rentalFee / 100).toFixed(2),
        (t.platformFee / 100).toFixed(2),
        (amount / 100).toFixed(2),
        t.id,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Download an invoice
   */
  async download(
    userId: string,
    invoiceId: string
  ): Promise<{ buffer: Buffer; filename: string } | { redirectUrl: string }> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    if (invoice.userId !== userId) {
      throw new BadRequestError('You are not authorized to access this invoice');
    }

    const filename = `${invoice.invoiceNumber}.pdf`;

    // Generate PDF if not already generated
    if (!invoice.pdfUrl) {
      const { buffer } = await this.generatePdf(invoiceId);
      return { buffer, filename };
    }

    // If PDF exists in S3/CDN, redirect to it
    if (invoice.pdfUrl.startsWith('http')) {
      return { redirectUrl: invoice.pdfUrl };
    }

    // Fetch existing PDF from local storage
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const filePath = path.join(process.cwd(), invoice.pdfUrl);
      const buffer = await fs.readFile(filePath);
      return { buffer, filename };
    } catch {
      // PDF file is missing, regenerate
      const { buffer } = await this.generatePdf(invoiceId);
      return { buffer, filename };
    }
  }
}

export const invoiceService = new InvoiceService();
