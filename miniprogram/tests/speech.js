const assert = require('node:assert/strict');
const clone = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));
const config = require('../config/speech');
// Exercise an unconfigured environment independently of the deployment ID.
config.env = '';
let managerCallbacks = {}, starts = [], deleted = [], cloudCalls = [], consent = true, modalFailure = false, authorizationCalls = 0;
const recorder = {
  onStart(fn) { managerCallbacks.start = fn; }, onStop(fn) { managerCallbacks.stop = fn; }, onError(fn) { managerCallbacks.error = fn; },
  onInterruptionBegin(fn) { managerCallbacks.interrupt = fn; }, start(options) { starts.push(options); }, stop() {}
};
global.wx = {
  cloud: { init() {}, async callFunction(options) { cloudCalls.push(options); return { result: { ok: true } }; } },
  showModal(options) {
    if (modalFailure) return options.fail({ errMsg: 'showModal:fail' });
    if ([...options.confirmText].length > 4 || [...options.cancelText].length > 4) return options.fail({ errMsg: 'showModal:fail confirmText length should not exceed 4 characters' });
    options.success({ confirm: consent });
  }, requirePrivacyAuthorize(options) { options.success(); }, authorize(options) { authorizationCalls++; options.success(); },
  getRecorderManager() { return recorder; },
  getFileSystemManager() { return { unlink(options) { deleted.push(options.filePath); }, getFileInfo(options) { options.success({ size: 3000 }); }, readFile(options) { options.success({ data: 'base64audio' }); } }; }
};
const speech = require('../services/speech');
(async () => {
  assert(!speech.configured()); await assert.rejects(speech.call('history', {}), { code: 'UNAVAILABLE' });
  config.env = 'test-env'; assert(speech.configured());
  modalFailure = true; await assert.rejects(speech.authorize(), { code: 'CONSENT_DIALOG' }); assert.equal(authorizationCalls, 0); modalFailure = false;
  consent = false; await assert.rejects(speech.authorize(), { code: 'CANCELLED' }); consent = true; await speech.authorize(); assert.equal(authorizationCalls, 1);
  await speech.call('begin', { lessonId: 'dressed' }); assert.equal(cloudCalls[0].data.lessonId, 'dressed'); assert.equal(cloudCalls[0].slow, false);
  wx.cloud.callFunction = async () => ({ result: { ok: false, code: 'DAILY_LIMIT' } });
  await assert.rejects(speech.call('begin', {}), { code: 'DAILY_LIMIT' });
  let stopped = 0, started = 0, interrupted = 0;
  const callbacks = { start() { started++; }, stop() { stopped++; }, error() { interrupted++; } };
  const first = speech.record(callbacks); assert.equal(starts[0].sampleRate, 16000); assert.equal(starts[0].format, 'mp3'); assert.equal(starts[0].duration, 15000);
  first.cancel(); assert.throws(() => speech.record(callbacks), { code: 'BUSY' });
  managerCallbacks.start(); managerCallbacks.stop({ tempFilePath: 'stale' }); assert.equal(started, 0); assert.equal(stopped, 0); assert(deleted.includes('stale'));
  speech.record(callbacks); managerCallbacks.start(); assert.equal(started, 1); managerCallbacks.interrupt(); managerCallbacks.stop({ tempFilePath: 'interrupted' }); assert.equal(interrupted, 1); assert.equal(stopped, 0);
  speech.record(callbacks); managerCallbacks.stop({ tempFilePath: 'current' }); assert.equal(stopped, 1);
  speech.record(callbacks); speech.cancelAll(); managerCallbacks.stop({ tempFilePath: 'hidden' }); assert.equal(stopped, 1);
  assert.equal(await speech.readAudio('current'), 'base64audio');
  wx.getFileSystemManager = () => ({ getFileInfo(options) { options.success({ size: 120001 }); } });
  await assert.rejects(speech.readAudio('large'), { code: 'INVALID_AUDIO' });
  // Component lifecycle with a fake cloud response and recorder, without using a real microphone.
  let definition, capture, evaluateResolve, latestPlayer;
  const original = { ...speech };
  Object.assign(speech, {
    configured: () => true, authorize: async () => {}, removeFile: path => { if (path) deleted.push(path); }, readAudio: async () => 'audio',
    record(callbacks) { capture = callbacks; return { stop() {}, cancel() {} }; },
    call: async action => action === 'access' ? {allowed:true} : action === 'history' ? { best: null, attempts: 0 } : action === 'begin' ? { attemptId: 'test-attempt-12345678' } : new Promise(resolve => { evaluateResolve = resolve; })
  });
  wx.createInnerAudioContext = () => {
    const callbacks = {}; latestPlayer = { onEnded(fn) { callbacks.end = fn; }, onError(fn) { callbacks.error = fn; }, play() {}, stop() {}, destroy() {}, callbacks };
    return latestPlayer;
  };
  global.Component = value => { definition = value; };
  require('../components/speech-practice/index');
  function component(activityId = 'word-0') {
    const c = { ...definition.methods, data: { ...clone(definition.data), target: { lessonId: 'dressed', lessonVersion: 1, activityId } }, setData(value) { Object.assign(this.data, value); }, triggerEvent() {} };
    definition.lifetimes.attached.call(c); return c;
  }
  const c = component(); await tick();
  await c.startRecord(); capture.start(); assert.equal(c.data.state, 'recording'); c.stopRecord(); assert.equal(c.data.state, 'scoring');
  capture.stop({ tempFilePath: 'clip-1', duration: 1000 }); await tick();
  evaluateResolve({ result: { score: 0, accuracy: 0 }, best: 0, attempts: 1 }); await tick();
  assert(c.data.celebrating); assert.equal(c.data.starCount, 1); assert.equal(c.data.stars.length, 3);
  for (const [score, stars] of [[0,1],[59,1],[60,2],[79,2],[80,3],[100,3]]) { c.showAward({ result: { score }, best: score, attempts: 1 }, c.generation); assert.equal(c.data.starCount, stars); }
  c.showAward({ result: { score: 0, accuracy: 0 }, best: 0, attempts: 1 }, c.generation);
  assert.equal(c.data.state, 'idle'); assert.equal(c.data.best, 0); assert.equal(c.data.result.score, 0); assert(c.data.clip);
  await new Promise(resolve => setTimeout(resolve, 1850)); assert(!c.data.celebrating, 'Celebration should finish'); assert.equal(c.data.starCount, 1, 'Stars should remain visible after animation');
  c.playMine(); assert(c.data.playing); assert.equal(latestPlayer.src, 'clip-1'); c.pauseForExample(); assert(!c.data.playing); assert(c.data.clip, 'Listening to example should keep recorded clip');
  c.playMine(); const oldPlayer = latestPlayer; c.playMine(); assert(!c.data.playing, 'Playback button should stop replay'); c.playMine(); oldPlayer.callbacks.error(); assert(c.data.playing, 'Stale playback error must not stop new playback');
  await c.startRecord(); capture.start(); capture.stop({ tempFilePath: 'clip-2', duration: 1000 }); await tick();
  c.data.target.activityId = 'word-1'; c.resetTarget();
  evaluateResolve({ result: { score: 99 }, best: 99, attempts: 2 }); await tick();
  assert.equal(c.data.result, null); assert.equal(c.data.best, null); assert.equal(c.data.starCount, 0); assert(!c.data.celebrating); assert(deleted.includes('clip-2'));
  await c.startRecord(); capture.start(); definition.pageLifetimes.hide.call(c); assert.equal(c.data.state, 'idle');
  const before = cloudCalls.length; capture.stop({ tempFilePath: 'late', duration: 1000 }); await tick(); assert(deleted.includes('late')); assert.equal(cloudCalls.length, before);
  await c.startRecord(); capture.start(); capture.error({ code: 'INTERRUPTED' }); assert.equal(c.data.state, 'idle'); assert(c.data.message.includes('stopped'));
  await c.startRecord(); capture.start(); capture.stop({ tempFilePath: 'short', duration: 100 }); await tick(); assert(c.data.message.includes('hear')); assert.equal(c.data.result, null);
  speech.call = async action => action === 'access' ? {allowed:true} : action === 'history' ? { best: null, attempts: 0 } : { attemptId: 'test-attempt-12345678' };
  speech.authorize = async () => { throw { code: 'PERMISSION' }; };
  await c.startRecord(); assert(c.data.permission); assert.equal(c.data.state, 'idle');
  c.showError({ code: 'RESOURCE_EXHAUSTED' }); assert.equal(c.data.errorCode, 'RESOURCE_EXHAUSTED'); assert(c.data.message.includes('credits'));
  c.showError({ code: 'DATABASE_ERROR' }); assert(c.data.message.includes('saved'));
  speech.authorize=async()=>{};
  let denied=0;c.triggerEvent=event=>{if(event==='denied')denied++;};
  speech.call=async action=>action==='access'?{allowed:false}:{best:null,attempts:0};
  await c.startRecord();assert.equal(denied,1);assert.equal(c.data.state,'idle');
  // Saved playback uses an authenticated request and removes its local cache on hide.
  speech.call=async action=>action==='playback'?{audio:'saved-audio'}:{best:95,attempts:2,recording:{score:95}};
  speech.writeAudio=async bytes=>{assert.equal(bytes,'saved-audio');return 'saved-clip';};
  c.data.saved={score:95};await c.playSaved();assert(c.data.savedPlaying);assert.equal(latestPlayer.src,'saved-clip');
  c.cancelSession();assert(deleted.includes('saved-clip'));assert(!c.data.savedPlaying);
  definition.lifetimes.detached.call(c); assert.equal(c.alive, false);
  // Stars appear while storage is unresolved; changing activity must not cancel saving.
  let finishSave, saveStarted=0;
  speech.call=async(action,target,extra)=>{
    if(action==='history')return {best:null,attempts:0};
    if(action==='access')return {allowed:true};
    if(action==='begin')return {attemptId:'fast-attempt-12345678'};
    if(action==='evaluate'){assert.equal(extra.deferRecording,true);return {result:{score:88},best:88,attempts:1,recordingStatus:'pending'};}
    if(action==='save-recording'){saveStarted++;assert.equal(extra.attemptId,'fast-attempt-12345678');assert.equal(extra.audio,'audio');return new Promise(resolve=>{finishSave=resolve;});}
  };
  const fast=component();await tick();await fast.startRecord();capture.start();
  capture.stop({tempFilePath:'fast-clip',duration:1000});await tick();
  assert.equal(fast.data.state,'idle');assert.equal(fast.data.result.score,88);assert(fast.data.celebrating);assert(fast.data.savingRecording);assert.equal(saveStarted,1);
  fast.resetTarget();await tick();finishSave({recording:{score:88},recordingStatus:'saved'});await tick();
  assert.equal(fast.data.result,null);assert.equal(fast.data.saved,null,'Late archive reply must not change the next activity');
  definition.lifetimes.detached.call(fast);
  Object.assign(speech, original);
  const protocol = require('../services/course-data'), catalog = require('../data/local-courses');
  const targets = require('../services/speech-target');
  const cached = clone(catalog.lessons['english-getting-dressed']);
  delete cached.activities[0].speech;
  assert(targets.target(cached, cached.activities[0]));
  cached.activities[0].text = 'Changed content';
  assert.equal(targets.target(cached, cached.activities[0]), null);
  const l = clone(catalog.lessons['english-getting-dressed']);
  l.activities[0].speech.mode = 'word'; assert.throws(() => protocol.validateLesson(l));
  const invalid = clone(catalog.lessons['english-getting-dressed']); invalid.activities[0].text = '@@{invalid}'; assert.throws(() => protocol.validateLesson(invalid));
  console.log('Passed: recording permissions, size limits, recorder ownership, interruption, cancellation, local playback, zero score, stale results, page hide, target changes and speech schema.');
})().catch(error => { console.error(error); process.exitCode = 1; });
