const speech = require('../../services/speech');
const messages = {
  STORAGE_NOT_CONFIGURED: 'Recording storage is not ready. Ask a grown-up to check settings.',
  STORAGE_ERROR: 'The saved recording could not open. Please try again.',
  NO_RECORDING: 'No saved recording yet.',
  UNAVAILABLE: 'Scoring is not ready yet. You can still listen and learn.',
  DISABLED: 'Scoring is switched off. Ask a grown-up to check the service.',
  CONFIGURATION_ERROR: 'Scoring setup is incomplete. Ask a grown-up to check the service.',
  PROVIDER_AUTH: 'Scoring could not sign in. Ask a grown-up to check the service.',
  SERVICE_NOT_ENABLED: 'The speech scoring service is not enabled for this account.',
  RESOURCE_EXHAUSTED: 'Scoring credits are used up. Ask a grown-up to check the service.',
  ACCOUNT_OVERDUE: 'Scoring is paused because of an unpaid service balance.',
  PROVIDER_BUSY: 'Scoring is busy. Please try again later.',
  DATABASE_ERROR: 'Scores could not be saved. Please try again later.',
  INTERNAL_ERROR: 'Scoring had a server problem. Please try again later.',
  COURSE_UNAVAILABLE: 'Scoring is not ready for this lesson yet.',
  NETWORK: 'We could not connect. Please try again later.',
  CONSENT_DIALOG: 'The parent confirmation could not open. Please try again.',
  PERMISSION: 'Ask a grown-up to allow the microphone, then try again.',
  RECORDING: 'The microphone could not start. Please try again.',
  INTERRUPTED: 'Recording stopped. Let’s try again.',
  BUSY: 'The microphone is still stopping. Please try again.',
  INVALID_AUDIO: 'The recording was not ready. Let’s record again.',
  NO_SPEECH: 'We could not hear you clearly. Let’s try again.',
  TIMEOUT: 'Scoring took too long. Please try again later.',
  DAILY_LIMIT: 'Great practice today! You can keep listening.',
  TOO_FAST: 'Take a little breath, then try again.',
  ATTEMPT_EXPIRED: 'Let’s make a new recording.',
  UNAUTHORIZED: 'Scoring could not start. Please reopen this lesson.'
};
// Display rewards, independently of lesson-completion stars.
function starsForScore(score) {
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) return 0;
  return score >= 80 ? 3 : score >= 60 ? 2 : 1;
}
Component({
  properties: { target: { type: Object, value: null } },
  data: { savingRecording: false, saved: null, saveFailed: false, savedPlaying: false, state: 'idle', seconds: 0, clip: false, playing: false, message: '', result: null, best: null, attempts: 0, details: false, permission: false, errorCode: '', starCount: 0, stars: [1, 2, 3], celebrating: false },
  observers: { target() { if (this.alive) this.resetTarget(); } },
  lifetimes: {
    attached() { this.alive = true; this.generation = 0; this.resetTarget(); },
    detached() { this.alive = false; this.cancelSession(); }
  },
  pageLifetimes: { hide() { this.cancelSession(); } },
  methods: {
    valid(generation) { return this.alive && this.generation === generation; },
    stopPlayback() {
      if (this.player) { this.player.stop(); this.player.destroy(); this.player = null; }
      if (this.alive) this.setData({ playing: false, savedPlaying: false });
    },
    pauseForExample() {
      if (this.data.state !== 'idle') this.cancelSession();
      else this.stopPlayback();
    },
    cancelSession() {
      this.generation = (this.generation || 0) + 1;
      clearInterval(this.clock);
      clearTimeout(this.celebrationTimer);
      if (this.recording) { this.recording.cancel(); this.recording = null; }
      this.stopPlayback();
      speech.removeFile(this.path); this.path = '';
      speech.removeFile(this.savedPath); this.savedPath = '';
      if(this.alive)this.setData({saveFailed:false,savingRecording:false});
      if (this.alive) this.setData({ state: 'idle', clip: false, seconds: 0, celebrating: false });
    },
    async resetTarget() {
      this.cancelSession();
      this.setData({ saved: null, result: null, best: null, attempts: 0, starCount: 0, message: '', errorCode: '', details: false, permission: false });
      if (!this.data.target || !speech.configured()) {
        if (this.data.target) this.setData({ message: messages.UNAVAILABLE });
        return;
      }
      const generation = this.generation;
      try {
        const history = await speech.call('history', this.data.target);
        if (this.valid(generation)) this.setData({ saved: history.recording || null, best: history.best, attempts: history.attempts, starCount: starsForScore(history.best), message: '', errorCode: '' });
      } catch (error) { if (this.valid(generation)) this.showError(error); }
    },
    showAward(response, generation) {
      this.setData({ saved: response.recording || null, saveFailed: response.recordingStatus === 'failed', result: response.result, best: response.best, attempts: response.attempts, starCount: starsForScore(response.result.score), celebrating: true, message: '', errorCode: '' });
      clearTimeout(this.celebrationTimer);
      this.celebrationTimer = setTimeout(() => { if (this.valid(generation)) this.setData({ celebrating: false }); }, 1800);
    },
    showError(error) {
      if (error.code === 'CANCELLED') return;
      if (error.code === 'FAMILY_ONLY') { this.cancelSession(); this.triggerEvent('denied'); return; }
      this.setData({ errorCode: error.code || 'UNKNOWN', message: messages[error.code] || 'Scoring did not finish. Please try again later.', permission: error.code === 'PERMISSION' });
    },
    async startRecord() {
      if (this.data.state !== 'idle') return;
      if (!speech.configured()) { this.setData({ message: messages.UNAVAILABLE }); return; }
      this.cancelSession();
      const generation = this.generation, target = { ...this.data.target };
      this.triggerEvent('recording');
      this.setData({ state: 'preparing', message: '', errorCode: '', result: null, starCount: 0, celebrating: false, permission: false });
      try {
        const access = await speech.call('access', {});
        if (!access.allowed) throw {code:'FAMILY_ONLY'};
        if (!this.valid(generation)) return;
        await speech.authorize();
        if (!this.valid(generation)) return;
        const attempt = await speech.call('begin', target);
        if (!this.valid(generation)) return;
        this.attemptId = attempt.attemptId;
        this.recording = speech.record({
          start: () => {
            if (!this.valid(generation)) return;
            this.setData({ state: 'recording', seconds: 0 });
            const start = Date.now();
            this.clock = setInterval(() => { if (this.valid(generation)) this.setData({ seconds: Math.min(15, Math.floor((Date.now() - start) / 1000)) }); }, 250);
          },
          stop: result => this.submitRecording(result, target, generation),
          error: error => { clearInterval(this.clock); this.recording = null; if (this.valid(generation)) { this.setData({ state: 'idle' }); this.showError(error); } }
        });
      } catch (error) { if (this.valid(generation)) { this.setData({ state: 'idle' }); this.showError(error); } }
    },
    stopRecord() {
      if (this.data.state !== 'recording' || !this.recording) return;
      this.setData({ state: 'scoring' });
      this.recording.stop();
    },
    async submitRecording(recording, target, generation) {
      clearInterval(this.clock); this.recording = null;
      if (!this.valid(generation)) { speech.removeFile(recording.tempFilePath); return; }
      this.path = recording.tempFilePath;
      this.setData({ clip: true, state: 'scoring' });
      try {
        if (recording.duration < 300) throw { code: 'NO_SPEECH' };
        const audio = await speech.readAudio(this.path);
        if (!this.valid(generation)) return;
        const attemptId = this.attemptId;
        const response = await speech.call('evaluate', target, { attemptId, audio, deferRecording: true });
        if (this.valid(generation)) this.showAward(response, generation);
        // Own the Base64 independently of the component's temporary file.
        // Finish saving even if the child changes activities while evaluating.
        if (response.recordingStatus === 'pending') {
          if (this.valid(generation)) this.setData({savingRecording:true});
          this.saveAfterScore(target, attemptId, audio, generation);
        }
      } catch (error) { if (this.valid(generation)) this.showError(error); }
      finally { if (this.valid(generation)) this.setData({ state: 'idle' }); }
    },
    async saveAfterScore(target, attemptId, audio, generation) {
      try {
        const response=await speech.call('save-recording',target,{attemptId,audio});
        if(this.valid(generation))this.setData({saved:response.recording||null,saveFailed:response.recordingStatus==='failed'});
      } catch(error) {
        if(this.valid(generation)) {
          if(error.code==='FAMILY_ONLY')this.showError(error);
          else this.setData({saveFailed:true});
        }
      } finally {if(this.valid(generation))this.setData({savingRecording:false});}
    },
    async retrySave() {
      if(!this.path || this.data.state!=='idle')return;
      const generation=this.generation;
      this.setData({state:'saving'});
      try{const audio=await speech.readAudio(this.path);if(!this.valid(generation))return;
        const response=await speech.call('save-recording',this.data.target,{attemptId:this.attemptId,audio});
        if(this.valid(generation))this.setData({saved:response.recording||null,saveFailed:response.recordingStatus==='failed'});
      }catch(error){if(this.valid(generation))this.showError(error);}
      finally{if(this.valid(generation))this.setData({state:'idle'});}
    },
    async playSaved() {
      if(this.data.state!=='idle')return;
      if(this.data.savedPlaying){this.stopPlayback();return;}
      const generation=this.generation;this.triggerEvent('recording');this.stopPlayback();this.setData({state:'loading'});
      let path;
      try{const response=await speech.call('playback',this.data.target);if(!this.valid(generation))return;
        path=await speech.writeAudio(response.audio);
        if(!this.valid(generation)){speech.removeFile(path);return;}
        speech.removeFile(this.savedPath);this.savedPath=path;
        this.playPath(path,true);
      }catch(error){if(this.valid(generation))this.showError(error);}
      finally{if(this.valid(generation))this.setData({state:'idle'});}
    },
    playPath(path,saved=false) {
      this.stopPlayback();
      const player=wx.createInnerAudioContext();this.player=player;
      player.onEnded(()=>{if(this.player===player)this.stopPlayback();});
      player.onError(()=>{if(this.alive&&this.player===player){this.stopPlayback();this.setData({message:'The recording could not play. Please try again.'});}});
      player.src=path;player.play();this.setData({playing:!saved,savedPlaying:saved});
    },
    playMine() {
      if (!this.path || this.data.state !== 'idle') return;
      if (this.data.playing) { this.stopPlayback(); return; }
      this.triggerEvent('recording'); this.stopPlayback();
      const player = wx.createInnerAudioContext(); this.player = player;
      player.onEnded(() => { if (this.player === player) this.stopPlayback(); });
      player.onError(() => { if (!this.alive || this.player !== player) return; this.stopPlayback(); this.setData({ message: 'The recording could not play. Let’s record again.' }); });
      player.src = this.path; player.play(); this.setData({ playing: true });
    },
    toggleDetails() { this.setData({ details: !this.data.details }); },
    openSettings() { wx.openSetting({}); }
  }
});
