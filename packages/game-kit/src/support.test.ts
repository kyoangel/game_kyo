import { describe, expect, it } from 'vitest';
import { showSupportLink, SUPPORT_URL } from './support.ts';

describe('support link', () => {
  it('points at the ECPay donation page', () => expect(SUPPORT_URL).toBe('https://p.ecpay.com.tw/17369E9'));
  it('is shown only where external links are allowed (never on portals)', () => {
    expect(showSupportLink({ externalLinks: true })).toBe(true);
    expect(showSupportLink({ externalLinks: false })).toBe(false);
  });
});
