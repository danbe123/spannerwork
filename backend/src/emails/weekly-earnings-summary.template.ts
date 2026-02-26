import { renderEmailLayout, escapeHtml } from '../services/emailTemplates.js';

export interface WeeklyEarningsSummaryData {
  recipientName: string;
  weekStart: string;
  weekEnd: string;
  totalEarnings: string;
  totalBookings: number;
  currency: string;
  pendingPayouts: string;
  averageRating?: number;
  totalReviews?: number;
  topPerformingListing?: {
    name: string;
    earnings: string;
    bookings: number;
  };
  upcomingBookings: number;
  dashboardUrl: string;
  listingsUrl: string;
}

export function generateWeeklyEarningsSummaryEmail(data: WeeklyEarningsSummaryData): { subject: string; html: string } {
  const safeRecipientName = escapeHtml(data.recipientName);

  const hasEarnings = parseFloat(data.totalEarnings) > 0;
  const subject = hasEarnings
    ? `Your week in review: ${data.currency}${data.totalEarnings} earned`
    : `Your weekly SpannerWork summary`;

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;
    let stars = '';
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars += '<span style="color: #FFC107;">&#9733;</span>';
      } else if (i === fullStars && hasHalf) {
        stars += '<span style="color: #FFC107;">&#9733;</span>';
      } else {
        stars += '<span style="color: #D1D5DB;">&#9733;</span>';
      }
    }
    return stars;
  };

  const bodyHtml = `
    <p style="margin: 0 0 20px;">Hi ${safeRecipientName},</p>

    <p style="margin: 0 0 24px;">
      Here's your SpannerWork activity for the week of <strong>${escapeHtml(data.weekStart)} - ${escapeHtml(data.weekEnd)}</strong>.
    </p>

    <!-- Earnings Highlight Box -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 24px; background: linear-gradient(135deg, #C43B12 0%, #A52F0C 100%); border-radius: 12px;">
      <tr>
        <td style="padding: 24px; text-align: center;">
          <p style="margin: 0 0 4px; color: rgba(255,255,255,0.8); font-size: 14px; font-weight: 500;">This Week's Earnings</p>
          <p style="margin: 0 0 8px; color: #ffffff; font-size: 42px; font-weight: 700;">${escapeHtml(data.currency)}${escapeHtml(data.totalEarnings)}</p>
          <p style="margin: 0; color: rgba(255,255,255,0.8); font-size: 14px;">from ${data.totalBookings} booking${data.totalBookings !== 1 ? 's' : ''}</p>
        </td>
      </tr>
    </table>

    <!-- Stats Grid -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 24px;">
      <tr>
        <td style="width: 50%; padding-right: 8px; vertical-align: top;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background: #F8FAFC; border-radius: 12px;">
            <tr>
              <td style="padding: 20px; text-align: center;">
                <p style="margin: 0 0 4px; color: #6B7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Pending Payouts</p>
                <p style="margin: 0; color: #1F2937; font-size: 24px; font-weight: 700;">${escapeHtml(data.currency)}${escapeHtml(data.pendingPayouts)}</p>
              </td>
            </tr>
          </table>
        </td>
        <td style="width: 50%; padding-left: 8px; vertical-align: top;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background: #F8FAFC; border-radius: 12px;">
            <tr>
              <td style="padding: 20px; text-align: center;">
                <p style="margin: 0 0 4px; color: #6B7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Upcoming Bookings</p>
                <p style="margin: 0; color: #1F2937; font-size: 24px; font-weight: 700;">${data.upcomingBookings}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${data.averageRating && data.totalReviews ? `
    <!-- Rating Section -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 24px; background: #FEF3C7; border-radius: 12px;">
      <tr>
        <td style="padding: 20px; text-align: center;">
          <p style="margin: 0 0 8px; color: #92400E; font-size: 14px; font-weight: 500;">Your Rating</p>
          <p style="margin: 0 0 4px; font-size: 24px;">${renderStars(data.averageRating)}</p>
          <p style="margin: 0; color: #A16207; font-size: 14px;">${data.averageRating.toFixed(1)} average from ${data.totalReviews} review${data.totalReviews !== 1 ? 's' : ''}</p>
        </td>
      </tr>
    </table>
    ` : ''}

    ${data.topPerformingListing ? `
    <!-- Top Performing Listing -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 24px; background: #F0FDF4; border-radius: 12px; border-left: 4px solid #10B981;">
      <tr>
        <td style="padding: 16px 20px;">
          <p style="margin: 0 0 8px; color: #065F46; font-size: 12px; font-weight: 600; text-transform: uppercase;">Top Performing Listing</p>
          <p style="margin: 0 0 4px; color: #1F2937; font-size: 16px; font-weight: 600;">${escapeHtml(data.topPerformingListing.name)}</p>
          <p style="margin: 0; color: #047857; font-size: 14px;">
            ${escapeHtml(data.currency)}${escapeHtml(data.topPerformingListing.earnings)} from ${data.topPerformingListing.bookings} booking${data.topPerformingListing.bookings !== 1 ? 's' : ''}
          </p>
        </td>
      </tr>
    </table>
    ` : ''}

    ${!hasEarnings ? `
    <!-- No Earnings Tips -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 24px; background: #F8FAFC; border-radius: 12px; border-left: 4px solid #C43B12;">
      <tr>
        <td style="padding: 16px 20px;">
          <p style="margin: 0 0 8px; color: #1F2937; font-size: 14px; font-weight: 600;">Tips to boost your bookings:</p>
          <ul style="margin: 0; padding-left: 20px; color: #6B7280; font-size: 14px; line-height: 1.6;">
            <li>Add high-quality photos to your listings</li>
            <li>Keep your availability calendar up to date</li>
            <li>Respond quickly to enquiries</li>
            <li>Consider adjusting your pricing</li>
          </ul>
        </td>
      </tr>
    </table>
    ` : ''}

    <p style="margin: 0; color: #6B7280; font-size: 14px; text-align: center;">
      Keep up the great work! Your next customer is just around the corner.
    </p>
  `;

  const html = renderEmailLayout({
    title: subject,
    previewText: `You earned ${data.currency}${data.totalEarnings} this week on SpannerWork`,
    heading: 'Weekly Summary',
    subheading: `${escapeHtml(data.weekStart)} - ${escapeHtml(data.weekEnd)}`,
    bodyHtml,
    ctaText: 'View Full Dashboard',
    ctaUrl: data.dashboardUrl,
    footerNote: 'You received this email because you\'re a SpannerWork provider. You can update your email preferences in your account settings.',
  });

  return { subject, html };
}
