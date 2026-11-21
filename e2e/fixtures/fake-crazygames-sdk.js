// Fake CrazyGames SDK v3 for portal smoke tests. Served in place of https://sdk.crazygames.com/crazygames-sdk-v3.js.
(() => {
  const calls = (window.__fakeSdkCalls = window.__fakeSdkCalls || []);
  const rec = (name) => calls.push(name);
  const store = new Map();
  window.CrazyGames = {
    SDK: {
      environment: 'crazygames',
      async init() {
        rec('init');
      },
      game: {
        loadingStart() { rec('game.loadingStart'); },
        loadingStop() { rec('game.loadingStop'); },
        gameplayStart() { rec('game.gameplayStart'); },
        gameplayStop() { rec('game.gameplayStop'); },
      },
      ad: {
        requestAd(type, cb) {
          rec('ad.requestAd:' + type);
          setTimeout(() => {
            cb.adStarted();
            setTimeout(() => cb.adFinished(), 50);
          }, 0);
        },
      },
      data: {
        getItem(key) { return store.has(key) ? store.get(key) : null; },
        setItem(key, value) { store.set(key, String(value)); rec('data.setItem'); },
      },
    },
  };
})();
