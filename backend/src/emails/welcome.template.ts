import { renderEmailLayout, escapeHtml } from '../services/emailTemplates.js';

export type WelcomeTemplateData = {
  name: string | null;
  dashboardUrl: string;
  createListingUrl: string;
};

export function welcomeTemplate(data: WelcomeTemplateData) {
  const safeName = data.name ? escapeHtml(data.name) : '';
  const greeting = safeName ? `Hi ${safeName},` : 'Hi,';

  const subject = 'Welcome to SpannerWork! 🔧';
  const previewText = 'Your account is ready. Start renting tools, spaces, and services in your local community.';
  
  const text = [
    greeting,
    '',
    'Welcome to SpannerWork! Your account is now ready.',
    '',
    'With SpannerWork you can:',
    '• Rent tools from your neighbours instead of buying',
    '• Find workshop space and specialist equipment locally',
    '• Offer your own tools and services to earn extra income',
    '• Connect with skilled people in your community',
    '',
    'Quick tips to get started:',
    '1. Complete your profile to build trust',
    '2. Browse local listings to see what\'s available',
    '3. List something you own to start earning',
    '',
    `Get started: ${data.dashboardUrl}`,
  ].join('\n');

  const bodyHtml = `
    <p>${greeting}</p>
    <p>Welcome to SpannerWork! Your account is now ready.</p>
    <p><strong>What you can do:</strong></p>
    <ul style="margin: 16px 0; padding-left: 20px;">
      <li style="margin-bottom: 8px;">🔧 <strong>Rent tools</strong> from your neighbours instead of buying</li>
      <li style="margin-bottom: 8px;">🏠 <strong>Find workspace</strong> and specialist equipment locally</li>
      <li style="margin-bottom: 8px;">💷 <strong>Earn money</strong> from tools and skills you already have</li>
      <li style="margin-bottom: 8px;">🤝 <strong>Connect</strong> with skilled people in your community</li>
    </ul>
    <p style="margin: 24px 0;">
      <a href="${data.dashboardUrl}" class="button-primary">Explore listings near you</a>
    </p>
    <div style="margin: 24px 0; padding: 16px; background-color: #f0fdf4; border-radius: 8px; border-left: 4px solid #22c55e;">
      <p style="margin: 0 0 8px; font-weight: 600;">💡 Quick tips to get started:</p>
      <ol style="margin: 0; padding-left: 20px; color: #374151;">
        <li style="margin-bottom: 4px;">Complete your profile to build trust with others</li>
        <li style="margin-bottom: 4px;">Browse local listings to see what's available</li>
        <li style="margin-bottom: 4px;">List something you own to start earning</li>
      </ol>
    </div>
    <p>Ready to earn? <a href="${data.createListingUrl}">List your first item</a> – the average provider earns £150+ per month from items sitting in their garage!</p>
  `;

  return {
    subject,
    text,
    html: renderEmailLayout({
      title: subject,
      previewText,
      heading: 'Welcome to SpannerWork!',
      bodyHtml,
    }),
  };
}
