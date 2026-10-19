const config = require('../config/speech');
let cloudReady = false;
let recorder;
let owner = null;
let parentConsent = false;
const fail = code => Object.assign(new Error(code), { code });
function configured() { return !!(config.env && wx.cloud && wx.cloud.callFunction); }
async function call(action, target, extra = {}) {
  if (!configured()) throw fail('UNAVAILABLE');
  if (!cloudReady) { wx.cloud.init({ env: config.env, traceUser: false }); cloudReady = true; }
  let response, timer;
  try {
    response = await Promise.race([
      wx.cloud.callFunction({ name: config.functionName, data: { action, ...target, ...extra }, slow: action === 'evaluate' }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(fail('TIMEOUT')), 30000); })
    ]);
  } catch (error) { throw fail(error.code === 'TIMEOUT' ? 'TIMEOUT' : 'NETWORK'); }
  finally { clearTimeout(timer); }
  const result = response && response.result;
  if (!result || result.ok !== true) throw fail(result && result.code || 'UNAVAILABLE');
  return result;
}
function api(name, options = {}) {
  return new Promise((resolve, reject) => wx[name]({ ...options, success: resolve, fail: reject }));
}
async function authorize() {
  if (!parentConsent) {
    let answer;
    try { answer = await api('showModal', {
      title: '请家长确认',
      content: '跟读时会使用麦克风，将本次英语录音发送至腾讯云用于发音评分。成绩会长期保存，每道跟读活动保留一份最高分录音，同分保留较新的一次，供已获批准且使用同一录音档案的账号回听。可以跳过跟读继续学习。',
      confirmText: '同意继续', cancelText: '暂不使用'
    }); } catch (_) { throw fail('CONSENT_DIALOG'); }
    if (!answer.confirm) throw fail('CANCELLED');
    parentConsent = true;
  }
  try {
    if (wx.requirePrivacyAuthorize) await api('requirePrivacyAuthorize');
    await api('authorize', { scope: 'scope.record' });
  } catch (_) { throw fail('PERMISSION'); }
}
function manager() {
  if (recorder) return recorder;
  recorder = wx.getRecorderManager();
  recorder.onStart(() => {
    if (!owner) return;
    if (owner.cancelled) { recorder.stop(); return; }
    owner.callbacks.start();
  });
  recorder.onStop(result => {
    const session = owner; owner = null;
    if (!session) return;
    if (session.cancelled) { removeFile(result.tempFilePath); return; }
    session.callbacks.stop(result);
  });
  recorder.onError(() => {
    const session = owner; owner = null;
    if (session && !session.cancelled) session.callbacks.error(fail('RECORDING'));
  });
  if (recorder.onInterruptionBegin) recorder.onInterruptionBegin(() => {
    const session = owner;
    if (session && !session.cancelled) { session.cancelled = true; session.callbacks.error(fail('INTERRUPTED')); recorder.stop(); }
  });
  return recorder;
}
function record(callbacks) {
  const current = manager();
  if (owner) throw fail('BUSY');
  const session = { callbacks, cancelled: false };
  owner = session;
  try {
    current.start({ duration: config.maxDuration, sampleRate: 16000, numberOfChannels: 1, encodeBitRate: 48000, format: 'mp3' });
  } catch (_) { owner = null; throw fail('RECORDING'); }
  return {
    stop() { if (owner === session) current.stop(); },
    cancel() { if (owner === session) { session.cancelled = true; current.stop(); } }
  };
}
function cancelAll() { if (owner) { owner.cancelled = true; recorder.stop(); } }
function removeFile(path) {
  if (!path) return;
  try { wx.getFileSystemManager().unlink({ filePath: path, fail() {} }); } catch (_) {}
}
function readAudio(path) {
  return new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager();
    fs.getFileInfo({ filePath: path, success(info) {
      if (info.size > config.maxBytes || info.size < 100) return reject(fail('INVALID_AUDIO'));
      fs.readFile({ filePath: path, encoding: 'base64', success: value => resolve(value.data), fail: () => reject(fail('INVALID_AUDIO')) });
    }, fail: () => reject(fail('INVALID_AUDIO')) });
  });
}
function clearPlaybackCache() {
  try {
    const root=wx.env.USER_DATA_PATH;
    wx.getFileSystemManager().readdir({dirPath:root,success(value){
      (value.files||[]).filter(name=>/^speech-[0-9]+-[a-z0-9]+\.mp3$/.test(name)).forEach(name=>removeFile(root+'/'+name));
    },fail(){}});
  }catch(_){}
}
async function access() {
  if (!configured()) return { allowed: false };
  return call('access', {});
}
function writeAudio(audio) {
  return new Promise((resolve, reject) => {
    const path = `${wx.env.USER_DATA_PATH}/speech-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`;
    wx.getFileSystemManager().writeFile({ filePath: path, data: audio, encoding: 'base64', success: () => resolve(path), fail: () => { removeFile(path); reject(fail('STORAGE_ERROR')); } });
  });
}
module.exports = { clearPlaybackCache, access, writeAudio, configured, authorize, call, record, cancelAll, readAudio, removeFile };
