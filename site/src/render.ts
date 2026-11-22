import type { GameManifest } from '../../packages/game-kit/src/manifest.ts';

export interface LegacyGame {
  href: string;
  icon: string;
  title: Record<string, string>;
  description: Record<string, string>;
}

export interface RenderOptions {
  siteUrl: string;
  siteName: string;
}

const LANGS = ['en', 'zh-TW'] as const;

const UI: Record<string, Record<string, string>> = {
  tagline: { en: 'Free mini games — play instantly in your browser', 'zh-TW': '免費小遊戲，打開瀏覽器就能玩' },
  all: { en: 'All', 'zh-TW': '全部' },
  best: { en: 'Best', 'zh-TW': '最高分' },
  howTo: { en: 'How to play', 'zh-TW': '玩法' },
  back: { en: '← All games', 'zh-TW': '← 所有遊戲' },
};

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}

function pick(map: Record<string, string>, lang: string): string {
  return map[lang] ?? map.en ?? '';
}

function bilingual(map: Record<string, string>): string {
  return LANGS.map((l) => `<span lang="${l}" data-l="${l}">${escapeHtml(pick(map, l))}</span>`).join('');
}

const LANG_BOOT =
  "(function(){var l;try{l=localStorage.getItem('gk:lang')}catch(e){}" +
  "if(l!=='en'&&l!=='zh-TW'){l=/^zh/i.test(navigator.language)?'zh-TW':'en'}" +
  'document.documentElement.setAttribute(\'data-lang\',l);document.documentElement.lang=l;})();';

const LANG_TOGGLE =
  "document.querySelectorAll('[data-set-lang]').forEach(function(b){b.addEventListener('click',function(){" +
  "var l=b.getAttribute('data-set-lang');document.documentElement.setAttribute('data-lang',l);document.documentElement.lang=l;" +
  "try{localStorage.setItem('gk:lang',l)}catch(e){}});});";

const LOBBY_SCRIPT =
  "document.querySelectorAll('[data-filter]').forEach(function(b){b.addEventListener('click',function(){" +
  "var t=b.getAttribute('data-filter');document.querySelectorAll('.card').forEach(function(c){" +
  "var tags=(c.getAttribute('data-tags')||'').split(' ');c.hidden=t!=='*'&&tags.indexOf(t)<0;});});});" +
  "document.querySelectorAll('[data-slug]').forEach(function(c){var v=null;" +
  "try{v=localStorage.getItem('gk:'+c.getAttribute('data-slug')+':best')}catch(e){}" +
  "if(v){var el=c.querySelector('.best');el.hidden=false;el.querySelector('b').textContent=v;}});";

function shell(o: { title: string; description: string; canonical: string; root: string; body: string; script?: string; pageClass?: string }): string {
  const cls = o.pageClass ? ` class="${o.pageClass}"` : '';
  return `<!doctype html>
<html lang="en" data-lang="en"${cls}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1c0f55">
<link rel="manifest" href="${o.root}static/manifest.webmanifest">
<link rel="apple-touch-icon" href="${o.root}static/icon-180.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>${escapeHtml(o.title)}</title>
<meta name="description" content="${escapeHtml(o.description)}">
<link rel="canonical" href="${escapeHtml(o.canonical)}">
<link rel="stylesheet" href="${o.root}static/site.css">
<script>${LANG_BOOT}</script>
</head>
<body>
<div class="lang-switch"><button data-set-lang="en">EN</button><button data-set-lang="zh-TW">繁中</button></div>
${o.body}
<script>${LANG_TOGGLE}${o.script ?? ''}</script>
</body>
</html>
`;
}

function gameCard(g: GameManifest): string {
  return `<a class="card" href="./${g.slug}/" data-slug="${g.slug}" data-tags="${escapeHtml(g.tags.join(' '))}">
<img src="./${g.slug}/game/${escapeHtml(g.cover)}" alt="" loading="lazy" width="320" height="180">
<h2>${bilingual(g.title)}</h2>
<p>${bilingual(g.description)}</p>
<p class="best" hidden>${bilingual(UI.best!)}: <b></b></p>
</a>`;
}

function legacyCard(g: LegacyGame): string {
  return `<a class="card legacy" href="${escapeHtml(g.href)}" data-tags="">
<div class="icon">${escapeHtml(g.icon)}</div>
<h2>${bilingual(g.title)}</h2>
<p>${bilingual(g.description)}</p>
</a>`;
}

export function renderLobby(games: GameManifest[], legacy: LegacyGame[], opts: RenderOptions): string {
  const tags = [...new Set(games.flatMap((g) => g.tags))].sort();
  const filters = [`<button data-filter="*">${bilingual(UI.all!)}</button>`]
    .concat(tags.map((t) => `<button data-filter="${escapeHtml(t)}">${escapeHtml(t)}</button>`))
    .join('');
  const body = `<header><h1>${escapeHtml(opts.siteName)}</h1><p class="tagline">${bilingual(UI.tagline!)}</p></header>
<nav class="filters">${filters}</nav>
<main class="grid">
${games.map(gameCard).join('\n')}
${legacy.map(legacyCard).join('\n')}
</main>`;
  return shell({
    title: opts.siteName,
    description: pick(UI.tagline!, 'en'),
    canonical: opts.siteUrl,
    root: './',
    body,
    script: LOBBY_SCRIPT,
  });
}

export function renderGamePage(game: GameManifest, opts: RenderOptions): string {
  const body = `<header class="game-header"><a class="back" href="../" aria-label="${escapeHtml(UI.back!.en!)}">${bilingual(UI.back!)}</a><h1>${bilingual(game.title)}</h1></header>
<div class="frame ${game.orientation}"><iframe src="./game/index.html" title="${escapeHtml(game.title.en)}" allow="autoplay; fullscreen" allowfullscreen></iframe></div>
<section class="about"><p>${bilingual(game.description)}</p><h2>${bilingual(UI.howTo!)}</h2><p>${bilingual(game.instructions)}</p></section>`;
  return shell({
    title: `${game.title.en} · ${opts.siteName}`,
    description: game.description.en,
    canonical: `${opts.siteUrl}${game.slug}/`,
    root: '../',
    body,
    pageClass: 'game-page',
  });
}
