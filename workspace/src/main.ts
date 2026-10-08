import { audio } from "./game";
import { initMenu } from "./adventure/menu";
import { seededRngFromSearch } from "./adventure/rng";
import { createAdventureView } from "./adventure/view";

const dev = import.meta.env.DEV;

// Dev builds only (never in production): `?seed=N` fixes the adventure rng, and the
// localStorage key below skips the start menu so the endless-mode e2e specs can run unchanged.
const rng = seededRngFromSearch(window.location.search, dev) ?? Math.random;
const devStart = dev && localStorage.getItem("mathMerge10DebugStart") === "endless" ? "endless" : null;

const adventure = createAdventureView({
  store: localStorage,
  rng,
  audio,
  goHome: () => menu.showMenu(),
  devHooks: dev,
});
const menu = initMenu({ store: localStorage, adventure, devStart });
menu.start();
