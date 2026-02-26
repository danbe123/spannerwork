import type { } from 'zod';

export type RenderEmailLayoutOptions = {
  title: string;
  previewText?: string;
  heading?: string;
  subheading?: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  footerNote?: string;
};

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderEmailLayout(options: RenderEmailLayoutOptions): string {
  const { 
    title, 
    previewText = '', 
    heading = 'SpannerWork', 
    subheading,
    bodyHtml, 
    ctaText,
    ctaUrl,
    footerNote 
  } = options;

  const safeTitle = escapeHtml(title);
  const safePreviewText = escapeHtml(previewText);
  const safeHeading = escapeHtml(heading);
  const safeSubheading = subheading ? escapeHtml(subheading) : '';
  const safeFooterNote = footerNote
    ? escapeHtml(footerNote)
    : 'You received this email because you have a SpannerWork account.';

  const currentYear = new Date().getFullYear();

  // Generate CTA button if provided
  // Brand colors: #C43B12 (brand-800), #A52F0C (brand-900), #FFC107 (yellow accent)
  const ctaButton = ctaText && ctaUrl ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 32px auto;">
      <tr>
        <td style="border-radius: 8px; background: linear-gradient(135deg, #C43B12 0%, #A52F0C 100%); box-shadow: 0 4px 14px rgba(196, 59, 18, 0.4);">
          <a href="${ctaUrl}" target="_blank" style="display: inline-block; padding: 16px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
            ${escapeHtml(ctaText)}
          </a>
        </td>
      </tr>
    </table>
  ` : '';

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${safeTitle}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    :root { color-scheme: light; }
    
    * { box-sizing: border-box; }
    
    body, table, td, p, a, li { 
      -webkit-text-size-adjust: 100%; 
      -ms-text-size-adjust: 100%; 
    }
    
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      background-color: #FFF8F6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    
    table { border-collapse: collapse !important; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    
    a { color: #C43B12; text-decoration: none; }
    a:hover { text-decoration: underline; }

    .button-primary {
      display: inline-block;
      padding: 14px 28px;
      border-radius: 8px;
      background: linear-gradient(135deg, #C43B12 0%, #A52F0C 100%);
      color: #ffffff !important;
      font-weight: 600;
      font-size: 15px;
      text-decoration: none;
      box-shadow: 0 4px 14px rgba(196, 59, 18, 0.35);
    }

    .button-secondary {
      display: inline-block;
      padding: 12px 24px;
      border-radius: 8px;
      background: #ffffff;
      border: 2px solid #C43B12;
      color: #C43B12 !important;
      font-weight: 600;
      font-size: 14px;
      text-decoration: none;
    }
    
    .preheader {
      display: none !important;
      visibility: hidden;
      mso-hide: all;
      font-size: 1px;
      line-height: 1px;
      max-height: 0;
      max-width: 0;
      opacity: 0;
      overflow: hidden;
    }
    
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 16px !important; }
      .content { padding: 24px 20px !important; }
      .header { padding: 32px 20px !important; }
      .footer { padding: 24px 20px !important; }
      h1 { font-size: 24px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #FFF8F6;">
  <span class="preheader">${safePreviewText}&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</span>
  
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #FFF8F6;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        
        <!-- Main Container -->
        <table role="presentation" class="container" width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(196, 59, 18, 0.08), 0 1px 3px rgba(0,0,0,0.04);">

          <!-- Header -->
          <tr>
            <td class="header" style="padding: 40px 40px 32px; text-align: center; background: linear-gradient(145deg, #C43B12 0%, #A52F0C 50%, #7A2409 100%);">
              <!-- Logo -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 16px;">
                <tr>
                  <td style="background: rgba(255,255,255,0.15); border-radius: 14px; padding: 14px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size: 28px; line-height: 1;">🔧</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Brand Name -->
              <p style="margin: 0 0 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 22px; font-weight: 700; letter-spacing: 0.02em; color: #ffffff;">
                SpannerWork
              </p>
              <!-- Tagline -->
              <p style="margin: 0 0 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.05em; color: #FFC107;">
                Tools. Skills. Space.
              </p>
              
              <!-- Heading -->
              <h1 style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 28px; line-height: 1.3; font-weight: 700; color: #ffffff;">
                ${safeHeading}
              </h1>
              
              ${safeSubheading ? `
              <p style="margin: 12px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; line-height: 1.5; color: rgba(255,255,255,0.85);">
                ${safeSubheading}
              </p>
              ` : ''}
            </td>
          </tr>
          
          <!-- Body Content -->
          <tr>
            <td class="content" style="padding: 40px 40px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; line-height: 1.7; color: #374151;">
              ${bodyHtml}
              ${ctaButton}
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-top: 1px solid #F3E8E5;"></td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td class="footer" style="padding: 28px 40px 36px; text-align: center;">
              <!-- Social/Help Links -->
              <p style="margin: 0 0 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #9CA3AF;">
                Questions? <a href="mailto:support@spannerwork.co.uk" style="color: #C43B12; font-weight: 500;">Contact Support</a>
              </p>
              
              <!-- Footer Note -->
              <p style="margin: 0 0 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; line-height: 1.6; color: #9CA3AF;">
                ${safeFooterNote}
              </p>
              
              <!-- Copyright -->
              <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #D1D5DB;">
                © ${currentYear} SpannerWork Ltd. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
        
        <!-- Below Container Footer -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; margin-top: 24px;">
          <tr>
            <td align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: #9CA3AF;">
              <a href="\${unsubscribeUrl}" style="color: #9CA3AF; text-decoration: underline;">Unsubscribe</a>
              <span style="margin: 0 8px; color: #D1D5DB;">•</span>
              <a href="\${preferencesUrl}" style="color: #9CA3AF; text-decoration: underline;">Email Preferences</a>
            </td>
          </tr>
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>`;
}
