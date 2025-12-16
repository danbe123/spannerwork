import { renderEmailLayout, escapeHtml } from '../services/emailTemplates.js';

export type ReviewReceivedTemplateData = {
  recipientName: string | null;
  reviewerName: string;
  rating: number;
  comment: string | null;
  profileUrl: string;
};

function renderStars(rating: number): string {
  const fullStar = '★';
  const emptyStar = '☆';
  return fullStar.repeat(rating) + emptyStar.repeat(5 - rating);
}

export function reviewReceivedTemplate(data: ReviewReceivedTemplateData) {
  const safeRecipientName = data.recipientName ? escapeHtml(data.recipientName) : '';
  const safeReviewerName = escapeHtml(data.reviewerName);
  const safeComment = data.comment ? escapeHtml(data.comment) : null;
  const greeting = safeRecipientName ? `Hi ${safeRecipientName},` : 'Hi,';
  const stars = renderStars(data.rating);

  const subject = `You received a ${data.rating}-star review ⭐`;
  const previewText = `${data.reviewerName} left you a ${data.rating}-star review on SpannerWork.`;
  
  const text = [
    greeting,
    '',
    `Great news! ${data.reviewerName} left you a ${data.rating}-star review.`,
    '',
    `Rating: ${stars}`,
    data.comment ? `Comment: "${data.comment}"` : '',
    '',
    `View your profile: ${data.profileUrl}`,
  ].filter(Boolean).join('\n');

  const commentHtml = safeComment 
    ? `<p style="margin: 12px 0 0; font-style: italic; color: #374151;">"${safeComment}"</p>` 
    : '';

  const bodyHtml = `
    <p>${greeting}</p>
    <p>Great news! <strong>${safeReviewerName}</strong> left you a review.</p>
    <div style="margin: 20px 0; padding: 16px; background-color: #fefce8; border-radius: 8px; border-left: 4px solid #eab308; text-align: center;">
      <p style="margin: 0; font-size: 24px; letter-spacing: 4px;">${stars}</p>
      <p style="margin: 8px 0 0; font-weight: 600; color: #374151;">${data.rating} out of 5 stars</p>
      ${commentHtml}
    </div>
    <p style="margin: 24px 0;">
      <a href="${data.profileUrl}" class="button-primary">View your profile</a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">Good reviews help you stand out and get more bookings!</p>
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      previewText,
      heading: 'New Review Received',
      bodyHtml,
    }),
  };
}
