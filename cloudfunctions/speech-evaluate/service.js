const crypto = require('crypto');
const { fault } = require('./soe');
const { hash, ref, get, put } = require('./data');
const { access, requireFamily } = require('./family');
const { archive, playback, audioHash, publicRecording } = require('./recordings');
const integer = (value, fallback, max) => /^\d+$/.test(value || '') && Number(value) > 0 ? Math.min(Number(value), max) : fallback;
const dayAt = ms => new Date(ms + 8 * 3600000).toISOString().slice(0, 10);
function createHandler({ db, storage, catalog, evaluate, parseBuffer, env, now = Date.now, uuid = crypto.randomUUID }) {
  return async (event, openid) => {
    let stage = 'configuration';
    try {
      if (!openid) throw fault('UNAUTHORIZED');
      if (!event || !['access','request-access','begin','evaluate','history','save-recording','playback'].includes(event.action)) throw fault('BAD_REQUEST');
      stage = 'family';
      if (['access','request-access'].includes(event.action)) return await access(db, openid, event.action === 'request-access', now());
      const { learnerId } = await requireFamily(db, openid);
      if (env.SPEECH_ENABLED !== 'true') throw fault('DISABLED');
      if (typeof event.lessonId !== 'string' || !Number.isSafeInteger(event.lessonVersion) || typeof event.activityId !== 'string') throw fault('BAD_REQUEST');
      const key = `${event.lessonId}:${event.lessonVersion}:${event.activityId}`;
      if (!Object.prototype.hasOwnProperty.call(catalog, key)) throw fault('COURSE_UNAVAILABLE');
      const target = catalog[key], summaryId = hash('learner', learnerId, key), time = now();
      if (event.action === 'history') {
        stage = 'history';
        // Import each approved account's old score once, without deleting the original.
        await db.runTransaction(async tx => {
          const oldId = hash(openid, key), old = await get(tx, 'speech_summaries', oldId);
          if (!old || old.migratedTo) return;
          await requireFamily(tx, openid, learnerId);
          const shared = await get(tx, 'speech_summaries', summaryId);
          await put(tx, 'speech_summaries', summaryId, { ...(shared || {}), learnerId, key, best: Math.max(shared ? shared.best : 0, old.best), attempts: (shared ? shared.attempts : 0) + old.attempts, latest: shared ? shared.latest : old.latest, ...(!shared || old.best > shared.best ? {bestAttemptId: null, bestAt: 0} : {}) });
          await ref(tx, 'speech_summaries', oldId).update({ data: { migratedTo: summaryId } });
        });
        const summary = await get(db, 'speech_summaries', summaryId);
        await requireFamily(db, openid, learnerId);
        return { ok: true, best: summary ? summary.best : null, attempts: summary ? summary.attempts : 0, recording: publicRecording(summary) };
      }
      if (env.SPEECH_STORAGE_PRIVATE !== 'true') throw fault('STORAGE_NOT_CONFIGURED');
      if (event.action === 'playback') {
        const response = await playback({ db, storage, summaryId });
        await requireFamily(db, openid, learnerId);
        return response;
      }
      if (event.action === 'begin') {
        if (!/^\d+$/.test(env.SOE_APP_ID || '') || !env.SOE_SECRET_ID || !env.SOE_SECRET_KEY) throw fault('CONFIGURATION_ERROR');
        const attemptId = uuid(), day = dayAt(time), userId = hash(learnerId, day), globalId = `global:${day}`;
        stage = 'reserve';
        await db.runTransaction(async tx => {
          await requireFamily(tx, openid, learnerId);
          const user = await get(tx, 'speech_quotas', userId), global = await get(tx, 'speech_quotas', globalId);
          if ((user && user.count >= integer(env.SPEECH_DAILY_LIMIT,60,1000)) || (global && global.count >= integer(env.SPEECH_GLOBAL_DAILY_LIMIT,1000,100000))) throw fault('DAILY_LIMIT');
          if (user && time - user.updatedAt < 3000) throw fault('TOO_FAST');
          await put(tx,'speech_quotas',userId,{count:(user ? user.count : 0)+1,updatedAt:time,day});
          await put(tx,'speech_quotas',globalId,{count:(global ? global.count : 0)+1,updatedAt:time,day});
          await put(tx,'speech_attempts',attemptId,{openid,learnerId,key,summaryId,text:target.text,state:'pending',createdAt:time,expiresAt:time+120000});
        });
        return {ok:true,attemptId};
      }
      if (typeof event.attemptId !== 'string' || !/^[a-zA-Z0-9-]{16,64}$/.test(event.attemptId)) throw fault('BAD_REQUEST');
      if (typeof event.audio !== 'string' || event.audio.length > 160000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(event.audio)) throw fault('INVALID_AUDIO');
      const audio = Buffer.from(event.audio,'base64');
      if (audio.length < 100 || audio.length > 120000) throw fault('INVALID_AUDIO');
      let response;
      if (event.action === 'evaluate') {
        let metadata;
        try { metadata = await parseBuffer(audio,{mimeType:'audio/mpeg',size:audio.length},{duration:true}); } catch (_) { throw fault('INVALID_AUDIO'); }
        const f = metadata.format;
        if (f.container !== 'MPEG' || f.codec !== 'MPEG 2 Layer 3' || f.sampleRate !== 16000 || f.numberOfChannels !== 1 || !Number.isFinite(f.duration) || f.duration < 0.3 || f.duration > 16) throw fault('INVALID_AUDIO');
        stage = 'claim';
        const claim = await db.runTransaction(async tx => {
          await requireFamily(tx,openid,learnerId);
          const attempt = await get(tx,'speech_attempts',event.attemptId);
          if (!attempt || attempt.openid !== openid || attempt.key !== key || attempt.learnerId !== learnerId) throw fault('UNAUTHORIZED');
          if (attempt.state === 'done') { if (attempt.audioHash !== audioHash(audio)) throw fault('UNAUTHORIZED'); return {cached:attempt.result}; }
          if (attempt.state !== 'pending' || attempt.expiresAt < time) throw fault('ATTEMPT_EXPIRED');
          await ref(tx,'speech_attempts',event.attemptId).update({data:{state:'processing'}});
          return {createdAt:attempt.createdAt};
        });
        response = claim.cached;
        if (!response) {
          try {
            stage = 'provider';
            const result = await evaluate(audio,target,{appId:env.SOE_APP_ID,secretId:env.SOE_SECRET_ID,secretKey:env.SOE_SECRET_KEY});
            stage = 'save';
            response = await db.runTransaction(async tx => {
              await requireFamily(tx, openid, learnerId);
              const summary = await get(tx,'speech_summaries',summaryId);
              const wins = !summary || result.score > summary.best || result.score === summary.best && claim.createdAt >= (summary.bestAt || 0);
              const attempts = (summary ? summary.attempts : 0)+1;
              const best = Math.max(summary ? summary.best : 0,result.score);
              const latestWins = !summary || claim.createdAt >= (summary.latestAt || 0);
              const next = {...(summary || {}),learnerId,key,best,attempts,updatedAt:now()};
              if (wins) Object.assign(next,{bestAttemptId:event.attemptId,bestAt:claim.createdAt});
              if (latestWins) Object.assign(next,{latest:result,latestAt:claim.createdAt});
              await put(tx,'speech_summaries',summaryId,next);
              const saved = {result,best,attempts};
              await ref(tx,'speech_attempts',event.attemptId).update({data:{state:'done',result:saved,audioHash:audioHash(audio),finishedAt:now()}});
              return saved;
            });
          } catch(error) {
            try { await ref(db,'speech_attempts',event.attemptId).update({data:{state:'failed',finishedAt:now()}}); } catch(_) {}
            throw error;
          }
        }
      } else {
        const attempt = await get(db,'speech_attempts',event.attemptId);
        if (!attempt || attempt.openid !== openid || attempt.key !== key || attempt.state !== 'done' || attempt.learnerId !== learnerId || attempt.audioHash !== audioHash(audio)) throw fault('UNAUTHORIZED');
        response = attempt.result;
      }
      await requireFamily(db,openid,learnerId);
      // New clients display the real score before starting a separate, awaited
      // save-recording invocation. Never leave work running after this returns.
      if (event.action === 'evaluate' && event.deferRecording === true) {
        const summary = await get(db,'speech_summaries',summaryId);
        await requireFamily(db, openid, learnerId);
        const saved = summary.recording && summary.recording.attemptId === event.attemptId;
        return {ok:true,...response,best:summary.best,attempts:summary.attempts,recording:publicRecording(summary),recordingStatus:saved?'saved':summary.bestAttemptId===event.attemptId?'pending':'not-best'};
      }
      stage = 'archive';
      let recordingStatus;
      try { recordingStatus = await archive({db,storage,learnerId,attemptId:event.attemptId,openid,key,summaryId,audio,now,uuid}); }
      catch(error) { if (error.code === 'FAMILY_ONLY') throw error; recordingStatus = 'failed'; console.warn('SUSU_SPEECH_ERROR',JSON.stringify({stage,code:'STORAGE_ERROR'})); }
      const summary = await get(db,'speech_summaries',summaryId);
      await requireFamily(db, openid, learnerId);
      return {ok:true,...response,best:summary.best,attempts:summary.attempts,recording:publicRecording(summary),recordingStatus};
    } catch(error) {
      const allowed = ['FAMILY_ONLY','STORAGE_NOT_CONFIGURED','STORAGE_ERROR','NO_RECORDING','SAVE_BUSY','UNAUTHORIZED','UNAVAILABLE','BAD_REQUEST','COURSE_UNAVAILABLE','DAILY_LIMIT','TOO_FAST','INVALID_AUDIO','ATTEMPT_EXPIRED','NO_SPEECH','INVALID_RESULT','TIMEOUT','EVALUATION_FAILED','DISABLED','CONFIGURATION_ERROR','PROVIDER_AUTH','SERVICE_NOT_ENABLED','RESOURCE_EXHAUSTED','ACCOUNT_OVERDUE','PROVIDER_BUSY'];
      const code = allowed.includes(error.code) ? error.code : ['family','history','reserve','claim','save'].includes(stage) ? 'DATABASE_ERROR' : 'INTERNAL_ERROR';
      console.warn('SUSU_SPEECH_ERROR',JSON.stringify({stage,code}));
      return {ok:false,code};
    }
  };
}
module.exports = {createHandler,dayAt};
