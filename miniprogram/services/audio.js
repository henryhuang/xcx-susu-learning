const audioMap = require('../data/audio-map');
const assets = require('./course-assets');
let active = null;
let token = 0;
let listener = null;

function notify(state) { if (listener) listener(state); }
function subscribe(fn) { listener = fn; return () => { if (listener === fn) listener = null; }; }
function stop() {
  token += 1;
  if (active) {
    const old = active;
    active = null;
    try { old.stop(); } catch (_) {}
    try { old.destroy(); } catch (_) {}
  }
  notify({playing:false,key:''});
}
function play(key, onEnded) {
  stop();
  const src = audioMap[key] || (/^https:\/\/[a-zA-Z0-9.-]+(?::\d+)?(?:\/[^\s\\]*)?$/.test(key) || /^\/(?:assets|chinese\/assets)\/[a-zA-Z0-9_./-]+$/.test(key) && !key.includes('..') ? key : '');
  if (!src) { notify({playing:false,key:'',error:'这个声音还没准备好，先一起读一读吧。'}); return false; }
  const currentToken = token;
  let context;
  try {
    context = wx.createInnerAudioContext();
    active = context;
    context.obeyMuteSwitch = true;
    context.autoplay = false;
    context.onPlay(() => { if (token === currentToken) notify({playing:true,key}); });
    context.onEnded(() => { if (token === currentToken) {stop(); if(onEnded)onEnded();} });
    context.onError(() => {
      if (token !== currentToken) return;
      stop();
      notify({playing:false,key:'',error:'声音暂时没响，我们先一起读一读吧。'});
    });
    context.src = assets.resolve(src);
    context.play();
    notify({playing:true,key});
    return true;
  } catch (_) {
    stop();
    notify({playing:false,key:'',error:'声音暂时没响，我们先一起读一读吧。'});
    return false;
  }
}
module.exports = {play,stop,subscribe,audioMap};
