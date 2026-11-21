// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadScript } from './loadScript.ts';

const URL_A = 'https://sdk.example.test/a.js';
const find = (url: string) => document.head.querySelector<HTMLScriptElement>(`script[src="${url}"]`);

afterEach(() => {
  vi.unstubAllGlobals();
  document.head.innerHTML = '';
});

describe('loadScript', () => {
  it('injects an async script tag and resolves true on load', async () => {
    const p = loadScript(URL_A, 1000);
    const el = find(URL_A);
    expect(el).not.toBeNull();
    expect(el!.async).toBe(true);
    el!.dispatchEvent(new Event('load'));
    expect(await p).toBe(true);
  });

  it('applies the optional element id', async () => {
    const p = loadScript(URL_A, 1000, 'my-sdk');
    expect(document.getElementById('my-sdk')).toBe(find(URL_A));
    find(URL_A)!.dispatchEvent(new Event('load'));
    await p;
  });

  it('resolves false (never rejects) on a script error and removes the tag', async () => {
    const p = loadScript(URL_A, 1000);
    find(URL_A)!.dispatchEvent(new Event('error'));
    expect(await p).toBe(false);
    expect(find(URL_A)).toBeNull();
  });

  it('resolves false on timeout', async () => {
    expect(await loadScript(URL_A, 10)).toBe(false);
    expect(find(URL_A)).toBeNull();
  });

  it('resolves false when there is no document', async () => {
    vi.stubGlobal('document', undefined);
    expect(await loadScript(URL_A, 10)).toBe(false);
  });
});
