import { describe, expect, it } from 'vitest';
import type { GameManifest } from '../../packages/game-kit/src/manifest.ts';
import { escapeHtml, renderGamePage, renderLobby, type LegacyGame } from './render.ts';

const game = (over: Partial<GameManifest> = {}): GameManifest => ({
  slug: 'dodge-drop',
  version: '0.1.0',
  title: { en: 'Dodge Drop', 'zh-TW': '閃避落塊' },
  description: { en: 'Dodge <blocks> & win' },
  instructions: { en: 'Move left and right.' },
  tags: ['arcade', 'reflex'],
  orientation: 'portrait',
  controls: ['mouse'],
  cover: 'cover.svg',
  targets: ['site'],
  releases: {},
  ...over,
});
const legacy: LegacyGame[] = [
  { href: './merge10/', icon: '🔢', title: { en: 'Math Merge 10' }, description: { en: 'Make 10' } },
];
const opts = { siteUrl: 'https://example.test/root/', siteName: 'Game Kyo' };

describe('escapeHtml', () => {
  it('escapes the five special characters', () => expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;'));
});

describe('renderLobby', () => {
  const html = renderLobby([game()], legacy, opts);
  it('links each game with a relative URL and cover', () => {
    expect(html).toContain('href="./dodge-drop/"');
    expect(html).toContain('src="./dodge-drop/game/cover.svg"');
    expect(html).toContain('data-slug="dodge-drop"');
    expect(html).toContain('data-tags="arcade reflex"');
  });
  it('renders both languages, falling back to en', () => {
    expect(html).toContain('<span lang="zh-TW" data-l="zh-TW">閃避落塊</span>');
    expect(html).toContain('<span lang="zh-TW" data-l="zh-TW">Dodge &lt;blocks&gt; &amp; win</span>');
  });
  it('escapes manifest text', () => expect(html).not.toContain('<blocks>'));
  it('includes legacy cards and tag filters', () => {
    expect(html).toContain('href="./merge10/"');
    expect(html).toContain('data-filter="arcade"');
    expect(html).toContain('data-filter="reflex"');
  });
  it('sets canonical to siteUrl and never hard-codes /game_kyo/', () => {
    expect(html).toContain('<link rel="canonical" href="https://example.test/root/">');
    expect(html).not.toContain('/game_kyo/');
  });
});

describe('renderGamePage', () => {
  const html = renderGamePage(game(), opts);
  it('embeds the game build in an iframe', () => expect(html).toContain('src="./game/index.html"'));
  it('uses an orientation class for the frame', () => expect(html).toContain('class="frame portrait"'));
  it('links back to the lobby and the shared stylesheet', () => {
    expect(html).toContain('href="../"');
    expect(html).toContain('href="../static/site.css"');
  });
  it('has SEO title, description and canonical', () => {
    expect(html).toContain('<title>Dodge Drop · Game Kyo</title>');
    expect(html).toContain('<meta name="description" content="Dodge &lt;blocks&gt; &amp; win">');
    expect(html).toContain('<link rel="canonical" href="https://example.test/root/dodge-drop/">');
  });
  it('shows instructions', () => expect(html).toContain('Move left and right.'));
});
