import { prisma } from '../config/database.js';
import { Prisma, TransactionStatus } from '@prisma/client';
import { unifiedNotificationService } from './unifiedNotification.service.js';
import { logger } from '../config/logger.js';
import { BadRequestError, NotFoundError, ForbiddenError, ConflictError } from '../utils/errors.js';
import { stripControlCharacters } from '../utils/sanitize.js';
import { tradeAccountService } from './tradeAccount.service.js';
import { INSURANCE } from '../config/businessConstants.js';

// Maximum length for user-generated content in SMS messages
const SMS_CONTENT_MAX_LENGTH = 50;

/**
 * Sanitize user-generated content for SMS messages
 * - Truncates to max length
 * - Removes control characters and newlines
 * - Escapes special characters
 */
function sanitizeForSms(text: string, maxLength = SMS_CONTENT_MAX_LENGTH): string {
  const cleaned = stripControlCharacters(text)
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Trim whitespace
    .trim();

  // Only add ellipsis if actually truncating
  if (cleaned.length > maxLength) {
    return cleaned.slice(0, maxLength - 3) + '...';
  }
  return cleaned;
}

export class TransactionService {
  private getPlatformFeePercentForProviderPlan(plan: string | null | undefined): number {
    if (plan === 'BUSINESS') return 2;
    if (plan === 'PRO') return 3;
    return 5;
  }

  /**
   * Calculate the number of days between two dates (inclusive)
   *
   * Uses a 1-hour grace period to avoid charging an extra day for minor overruns.
   * Examples:
   * - 24 hours = 1 day
   * - 24 hours 59 mins = 1 day (grace period)
   * - 25 hours = 2 days
   */
  private calculateDays(startDate: Date, endDate: Date): number {
    if (endDate < startDate) {
      throw new BadRequestError('End date must be after start date');
    }
    const diffTime = endDate.getTime() - startDate.getTime();

    // Apply 1-hour grace period: if within 1 hour of exact day boundary, don't round up
    // This means 24h 59m counts as 1 day, but 25h 01m counts as 2 days
    const gracePeriodHours = 1;
    const exactDays = diffTime / (1000 * 60 * 60 * 24);
    const graceInDays = gracePeriodHours / 24; // 1/24 of a day
    const baseDays = Math.floor(exactDays);
    const remainder = exactDays - baseDays;

    // If remainder is within grace period, use base days; otherwise round up
    const calculatedDays = remainder <= graceInDays ? Math.max(1, baseDays) : Math.ceil(exactDays);

    return Math.max(1, calculatedDays); // Minimum 1 day
  }

  /**
   * Calculate the number of hours between two dates
   */
  private calculateHours(startDate: Date, endDate: Date): number {
    if (endDate < startDate) {
      throw new BadRequestError('End date must be after start date');
    }
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    return Math.max(1, diffHours); // Minimum 1 hour
  }

  /**
   * Create a new transaction/booking
   * Rental fee is calculated server-side based on listing rates to prevent manipulation
   * All pricing queries are inside the transaction to prevent race conditions
   *
   * FIX: Price snapshot validation - prevents provider from changing rates between
   * when customer views the listing and when they create a transaction.
   * The quotedRentalFee parameter (if provided) must match the calculated fee.
   */
  async create(data: {
    userId: string;
    requestId?: string;
    toolId?: string;
    spaceId?: string;
    serviceId?: string;
    startDate: Date;
    endDate: Date;
    notes?: string;
    waiverAccepted?: boolean;
    /** Optional: Price the customer was shown. If provided, must match current rate or transaction fails */
    quotedRentalFee?: number;
  }) {
    // Check if customer account is suspended before creating transaction
    const customer = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { accountStatus: true },
    });
    if (!customer) {
      throw new NotFoundError('User not found');
    }
    if (customer.accountStatus === 'SUSPENDED') {
      throw new ForbiddenError('Your account is suspended. You cannot create new bookings.', 'ACCOUNT_SUSPENDED');
    }

    const days = this.calculateDays(data.startDate, data.endDate);
    const hours = this.calculateHours(data.startDate, data.endDate);

    // Create transaction and booking atomically with conflict check
    // All pricing queries are inside the transaction to prevent race conditions
    const transaction = await prisma.$transaction(async (tx) => {
      // Determine providerId and calculate rental fee based on what's being booked
      // These queries use tx (transaction client) to ensure atomicity
      let providerId: string | null = null;
      let rentalFee: number = 0;
      let providerSponsorCpaPercent: number = 0; // CPA from listing (provider pays)

      if (data.toolId) {
        const tool = await tx.tool.findUnique({
          where: { id: data.toolId },
          select: { ownerId: true, available: true, dailyRate: true, weeklyRate: true, sponsorCpaPercent: true },
        });
        if (!tool) throw new NotFoundError('Tool not found');
        if (!tool.available) throw new ConflictError('Tool is not available');
        providerId = tool.ownerId;
        providerSponsorCpaPercent = tool.sponsorCpaPercent || 0;

        // FIX #8: Calculate rental fee with fair weekly rate handling
        // Use weeks + remaining days instead of aggressive rounding (e.g., 8 days = 1 week + 1 day, not 2 weeks)
        // Compare and use the cheaper option for the customer
        if (days >= 7 && tool.weeklyRate) {
          const fullWeeks = Math.floor(days / 7);
          const remainingDays = days % 7;

          // Option 1: weeks rounded up (old way)
          const roundedWeeksPrice = Math.ceil(days / 7) * tool.weeklyRate;

          // Option 2: full weeks + remaining days at daily rate
          const hybridPrice = (fullWeeks * tool.weeklyRate) + (remainingDays * tool.dailyRate);

          // Use the cheaper option for the customer
          rentalFee = Math.min(roundedWeeksPrice, hybridPrice);
        } else {
          rentalFee = days * tool.dailyRate;
        }
      } else if (data.spaceId) {
        const space = await tx.space.findUnique({
          where: { id: data.spaceId },
          select: { ownerId: true, available: true, hourlyRate: true, dailyRate: true, weeklyRate: true, sponsorCpaPercent: true },
        });
        if (!space) throw new NotFoundError('Space not found');
        if (!space.available) throw new ConflictError('Space is not available');
        providerId = space.ownerId;
        providerSponsorCpaPercent = space.sponsorCpaPercent || 0;

        // FIX #8: Calculate rental fee with fair weekly rate handling
        // Use weeks + remaining days instead of aggressive rounding
        if (days >= 7 && space.weeklyRate) {
          const fullWeeks = Math.floor(days / 7);
          const remainingDays = days % 7;

          const roundedWeeksPrice = Math.ceil(days / 7) * space.weeklyRate;
          const hybridPrice = (fullWeeks * space.weeklyRate) + (remainingDays * space.dailyRate);

          rentalFee = Math.min(roundedWeeksPrice, hybridPrice);
        } else if (days >= 1) {
          rentalFee = days * space.dailyRate;
        } else {
          rentalFee = hours * space.hourlyRate;
        }
      } else if (data.serviceId) {
        const service = await tx.service.findUnique({
          where: { id: data.serviceId },
          select: { providerId: true, available: true, hourlyRate: true, calloutFee: true, requiresInsurance: true, sponsorCpaPercent: true },
        });
        if (!service) throw new NotFoundError('Service not found');
        if (!service.available) throw new ConflictError('Service is not available');
        providerId = service.providerId;
        providerSponsorCpaPercent = service.sponsorCpaPercent || 0;

        if (service.requiresInsurance) {
          const now = new Date();
          const validInsurance = await tx.insuranceDocument.findFirst({
            where: {
              userId: providerId,
              status: 'APPROVED',
              documentType: 'PUBLIC_LIABILITY',
              OR: [
                { expiryDate: null },
                { expiryDate: { gt: now } },
              ],
            },
            select: { id: true },
          });

          if (!validInsurance) {
            throw new ForbiddenError(
              'This service cannot be booked because the provider does not have valid public liability insurance.',
              'PROVIDER_INSURANCE_REQUIRED'
            );
          }
        }

        // Calculate service fee: hourly rate * hours + callout fee
        rentalFee = (hours * service.hourlyRate) + (service.calloutFee || 0);
      }

      // Get renter's CPA from their request (if booking is linked to a request)
      // FIX #10: Also validate request is still active and not expired
      // FIX: Use atomic query with FOR UPDATE to prevent TOCTOU race condition
      let renterSponsorCpaPercent: number = 0;
      if (data.requestId) {
        // Use FOR UPDATE to lock the request row and prevent concurrent modifications
        // This ensures status and expiry can't change between check and transaction creation
        const requests = await tx.$queryRaw<Array<{
          sponsorCpaPercent: number | null;
          status: string;
          expiresAt: Date | null;
        }>>`
          SELECT "sponsorCpaPercent", status, "expiresAt"
          FROM requests
          WHERE id = ${data.requestId}
            AND status = 'ACTIVE'
            AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
          FOR UPDATE
        `;

        if (requests.length === 0) {
          // Check if request exists but is not valid
          const invalidRequest = await tx.request.findUnique({
            where: { id: data.requestId },
            select: { status: true, expiresAt: true },
          });
          if (invalidRequest) {
            if (invalidRequest.status !== 'ACTIVE') {
              throw new BadRequestError(`Cannot create transaction for ${invalidRequest.status.toLowerCase()} request`);
            }
            if (invalidRequest.expiresAt && new Date(invalidRequest.expiresAt) < new Date()) {
              throw new BadRequestError('This request has expired and is no longer accepting offers');
            }
          }
          throw new BadRequestError('Request not found or is no longer available');
        }

        renterSponsorCpaPercent = requests[0].sponsorCpaPercent || 0;
      }

      // Validate rental fee is positive
      if (rentalFee <= 0) {
        throw new BadRequestError('Could not calculate valid rental fee for the specified booking');
      }

      // FIX #11: Apply trade account bulk discount if applicable
      // This allows B2B customers with negotiated discounts to pay less
      // Discount is applied to rental fee before platform fees are calculated
      let bulkDiscountAmount = 0;
      let bulkDiscountPercent = 0;
      const originalRentalFee = rentalFee;

      try {
        const { discount, finalAmount } = await tradeAccountService.calculateBulkDiscount(
          data.userId,
          rentalFee
        );
        if (discount > 0) {
          bulkDiscountAmount = discount;
          bulkDiscountPercent = Math.round((discount / rentalFee) * 100);
          rentalFee = finalAmount;
          logger.info('Trade account bulk discount applied', {
            userId: data.userId,
            originalAmount: originalRentalFee,
            discount: bulkDiscountAmount,
            discountPercent: bulkDiscountPercent,
            finalAmount: rentalFee,
          });
        }
      } catch (err) {
        // Log the error but don't fail the transaction
        // The customer will be charged full price if discount calculation fails
        const discountError = err instanceof Error ? err : new Error(String(err));
        logger.warn('Failed to calculate bulk discount, proceeding without discount', {
          userId: data.userId,
          error: discountError.message,
          stack: discountError.stack,
        });
      }

      // FIX: Price snapshot validation - prevent price manipulation between quote and booking
      // If customer was shown a price (quotedRentalFee), verify it matches the current calculated price
      // Use originalRentalFee (before discount) since the quoted price doesn't include trade discounts
      // Allow a small tolerance (1%) for rounding differences
      if (data.quotedRentalFee !== undefined) {
        const priceDifference = Math.abs(originalRentalFee - data.quotedRentalFee);
        const tolerancePercent = 0.01; // 1% tolerance for rounding
        const maxAllowedDifference = Math.max(originalRentalFee * tolerancePercent, 1); // At least 1 pence tolerance

        if (priceDifference > maxAllowedDifference) {
          logger.warn('Price manipulation detected: quoted vs calculated rental fee mismatch', {
            quotedRentalFee: data.quotedRentalFee,
            calculatedRentalFee: rentalFee,
            difference: priceDifference,
            listingId: data.toolId || data.spaceId || data.serviceId,
            userId: data.userId,
          });
          throw new ConflictError(
            'The price has changed since you viewed this listing. ' +
            `Expected £${(data.quotedRentalFee / 100).toFixed(2)} but current price is £${(rentalFee / 100).toFixed(2)}. ` +
            'Please refresh the page to see the updated price.',
            'PRICE_CHANGED'
          );
        }
      }

      const provider = providerId
        ? await tx.user.findUnique({
            where: { id: providerId },
            select: { providerPlan: true, defaultPayoutSpeed: true, accountStatus: true, stripeConnectId: true },
          })
        : null;

      // Check if provider account is suspended
      if (provider?.accountStatus === 'SUSPENDED') {
        throw new ForbiddenError('This provider is currently unavailable.', 'PROVIDER_SUSPENDED');
      }

      // Verify provider has completed Stripe Connect onboarding and can receive payments
      // This prevents bookings that would fail at payment time
      if (provider && !provider.stripeConnectId) {
        throw new ForbiddenError(
          'This provider has not set up their payment account yet. ' +
          'Please contact the provider or choose a different listing.',
          'PROVIDER_PAYMENT_NOT_SETUP'
        );
      }

      // FIX #12: Prevent self-booking - user cannot book their own listing
      // This could be used to inflate stats or create fake reviews
      if (providerId && providerId === data.userId) {
        throw new BadRequestError(
          'You cannot book your own listing. If you need to test, please use a different account.',
          'SELF_BOOKING_NOT_ALLOWED'
        );
      }

      const providerPlan = provider?.providerPlan || 'FREE';
      const platformFeePercent = this.getPlatformFeePercentForProviderPlan(providerPlan);
      const platformFee = Math.round(rentalFee * (platformFeePercent / 100));

      const instantPayoutSelected = provider?.defaultPayoutSpeed === 'INSTANT';
      const instantPayoutFee = instantPayoutSelected ? Math.round(rentalFee * 0.015) : 0;

      const insuranceDamageProtectionSelected = false;
      const insuranceDamageProtectionFee = 0;
      const insuranceLiabilitySelected = false;
      const insuranceLiabilityFee = 0;
      const insuranceCancellationSelected = false;
      const insuranceCancellationFee = 0;
      const insuranceTotal =
        insuranceDamageProtectionFee +
        insuranceLiabilityFee +
        insuranceCancellationFee;

      const totalAmount = rentalFee + platformFee + insuranceTotal;
      const applicationFeeAmount = platformFee + instantPayoutFee + insuranceTotal;

      // FIX: Validate CPA fees won't cause overflow at capture time
      // Calculate potential CPA fees to ensure applicationFeeAmount won't exceed totalAmount
      // Use integer arithmetic to avoid floating-point precision issues: multiply first, divide last
      const maxCpaPercent = Math.max(providerSponsorCpaPercent, renterSponsorCpaPercent);
      const totalCpaPercent = providerSponsorCpaPercent + renterSponsorCpaPercent;
      const potentialCpaFees = Math.floor((rentalFee * totalCpaPercent) / 100);
      const potentialApplicationFee = applicationFeeAmount + potentialCpaFees;

      if (potentialApplicationFee > totalAmount) {
        logger.error('CPA fee overflow would occur at capture time', {
          totalAmount,
          applicationFeeAmount,
          potentialCpaFees,
          potentialApplicationFee,
          providerSponsorCpaPercent,
          renterSponsorCpaPercent,
          userId: data.userId,
        });
        throw new BadRequestError(
          `The sponsor fees (${maxCpaPercent}%) are too high for this transaction. ` +
          'Please reduce the sponsor fee percentage or contact support.',
          'CPA_FEE_OVERFLOW'
        );
      }

      // Check for booking conflicts with row-level locking to prevent race conditions
      // Using FOR UPDATE ensures that concurrent requests will wait for the lock
      // This is critical to prevent double-bookings when two users book simultaneously
      const resourceId = data.toolId || data.spaceId || data.serviceId;

      // Use separate parameterized queries for each resource type to avoid SQL injection
      // This is safer than dynamic column names in the query string
      let conflictingTransactions: { id: string }[];

      if (data.toolId) {
        conflictingTransactions = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM transactions
          WHERE "toolId" = ${resourceId}
            AND status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')
            AND "startDate" <= ${data.endDate}
            AND "endDate" >= ${data.startDate}
          FOR UPDATE
        `;
      } else if (data.spaceId) {
        conflictingTransactions = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM transactions
          WHERE "spaceId" = ${resourceId}
            AND status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')
            AND "startDate" <= ${data.endDate}
            AND "endDate" >= ${data.startDate}
          FOR UPDATE
        `;
      } else {
        conflictingTransactions = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM transactions
          WHERE "serviceId" = ${resourceId}
            AND status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')
            AND "startDate" <= ${data.endDate}
            AND "endDate" >= ${data.startDate}
          FOR UPDATE
        `;
      }

      if (conflictingTransactions.length > 0) {
        throw new ConflictError('Booking conflict: Resource is already booked for these dates');
      }

      // Create transaction - this is the single source of truth for bookings
      // Availability checks should query Transaction, not the deprecated Booking model
      const newTransaction = await tx.transaction.create({
        data: {
          userId: data.userId,
          providerId,
          requestId: data.requestId,
          toolId: data.toolId,
          spaceId: data.spaceId,
          serviceId: data.serviceId,
          startDate: data.startDate,
          endDate: data.endDate,
          rentalFee,
          platformFee,
          totalAmount,
          providerPlanAtBooking: providerPlan,
          platformFeePercent,
          applicationFeeAmount,
          instantPayoutSelected,
          instantPayoutFee,
          insuranceDamageProtectionSelected,
          insuranceDamageProtectionFee,
          insuranceLiabilitySelected,
          insuranceLiabilityFee,
          insuranceCancellationSelected,
          insuranceCancellationFee,
          notes: data.notes,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          // Store waiver acceptance timestamp for service bookings
          customerWaiverAcceptedAt: data.waiverAccepted ? new Date() : null,
          waiverVersion: data.waiverAccepted ? '1.0' : null,
          // Snapshot CPA percentages (fees calculated on completion)
          providerSponsorCpaPercent,
          providerSponsorCpaFee: 0, // Calculated on completion
          renterSponsorCpaPercent,
          renterSponsorCpaFee: 0, // Calculated on completion
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          tool: true,
          space: true,
          service: true,
          request: true,
        },
      });

      return newTransaction;
    });

    // Best-effort notifications for new booking
    try {
      const rawResourceName =
        transaction.tool?.name || transaction.space?.name || transaction.service?.name || 'booking';
      const resourceName = sanitizeForSms(rawResourceName);
      const customerName = transaction.user?.name || 'A customer';

      // Notify provider of new booking request
      if (transaction.providerId) {
        await unifiedNotificationService.templates.newBookingRequest(
          transaction.providerId,
          customerName,
          resourceName
        );
      }
    } catch (error) {
      logger.error('Error sending notifications for new transaction', error);
    }

    return transaction;
  }

  /**
   * FIX #16: Added transaction status check to prevent modifying cancelled transactions
   * FIX: Added waiver re-acceptance requirement when insurance options change
   */
  async updateAddOns(params: {
    transactionId: string;
    userId: string;
    insuranceDamageProtectionSelected?: boolean;
    insuranceLiabilitySelected?: boolean;
    insuranceCancellationSelected?: boolean;
  }) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: params.transactionId },
      select: {
        id: true,
        userId: true,
        status: true,
        paymentStatus: true,
        stripePaymentIntentId: true,
        rentalFee: true,
        platformFee: true,
        instantPayoutFee: true,
        instantPayoutSelected: true,
        // FIX: Include current insurance selections to detect changes
        insuranceDamageProtectionSelected: true,
        insuranceLiabilitySelected: true,
        insuranceCancellationSelected: true,
        customerWaiverAcceptedAt: true,
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    if (transaction.userId !== params.userId) {
      throw new ForbiddenError('Not authorized');
    }

    // FIX #16: Check transaction status - can only modify PENDING transactions
    if (transaction.status === 'CANCELLED') {
      throw new ConflictError('Cannot update add-ons for a cancelled transaction');
    }

    if (transaction.status === 'COMPLETED') {
      throw new ConflictError('Cannot update add-ons for a completed transaction');
    }

    if (transaction.status === 'IN_PROGRESS') {
      throw new ConflictError('Cannot update add-ons for an in-progress transaction');
    }

    if (transaction.paymentStatus !== 'PENDING') {
      throw new ConflictError('Cannot update add-ons after payment is initiated');
    }

    if (transaction.stripePaymentIntentId) {
      throw new ConflictError('Cannot update add-ons after payment is initiated');
    }

    const insuranceDamageProtectionSelected = Boolean(params.insuranceDamageProtectionSelected);
    const insuranceCancellationSelected = Boolean(params.insuranceCancellationSelected);
    const insuranceLiabilitySelected = Boolean(params.insuranceLiabilitySelected);

    // FIX: Detect if any insurance option has changed
    const insuranceOptionsChanged =
      insuranceDamageProtectionSelected !== transaction.insuranceDamageProtectionSelected ||
      insuranceLiabilitySelected !== transaction.insuranceLiabilitySelected ||
      insuranceCancellationSelected !== transaction.insuranceCancellationSelected;

    // FIX: If insurance options changed and waiver was previously accepted, require re-acceptance
    // This ensures users acknowledge the new terms/coverage
    const shouldResetWaiver = insuranceOptionsChanged && transaction.customerWaiverAcceptedAt !== null;

    const rentalFee = Number(transaction.rentalFee || 0);
    const platformFee = Number(transaction.platformFee || 0);
    const instantPayoutFee = Number(transaction.instantPayoutFee || 0);

    // Use centralized insurance constants to ensure consistency across the codebase
    const insuranceDamageProtectionFee = insuranceDamageProtectionSelected
      ? Math.round(rentalFee * (INSURANCE.DAMAGE_PROTECTION_PERCENT / 100))
      : 0;

    const insuranceCancellationFee = insuranceCancellationSelected
      ? Math.round(rentalFee * (INSURANCE.CANCELLATION_PROTECTION_PERCENT / 100))
      : 0;

    const insuranceLiabilityFee = insuranceLiabilitySelected ? INSURANCE.LIABILITY_PROTECTION_FEE : 0;

    const insuranceTotal =
      insuranceDamageProtectionFee +
      insuranceLiabilityFee +
      insuranceCancellationFee;

    const totalAmount = rentalFee + platformFee + insuranceTotal;
    const applicationFeeAmount =
      platformFee +
      (transaction.instantPayoutSelected ? instantPayoutFee : 0) +
      insuranceTotal;

    const updatedTransaction = await prisma.transaction.update({
      where: { id: params.transactionId },
      data: {
        insuranceDamageProtectionSelected,
        insuranceDamageProtectionFee,
        insuranceLiabilitySelected,
        insuranceLiabilityFee,
        insuranceCancellationSelected,
        insuranceCancellationFee,
        totalAmount,
        applicationFeeAmount,
        // FIX: Reset waiver if insurance options changed
        ...(shouldResetWaiver && { customerWaiverAcceptedAt: null }),
      },
    });

    // FIX: Return info about waiver reset so frontend can prompt user
    return {
      ...updatedTransaction,
      waiverResetRequired: shouldResetWaiver,
    };
  }

  /**
   * Check if there's a booking conflict
   */
  async checkBookingConflict(data: {
    toolId?: string;
    spaceId?: string;
    serviceId?: string;
    startDate: Date;
    endDate: Date;
    excludeTransactionId?: string;
  }): Promise<boolean> {
    const where: Prisma.TransactionWhereInput = {
      status: {
        in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'],
      },
      OR: [
        {
          startDate: {
            lte: data.endDate,
          },
          endDate: {
            gte: data.startDate,
          },
        },
      ],
    };

    if (data.toolId) where.toolId = data.toolId;
    if (data.spaceId) where.spaceId = data.spaceId;
    if (data.serviceId) where.serviceId = data.serviceId;
    if (data.excludeTransactionId) {
      where.id = { not: data.excludeTransactionId };
    }

    const conflictingTransaction = await prisma.transaction.findFirst({
      where,
    });

    return !!conflictingTransaction;
  }

  /**
   * List user's transactions with pagination
   */
  async list(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      status?: string;
      asProvider?: boolean;
    } = {}
  ) {
    const MAX_LIMIT = 100;
    const { page = 1, limit = 20, status, asProvider = false } = options;
    const safeLimit = Math.min(limit, MAX_LIMIT);
    const skip = (page - 1) * safeLimit;

    const where: Prisma.TransactionWhereInput = asProvider
      ? { providerId: userId }
      : { userId };

    // Validate status against TransactionStatus enum
    if (status) {
      const validStatuses = Object.values(TransactionStatus);
      if (validStatuses.includes(status as TransactionStatus)) {
        where.status = status as TransactionStatus;
      }
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          tool: {
            select: {
              id: true,
              name: true,
              dailyRate: true,
              photos: true,
            },
          },
          space: {
            select: {
              id: true,
              name: true,
              dailyRate: true,
              photos: true,
            },
          },
          service: {
            select: {
              id: true,
              name: true,
              hourlyRate: true,
              photos: true,
            },
          },
          request: {
            select: {
              id: true,
              title: true,
              category: true,
            },
          },
        },
        orderBy: { createdDate: 'desc' },
        skip,
        take: safeLimit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  /**
   * Get transaction by ID
   * Optimized: Uses select instead of include for related entities
   */
  async getById(id: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatar: true,
            rating: true,
          },
        },
        // Only select needed fields from listings (not full objects)
        tool: {
          select: {
            id: true,
            name: true,
            photos: true,
            dailyRate: true,
            deposit: true,
            ownerId: true,
            owner: {
              select: { id: true, name: true, avatar: true, rating: true },
            },
          },
        },
        space: {
          select: {
            id: true,
            name: true,
            photos: true,
            dailyRate: true,
            ownerId: true,
            owner: {
              select: { id: true, name: true, avatar: true, rating: true },
            },
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            photos: true,
            hourlyRate: true,
            providerId: true,
            provider: {
              select: { id: true, name: true, avatar: true, rating: true },
            },
          },
        },
        request: {
          select: {
            id: true,
            title: true,
            budget: true,
            rateType: true,
            seekerId: true,
            seeker: {
              select: { id: true, name: true, avatar: true, rating: true },
            },
          },
        },
        reviews: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdDate: true,
            reviewerId: true,
            reviewedUserId: true,
            reviewer: {
              select: { id: true, name: true, avatar: true },
            },
          },
        },
        // Only select needed dispute fields
        disputes: {
          select: {
            id: true,
            status: true,
            reason: true,
            createdDate: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    return transaction;
  }

  /**
   * Update transaction status with optimistic locking
   * @param expectedVersion - Optional version for optimistic locking (prevents concurrent updates)
   */
  async updateStatus(
    id: string,
    userId: string,
    status: 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
    expectedVersion?: number
  ) {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      select: {
        userId: true,
        providerId: true,
        status: true,
        version: true,
        // Fields needed for sponsor fee calculation on completion
        rentalFee: true,
        totalAmount: true,
        applicationFeeAmount: true,
        providerSponsorCpaPercent: true,
        renterSponsorCpaPercent: true,
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    // Only user or provider can update status
    if (transaction.userId !== userId && transaction.providerId !== userId) {
      throw new ForbiddenError('Not authorized to update this transaction');
    }

    // Role-based authorization for specific status changes
    const isCustomer = transaction.userId === userId;
    const isProvider = transaction.providerId === userId;

    // Only provider can confirm bookings
    if (status === 'CONFIRMED' && !isProvider) {
      throw new ForbiddenError('Only the provider can confirm bookings');
    }

    // Only provider can mark as in progress
    if (status === 'IN_PROGRESS' && !isProvider) {
      throw new ForbiddenError('Only the provider can mark transaction as in progress');
    }

    // Only customer can mark as completed
    if (status === 'COMPLETED' && !isCustomer) {
      throw new ForbiddenError('Only the customer can mark transaction as completed');
    }

    // FIX #1: Require payment to be captured before marking as completed
    // This prevents providers from getting fake "completed" transactions without payment
    if (status === 'COMPLETED') {
      const currentTransaction = await prisma.transaction.findUnique({
        where: { id },
        select: { paymentStatus: true },
      });
      if (currentTransaction?.paymentStatus !== 'PAID') {
        throw new BadRequestError(
          'Payment must be captured before marking transaction as completed. ' +
          'Please ensure the payment has been processed first.',
          'PAYMENT_REQUIRED'
        );
      }
    }

    // Either party can cancel (no restriction for CANCELLED status)

    // FIX #20: Validate state transitions - aligned with cancel() method restrictions
    // Users cannot cancel IN_PROGRESS transactions - they must file a dispute
    // Admin can use separate admin endpoints if forced cancellation is needed
    const validTransitions: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED'], // FIX #20: Removed CANCELLED - must use dispute for in-progress
      COMPLETED: [], // Final state - no transitions allowed
      CANCELLED: [], // Final state - no transitions allowed
    };

    const allowedNextStates = validTransitions[transaction.status] || [];
    if (!allowedNextStates.includes(status)) {
      throw new BadRequestError(
        `Invalid status transition: cannot change from ${transaction.status} to ${status}. ` +
        `Allowed transitions: ${allowedNextStates.length > 0 ? allowedNextStates.join(', ') : 'none (final state)'}`
      );
    }

    // Update transaction and user counts atomically with optimistic locking
    const updated = await prisma.$transaction(async (tx) => {
      // Build where clause with optimistic locking
      const whereClause: { id: string; version?: number } = { id };
      if (expectedVersion !== undefined) {
        whereClause.version = expectedVersion;
      }

      // Calculate sponsor fees on completion
      let completionData: Record<string, unknown> = {};
      if (status === 'COMPLETED') {
        const rentalFee = Number(transaction.rentalFee || 0);
        const totalAmount = Number(transaction.totalAmount || 0);
        const currentAppFee = Number(transaction.applicationFeeAmount || 0);

        // Calculate provider sponsor fee using integer arithmetic to avoid precision issues
        const providerCpaPercent = transaction.providerSponsorCpaPercent || 0;
        const providerSponsorCpaFee = Math.floor((rentalFee * providerCpaPercent) / 100);

        // Calculate renter sponsor fee using integer arithmetic
        const renterCpaPercent = transaction.renterSponsorCpaPercent || 0;
        const renterSponsorCpaFee = Math.floor((rentalFee * renterCpaPercent) / 100);

        // Both sponsor fees go to platform (add to applicationFeeAmount)
        let newApplicationFeeAmount = currentAppFee + providerSponsorCpaFee + renterSponsorCpaFee;

        // FIX: Ensure CPA fees don't cause applicationFeeAmount to exceed totalAmount
        if (newApplicationFeeAmount > totalAmount) {
          logger.warn('CPA fees would exceed totalAmount at completion, capping', {
            transactionId: id,
            totalAmount,
            currentAppFee,
            providerSponsorCpaFee,
            renterSponsorCpaFee,
            calculatedNewFee: newApplicationFeeAmount,
          });
          // Cap at totalAmount to prevent Stripe errors
          newApplicationFeeAmount = totalAmount;
        }

        completionData = {
          completedDate: new Date(),
          providerSponsorCpaFee,
          renterSponsorCpaFee,
          applicationFeeAmount: newApplicationFeeAmount,
        };
      }

      // Update transaction with version increment
      const updatedTransaction = await tx.transaction.update({
        where: whereClause,
        data: {
          status,
          version: { increment: 1 }, // Increment version for optimistic locking
          ...completionData,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          tool: true,
          space: true,
          service: true,
        },
      }).catch((error) => {
        // Handle optimistic locking failure (record not found with matching version)
        if (error.code === 'P2025') {
          throw new ConflictError('Transaction was modified by another request. Please refresh and try again.');
        }
        throw error;
      });

      // Update user transaction count if completed
      if (status === 'COMPLETED') {
        await tx.user.update({
          where: { id: transaction.userId },
          data: { totalTransactions: { increment: 1 } },
        });

        if (transaction.providerId) {
          await tx.user.update({
            where: { id: transaction.providerId },
            data: { totalTransactions: { increment: 1 } },
          });
        }
      }

      return updatedTransaction;
    });

    // Best-effort notifications for booking status change (respects user preferences)
    try {
      const rawResourceName =
        updated.tool?.name || updated.space?.name || updated.service?.name || 'booking';
      const resourceName = sanitizeForSms(rawResourceName);

      // Notify customer based on status change
      if (status === 'CONFIRMED') {
        await unifiedNotificationService.templates.bookingConfirmed(
          transaction.userId,
          resourceName,
          updated.startDate
        );
      } else if (status === 'CANCELLED') {
        await unifiedNotificationService.templates.bookingCancelled(
          transaction.userId,
          resourceName
        );
      }

      // Notify provider
      if (transaction.providerId) {
        if (status === 'COMPLETED') {
          // Provider gets payment notification on completion
          await unifiedNotificationService.templates.paymentReceived(
            transaction.providerId,
            updated.rentalFee,
            updated.user?.name || 'Customer'
          );
        } else if (status === 'CANCELLED') {
          await unifiedNotificationService.templates.bookingCancelled(
            transaction.providerId,
            resourceName
          );
        }
      }
    } catch (error) {
      logger.error('Error sending notifications for transaction status', error);
    }

    return updated;
  }

  /**
   * Complete a transaction
   */
  async complete(id: string, userId: string) {
    return this.updateStatus(id, userId, 'COMPLETED');
  }

  /**
   * Cancel a transaction
   * Both the customer (userId) and provider (providerId) can cancel
   *
   * FIX #4: Track who cancelled and update cancellation rates
   * - Provider cancellations are tracked to detect abuse
   * - Cancellation rate affects search ranking and trust signals
   */
  async cancel(id: string, userId: string) {
    // Use transaction to ensure atomicity of cancel + refund + earnings update
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id },
        select: {
          userId: true,
          providerId: true,
          status: true,
          notes: true,
          paymentStatus: true,
          stripePaymentIntentId: true,
          totalAmount: true,
          rentalFee: true,
          platformFee: true,
          requestId: true,
          tool: { select: { name: true } },
          space: { select: { name: true } },
          service: { select: { name: true } },
        },
      });

      if (!transaction) {
        throw new NotFoundError('Transaction not found');
      }

      // Allow both customer AND provider to cancel
      if (transaction.userId !== userId && transaction.providerId !== userId) {
        throw new ForbiddenError('Not authorized to cancel this transaction');
      }

      if (!['PENDING', 'CONFIRMED'].includes(transaction.status)) {
        throw new BadRequestError('Cannot cancel a transaction that is already in progress or completed');
      }

      // FIX #4: Determine who is cancelling
      const isProviderCancelling = transaction.providerId === userId;
      const cancelledBy: 'user' | 'provider' = isProviderCancelling ? 'provider' : 'user';
      const cancellerId = userId;

      // Add cancellation note with who cancelled
      const timestamp = new Date().toISOString();
      let cancellationNote = `[${timestamp}] Cancelled by ${cancelledBy}`;

      // Process refund for PAID transactions
      let refundProcessed = false;
      if (transaction.paymentStatus === 'PAID' && transaction.stripePaymentIntentId) {
        try {
          const { stripeService } = await import('./stripe.service.js');

          if (stripeService.isEnabled()) {
            // Full refund for cancellations
            await stripeService.createRefund({
              paymentIntentId: transaction.stripePaymentIntentId,
              reason: 'requested_by_customer',
            });

            refundProcessed = true;
            cancellationNote += '\n[SYSTEM] Full refund processed automatically';
            logger.info(`Refund initiated for cancelled transaction ${id}`);
          }
        } catch (refundError) {
          logger.error(`Failed to refund cancelled transaction ${id}:`, refundError);
          cancellationNote += '\n[SYSTEM] Automatic refund failed - requires manual processing';
        }
      }

      // Decrement provider earnings if payment was captured
      if (transaction.paymentStatus === 'PAID' && transaction.providerId) {
        const providerEarnings = (transaction.rentalFee || 0) - (transaction.platformFee || 0);
        if (providerEarnings > 0) {
          // Update UserStats instead of User (earnings are tracked in stats)
          await tx.userStats.upsert({
            where: { userId: transaction.providerId },
            update: {
              totalEarned: { decrement: providerEarnings },
            },
            create: {
              userId: transaction.providerId,
              totalEarned: 0, // Start at 0, will be negative after decrement
            },
          });
          logger.info(`Decremented provider ${transaction.providerId} earnings by ${providerEarnings}`);
        }
      }

      // Decrement request responseCount if this was from a quick-accept
      if (transaction.requestId) {
        await tx.request.update({
          where: { id: transaction.requestId },
          data: { responseCount: { decrement: 1 } },
        });
      }

      const updatedNotes = transaction.notes
        ? `${transaction.notes}\n${cancellationNote}`
        : cancellationNote;

      // Update transaction with cancellation info
      const updatedTransaction = await tx.transaction.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          notes: updatedNotes,
          cancelledById: cancellerId,
          paymentStatus: refundProcessed ? 'REFUNDED' : transaction.paymentStatus,
          totalRefunded: refundProcessed ? (transaction.totalAmount || 0) : undefined,
        },
        include: {
          user: { select: { id: true, email: true, name: true } },
          provider: { select: { id: true, email: true, name: true } },
          tool: { select: { name: true } },
          space: { select: { name: true } },
          service: { select: { name: true } },
        },
      });

      return { updatedTransaction, transaction, cancelledBy, cancellerId };
    });

    const { updatedTransaction, transaction, cancelledBy, cancellerId } = result;

    // FIX #4: Update cancellation rate for the party who cancelled
    await this.updateCancellationRate(cancellerId);

    // Send cancellation email with info about who cancelled
    const resourceName = transaction.tool?.name || transaction.space?.name || transaction.service?.name || 'booking';
    const resourceType: 'tool' | 'space' | 'service' = transaction.tool ? 'tool' : transaction.space ? 'space' : 'service';

    try {
      const { emailQueueService } = await import('./emailQueue.service.js');

      // Notify the customer
      if (updatedTransaction.user?.email) {
        await emailQueueService.queueBookingCancellationEmail(
          updatedTransaction.user.email,
          {
            userName: updatedTransaction.user.name,
            resourceName,
            resourceType,
            transactionId: id,
            startDate: updatedTransaction.startDate,
            endDate: updatedTransaction.endDate,
            cancelledBy,
          }
        );
      }

      // Notify the provider (if different from canceller)
      if (updatedTransaction.provider?.email && updatedTransaction.providerId !== cancellerId) {
        await emailQueueService.queueBookingCancellationEmail(
          updatedTransaction.provider.email,
          {
            userName: updatedTransaction.provider.name,
            resourceName,
            resourceType,
            transactionId: id,
            startDate: updatedTransaction.startDate,
            endDate: updatedTransaction.endDate,
            cancelledBy,
          }
        );
      }
    } catch (emailError) {
      // Log but don't fail the cancellation
      logger.error('Failed to send cancellation emails:', emailError);
    }

    return updatedTransaction;
  }

  /**
   * Update user's cancellation rate after a cancellation
   * Only counts cancellations that the user initiated (fair calculation)
   * Cancellation rate = user-initiated cancellations / total transactions where user participated
   */
  private async updateCancellationRate(userId: string): Promise<void> {
    // Count total completed+cancelled transactions where user was involved
    // and cancelled transactions that THIS USER initiated (fair calculation)
    const [total, userInitiatedCancellations] = await Promise.all([
      prisma.transaction.count({
        where: {
          OR: [{ userId }, { providerId: userId }],
          status: { in: ['COMPLETED', 'CANCELLED'] },
        },
      }),
      // Only count cancellations where this user was the one who cancelled
      prisma.transaction.count({
        where: {
          cancelledById: userId,
          status: 'CANCELLED',
        },
      }),
    ]);

    const cancellationRate = total > 0 ? (userInitiatedCancellations / total) * 100 : 0;

    // Update or create UserStats
    await prisma.userStats.upsert({
      where: { userId },
      update: {
        cancellationRate,
        completionRate: 100 - cancellationRate,
      },
      create: {
        userId,
        cancellationRate,
        completionRate: 100 - cancellationRate,
      },
    });
  }
}

export const transactionService = new TransactionService();
