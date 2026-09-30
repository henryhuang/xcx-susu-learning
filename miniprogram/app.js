App({
  onLaunch() {},
  onHide() { require('./services/audio').stop(); }
});
