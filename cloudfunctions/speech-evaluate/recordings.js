const crypto = require('crypto');
const { ref, get, put } = require('./data');
const { fault } = require('./soe');
const { requireFamily } = require('./family');
const audioHash = audio => crypto.createHash('sha256').update(audio).digest('hex');
const ready = recording => recording && recording.state === 'active';
function publicRecording(summary) {
  const recording = summary && summary.recording;
  return recording ? { score: recording.score, savedAt: recording.savedAt, result: recording.result } : null;
}
async function archive({ db, storage, attemptId, openid, learnerId, key, summaryId, audio, now, uuid }) {
  const attempt = await get(db, 'speech_attempts', attemptId);
  if (!attempt || attempt.openid !== openid || attempt.key !== key || attempt.state !== 'done' || attempt.learnerId !== learnerId || attempt.audioHash !== audioHash(audio)) throw fault('UNAUTHORIZED');
  const current = await get(db, 'speech_summaries', summaryId);
  if (current && current.recording && current.recording.attemptId === attemptId) return 'saved';
  if (!current || current.bestAttemptId !== attemptId) return 'not-best';
  const path = `speech/${learnerId}/${summaryId}/${attemptId}.mp3`;
  const fileID = await storage.fileId(path);
  const token = uuid(), started = now();
  const acquired = await db.runTransaction(async transaction => {
    await requireFamily(transaction, openid, learnerId);
    const summary = await get(transaction, 'speech_summaries', summaryId);
    if (!summary || summary.bestAttemptId !== attemptId) return false;
    const previous = await get(transaction, 'speech_recordings', attemptId);
    // An upload/deletion in progress owns this path until its lease expires.
    if (previous && (previous.state === 'deleting' || previous.state === 'staging' && previous.expiresAt > started)) throw fault('SAVE_BUSY');
    if (previous && ready(previous)) return false;
    await put(transaction, 'speech_recordings', attemptId, {
      learnerId: learnerId, summaryId, path, fileID, token, state: 'staging', expiresAt: started + 600000, createdAt: started
    });
    return true;
  });
  if (!acquired) return 'not-best';
  try {
    const uploaded = await storage.upload(path, audio);
    if (uploaded !== fileID) throw fault('STORAGE_ERROR');
    const saved = await db.runTransaction(async transaction => {
      await requireFamily(transaction, openid, learnerId);
      const summary = await get(transaction, 'speech_summaries', summaryId);
      const journal = await get(transaction, 'speech_recordings', attemptId);
      if (!journal || journal.token !== token || journal.state !== 'staging') throw fault('SAVE_BUSY');
      if (!summary || summary.bestAttemptId !== attemptId) {
        await ref(transaction, 'speech_recordings', attemptId).update({ data: { state: 'obsolete', expiresAt: now() + 600000 } });
        return false;
      }
      const old = summary.recording;
      if (old && old.attemptId !== attemptId) await ref(transaction, 'speech_recordings', old.attemptId).update({ data: { state: 'obsolete', expiresAt: now() + 600000 } });
      const recording = { attemptId, fileID, score: attempt.result.result.score, result: attempt.result.result, text: attempt.text, audioHash: attempt.audioHash, savedAt: attempt.createdAt };
      await ref(transaction, 'speech_summaries', summaryId).update({ data: { recording } });
      await ref(transaction, 'speech_recordings', attemptId).update({ data: { state: 'active', expiresAt: 0 } });
      return true;
    });
    return saved ? 'saved' : 'not-best';
  } catch (error) {
    // Keep staging journal: periodic cleanup can delete an upload whose reply was lost.
    try {
      await db.runTransaction(async transaction => {
        const journal = await get(transaction, 'speech_recordings', attemptId);
        if (journal && journal.token === token && journal.state === 'staging') await ref(transaction, 'speech_recordings', attemptId).update({ data: { state: 'obsolete', expiresAt: now() + 600000 } });
      });
    } catch (_) {}
    throw error;
  }
}
async function playback({ db, storage, summaryId }) {
  const summary = await get(db, 'speech_summaries', summaryId);
  if (!summary || !summary.recording) throw fault('NO_RECORDING');
  const recording = summary.recording;
  const journal = await get(db, 'speech_recordings', recording.attemptId);
  if (!ready(journal) || journal.summaryId !== summaryId || journal.fileID !== recording.fileID) throw fault('NO_RECORDING');
  const content = await storage.download(recording.fileID);
  if (!Buffer.isBuffer(content) || content.length > 120000 || audioHash(content) !== recording.audioHash) throw fault('STORAGE_ERROR');
  return { ok: true, audio: content.toString('base64'), score: recording.score };
}
module.exports = { archive, playback, audioHash, publicRecording };
