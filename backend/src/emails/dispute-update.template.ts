import { renderEmailLayout, escapeHtml } from '../services/emailTemplates.js';

export type DisputeUpdateTemplateData = {
  userName: string | null;
  disputeId: string;
  status: string;
  resourceName: string;
  resolution: string | null;
  disputeUrl: string;
};

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'resolved':
      return '#22c55e'; // green
    case 'closed':
      return '#6b7280'; // gray
    case 'under_review':
      return '#f59e0b'; // amber
    default:
      return '#3b82f6'; // blue
  }
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function disputeUpdateTemplate(data: DisputeUpdateTemplateData) {
  const safeName = data.userName ? escapeHtml(data.userName) : '';
  const safeResourceName = escapeHtml(data.resourceName);
  const safeResolution = data.resolution ? escapeHtml(data.resolution) : null;
  const greeting = safeName ? `Hi ${safeName},` : 'Hi,';
  const statusColor = getStatusColor(data.status);
  const formattedStatus = formatStatus(data.status);

  const subject = `Dispute update: ${formattedStatus}`;
  const previewText = `Your dispute regarding ${data.resourceName} has been updated.`;
  
  const text = [
    greeting,
    '',
    `Your dispute regarding ${data.resourceName} has been updated.`,
    '',
    `Status: ${formattedStatus}`,
    data.resolution ? `Resolution: ${data.resolution}` : '',
    '',
    `View dispute: ${data.disputeUrl}`,
  ].filter(Boolean).join('\n');

  const resolutionHtml = safeResolution 
    ? `<p style="margin: 12px 0 0;"><strong>Resolution:</strong> ${safeResolution}</p>` 
    : '';

  const bodyHtml = `
    <p>${greeting}</p>
    <p>Your dispute regarding <strong>${safeResourceName}</strong> has been updated.</p>
    <div style="margin: 20px 0; padding: 16px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid ${statusColor};">
      <p style="margin: 0;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: 600;">${formattedStatus}</span></p>
      ${resolutionHtml}
    </div>
    <p style="margin: 24px 0;">
      <a href="${data.disputeUrl}" class="button-primary">View dispute details</a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">If you have any questions, please reply to this email or contact our support team.</p>
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      previewText,
      heading: 'Dispute Update',
      bodyHtml,
    }),
  };
}
