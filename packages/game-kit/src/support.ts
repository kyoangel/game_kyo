/** Owner's ECPay donation page. Shown only where the platform allows external links (own site, local). */
export const SUPPORT_URL = 'https://p.ecpay.com.tw/17369E9';

/** Whether the title screen should show the support link for this platform. */
export function showSupportLink(features: { externalLinks: boolean }): boolean {
  return features.externalLinks;
}
