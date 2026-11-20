import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { renderGamePage, renderLobby, type LegacyGame } from '../site/src/render.ts';
import { buildGames } from './build-games.ts';

const out = resolve('dist/site');
const siteUrl = process.env.SITE_URL ?? 'https://kyoangel.github.io/game_kyo/';
const opts = { siteUrl: siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`, siteName: 'Game Kyo' };

rmSync(out, { recursive: true, force: true });
const games = await buildGames('site', out, (slug) => `${slug}/game`);
const legacy = JSON.parse(readFileSync('site/legacy-games.json', 'utf8')) as LegacyGame[];

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'index.html'), renderLobby(games, legacy, opts));
for (const game of games) writeFileSync(join(out, game.slug, 'index.html'), renderGamePage(game, opts));
cpSync('site/static', join(out, 'static'), { recursive: true });
console.log(`[site] ${games.length} game(s) + ${legacy.length} legacy card(s) → ${out}`);
