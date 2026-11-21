// Fake GameDistribution SDK for portal smoke tests. Served in place of https://html5.api.gamedistribution.com/main.min.js.
(() => {
  const calls = (window.__fakeSdkCalls = window.__fakeSdkCalls || []);
  const opts = window.GD_OPTIONS;
  calls.push(opts ? 'GD_OPTIONS.gameId=' + opts.gameId : 'GD_OPTIONS.missing');
  const emit = (name) => {
    try {
      window.GD_OPTIONS.onEvent({ name });
    } catch (e) {
      calls.push('onEvent.error');
    }
  };
  window.gdsdk = {
    async preloadAd(type) {
      calls.push('preloadAd:' + type);
    },
    async showAd(type) {
      calls.push('showAd:' + (type || 'interstitial'));
      emit('SDK_GAME_PAUSE');
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (type === 'rewarded') emit('SDK_REWARDED_WATCH_COMPLETE');
      emit('SDK_GAME_START');
    },
  };
  setTimeout(() => {
    calls.push('SDK_READY');
    emit('SDK_READY');
  }, 20);
})();
