App({
  onLaunch() { require('./services/speech').clearPlaybackCache(); },
  onHide() { require('./services/audio').stop(); require('./services/speech').cancelAll(); }
});
