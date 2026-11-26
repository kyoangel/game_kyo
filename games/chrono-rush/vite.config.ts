import { fileURLToPath } from 'node:url';
import { createGameViteConfig } from '../../packages/game-kit/vite-config.ts';

export default createGameViteConfig(fileURLToPath(new URL('.', import.meta.url)));
