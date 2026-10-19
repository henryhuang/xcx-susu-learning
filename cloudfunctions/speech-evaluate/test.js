const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { createHandler, dayAt } = require('./service');
const { evaluate, normalize, signedUrl, providerError } = require('./soe');
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
function database() {
  let data = {}, queue = Promise.resolve();
  function store(values) {
    return { collection: name => ({ doc: id => ({
      async get() { const value = clone(values[`${name}/${id}`]); return { data: value ? { ...value, _id: id } : value }; },
      async set({ data }) { assert(!Object.hasOwn(data, '_id'), 'CloudBase set cannot write _id'); values[`${name}/${id}`] = clone(data); },
      async update({ data }) { assert(values[`${name}/${id}`]); Object.assign(values[`${name}/${id}`], clone(data)); }
    }) }) };
  }
  return {
    collection: name => store(data).collection(name),
    runTransaction(fn) {
      const result = queue.then(async () => { const next = clone(data); const result = await fn(store(next)); data = next; return result; });
      queue = result.catch(() => {}); return result;
    },
    snapshot() { return clone(data); }
  };
}
const target = { text: 'zip up', mode: 'sentence' };
const base = { lessonId: 'dressed', lessonVersion: 1, activityId: 'zip' };
const env = { SPEECH_ENABLED: 'true', SOE_APP_ID: '123', SOE_SECRET_ID: 'id', SOE_SECRET_KEY: 'key' };
const format = { container: 'MPEG', codec: 'MPEG 2 Layer 3', sampleRate: 16000, numberOfChannels: 1, duration: 1 };
const result = { score: 82, accuracy: 85, fluency: 70, completion: 95 };
const audio = Buffer.alloc(6000, 1).toString('base64');
const summary = { SuggestedScore: 82, PronAccuracy: 85, PronFluency: .7, PronCompletion: .95, SentenceId: -1 };
(async () => {
  for (const [provider, code] of [[4002,'PROVIDER_AUTH'],[4003,'SERVICE_NOT_ENABLED'],[4004,'RESOURCE_EXHAUSTED'],[4005,'ACCOUNT_OVERDUE'],[4006,'PROVIDER_BUSY']]) assert.equal(providerError(provider).code, code);
  const brokenDatabase = { collection() { throw new Error('internal database detail must stay private'); } };
  const brokenHandler = createHandler({ db: brokenDatabase, catalog: { 'dressed:1:zip': target }, env, evaluate: async () => result, parseBuffer: async () => ({ format }) });
  assert.deepEqual(await brokenHandler({ ...base, action: 'history' }, 'child-a'), { ok: false, code: 'DATABASE_ERROR' });
  const {hash,put} = require('./data');
  const {memberId} = require('./family');
  const db=database(); let time=Date.UTC(2026,9,19), calls=0, score=82, failUpload=false;
  const files=new Map();
  const storage={fileId:async path=>'cloud://private/'+path,async upload(path,bytes){if(failUpload)throw Error('upload');files.set('cloud://private/'+path,bytes);return 'cloud://private/'+path;},download:async id=>files.get(id)};
  const dependencies={db,storage,catalog:{'dressed:1:zip':target},env:{...env,SPEECH_STORAGE_PRIVATE:'true'},now:()=>time,parseBuffer:async()=>({format}),evaluate:async(_,t)=>{calls++;assert.deepEqual(t,target);return {...result,score};}};
  const handler=createHandler(dependencies);
  const request=(action,extra={},user='child-a')=>handler({...base,action,...extra},user);
  assert.equal((await handler({...base,action:'begin'},'')).code,'UNAUTHORIZED');
  for(const action of ['history','begin','evaluate','save-recording','playback'])assert.equal((await request(action)).code,'FAMILY_ONLY');
  assert.equal(calls,0);assert.equal(files.size,0);
  assert.deepEqual(await request('access'),{ok:true,allowed:false,requestCode:''});
  assert.equal(Object.keys(db.snapshot()).length,0,'Access checks must not create applicants');
  const applicant=await request('request-access');assert(!applicant.allowed);assert.match(applicant.requestCode,/^[A-F0-9]{16}$/);
  assert.equal((await request('request-access')).requestCode,applicant.requestCode);
  await put(db,'speech_family',memberId('child-a'),{enabled:true,learnerId:'susu'});
  await put(db,'speech_family',memberId('child-b'),{enabled:true,learnerId:'susu'});
  assert.equal((await request('begin',{activityId:'unknown'})).code,'COURSE_UNAVAILABLE');
  assert.deepEqual(await request('history'),{ok:true,best:null,attempts:0,recording:null});
  const first=await request('begin');assert(first.ok);
  assert.equal((await request('begin')).code,'TOO_FAST');
  assert.equal((await request('evaluate',{attemptId:first.attemptId,audio},'child-b')).code,'UNAUTHORIZED');
  assert.equal((await request('evaluate',{attemptId:first.attemptId,audio:'x'.repeat(160001)})).code,'INVALID_AUDIO');
  const submit={attemptId:first.attemptId,audio,text:'untrusted override',score:100};
  const duplicates=await Promise.all([request('evaluate',submit),request('evaluate',submit)]);
  assert.equal(calls,1);assert(duplicates.some(x=>x.ok));
  const completed=await request('evaluate',submit);assert(completed.ok);assert.equal(calls,1);assert.equal(completed.recording.score,82);
  assert.equal((await request('history',{},'child-b')).best,82,'Family shares learner scores');
  assert.equal((await request('playback',{},'child-b')).audio,audio);
  assert(!JSON.stringify(await request('history')).includes('cloud://'),'Do not expose storage IDs');
  const summaryId=hash('learner','susu','dressed:1:zip');
  const oldFile=db.snapshot()['speech_summaries/'+summaryId].recording.fileID;
  const practice=async value=>{score=value;time+=4000;const a=await request('begin');return request('evaluate',{attemptId:a.attemptId,audio});};
  await practice(60);assert.equal(db.snapshot()['speech_summaries/'+summaryId].recording.fileID,oldFile);
  failUpload=true;const failed=await practice(90);assert.equal(failed.recordingStatus,'failed');assert.equal(failed.best,90);assert.equal(failed.recording.score,82);
  const bestId=db.snapshot()['speech_summaries/'+summaryId].bestAttemptId;
  failUpload=false;const retried=await request('save-recording',{attemptId:bestId,audio});assert.equal(retried.recordingStatus,'saved');assert.equal(retried.recording.score,90);assert.equal(calls,3,'Save retry must not score twice');
  const bestFile=db.snapshot()['speech_summaries/'+summaryId].recording.fileID;
  await practice(90);assert.notEqual(db.snapshot()['speech_summaries/'+summaryId].recording.fileID,bestFile,'Equal score replaces with later recording');
  assert.equal(Object.values(db.snapshot()).filter(x=>x.state==='active').length,1);
  // Provider completion order must not override actual recording order for tied scores.
  let releaseOld, startedOld;
  const providerStarted=new Promise(resolve=>{startedOld=resolve;});
  const slow=createHandler({...dependencies,evaluate:async()=>{startedOld();return new Promise(resolve=>{releaseOld=()=>resolve({...result,score:95});});}});
  time+=4000;const older=await request('begin');
  const oldResponse=slow({...base,action:'evaluate',attemptId:older.attemptId,audio},'child-a');await providerStarted;
  const newer=await practice(95);const newerFile=db.snapshot()['speech_summaries/'+summaryId].recording.fileID;
  releaseOld();assert.equal((await oldResponse).recordingStatus,'not-best');
  assert.equal(db.snapshot()['speech_summaries/'+summaryId].recording.fileID,newerFile);
  assert.equal(newer.recording.score,95);
  const stored=JSON.stringify(db.snapshot());assert(!stored.includes(audio));assert(!stored.includes('untrusted override'));assert(!stored.includes('secret'));
  await put(db,'speech_family',memberId('child-a'),{enabled:false,learnerId:'susu'});
  for(const action of ['begin','history','save-recording','playback'])assert.equal((await request(action,{attemptId:bestId,audio})).code,'FAMILY_ONLY');
  await put(db,'speech_family',memberId('child-a'),{enabled:true,learnerId:'susu'});
  time+=4000;const expired=await request('begin');time+=121000;
  assert.equal((await request('evaluate',{attemptId:expired.attemptId,audio})).code,'ATTEMPT_EXPIRED');
  const failing=createHandler({...dependencies,evaluate:async()=>{throw Object.assign(Error('silent'),{code:'NO_SPEECH'});}});
  const next=await request('begin');assert.equal((await failing({...base,action:'evaluate',attemptId:next.attemptId,audio},'child-a')).code,'NO_SPEECH');
  const badFormat=createHandler({...dependencies,parseBuffer:async()=>({format:{...format,duration:90}})});
  assert.equal((await badFormat({...base,action:'evaluate',attemptId:next.attemptId,audio},'child-a')).code,'INVALID_AUDIO');
  // Revocation during a download must prevent the audio response.
  const revokedDownload=createHandler({...dependencies,storage:{...storage,async download(id){
    await put(db,'speech_family',memberId('child-a'),{enabled:false,learnerId:'susu'});return storage.download(id);
  }}});
  assert.equal((await revokedDownload({...base,action:'playback'},'child-a')).code,'FAMILY_ONLY');
  await put(db,'speech_family',memberId('child-a'),{enabled:true,learnerId:'susu'});
  // A failed pointer transaction after upload must keep the previous formal file.
  time+=4000;const transactionAttempt=await request('begin');
  const beforePointer=db.snapshot()['speech_summaries/'+summaryId].recording.fileID;
  const originalTransaction=db.runTransaction.bind(db);let rejectPointer=false;
  db.runTransaction=fn=>{if(rejectPointer){rejectPointer=false;return Promise.reject(Error('commit failure'));}return originalTransaction(fn);};
  const brokenPointer=createHandler({...dependencies,evaluate:async()=>({...result,score:98}),storage:{...storage,async upload(path,bytes){const id=await storage.upload(path,bytes);rejectPointer=true;return id;}}});
  const pointerResponse=await brokenPointer({...base,action:'evaluate',attemptId:transactionAttempt.attemptId,audio},'child-a');
  assert.equal(pointerResponse.recordingStatus,'failed');assert.equal(pointerResponse.best,98);
  assert.equal(db.snapshot()['speech_summaries/'+summaryId].recording.fileID,beforePointer);
  // Old per-account scores are imported once into the shared learner.
  await put(db,'speech_summaries',hash('child-b','dressed:1:zip'),{best:99,attempts:2,latest:{score:99}});
  const imported=await request('history',{},'child-b');
  assert.equal(imported.best,99);assert.equal((await request('history',{},'child-b')).attempts,imported.attempts);
  // Distinct server-assigned learner IDs isolate summaries, audio and quotas.
  await put(db,'speech_family',memberId('dad-account'),{enabled:true,learnerId:'dad'});
  assert.equal((await request('access',{},'dad-account')).learnerId,'dad');
  assert.equal((await request('history',{learnerId:'susu'},'dad-account')).best,null,'Client cannot select another profile');
  assert.equal((await request('playback',{learnerId:'susu'},'dad-account')).code,'NO_RECORDING');
  time+=4000;
  const dadAttempt=await request('begin',{},'dad-account');assert(dadAttempt.ok);
  const dadResponse=await request('evaluate',{attemptId:dadAttempt.attemptId,audio},'dad-account');assert(dadResponse.ok);
  assert.equal((await request('history',{},'child-b')).best,99);
  const dadSummaryId=hash('learner','dad','dressed:1:zip');
  const dadFile=db.snapshot()['speech_summaries/'+dadSummaryId].recording.fileID;
  assert(dadFile.includes('/speech/dad/'));
  assert.notEqual(dadFile,db.snapshot()['speech_summaries/'+summaryId].recording.fileID);
  const separateLimit=createHandler({...dependencies,env:{...dependencies.env,SPEECH_DAILY_LIMIT:'1'}});
  await put(db,'speech_family',memberId('fresh-account'),{enabled:true,learnerId:'fresh'});
  assert((await separateLimit({...base,action:'begin'},'fresh-account')).ok,'Other learners do not consume this profile quota');
  await put(db,'speech_family',memberId('child-a'),{enabled:true,learnerId:'dad'});
  for(const action of ['evaluate','save-recording'])assert.equal((await request(action,{attemptId:first.attemptId,audio})).code,'UNAUTHORIZED','Switching profile must invalidate old attempts');
  assert.equal((await request('history')).best,dadResponse.best);
  await put(db,'speech_family',memberId('child-a'),{enabled:true,learnerId:'susu'});
  await put(db,'speech_family',memberId('invalid-account'),{enabled:true,learnerId:'../susu'});
  assert.equal((await request('begin',{},'invalid-account')).code,'FAMILY_ONLY');
  // Fast feedback returns a committed score without waiting for cloud storage.
  await put(db,'speech_family',memberId('fast-account'),{enabled:true,learnerId:'fast'});
  const fastAttempt=await request('begin',{},'fast-account');
  const filesBeforeScore=files.size,callsBeforeScore=calls;
  const fastResult=await request('evaluate',{attemptId:fastAttempt.attemptId,audio,deferRecording:true},'fast-account');
  assert(fastResult.ok);assert.equal(fastResult.recordingStatus,'pending');
  assert.equal(files.size,filesBeforeScore,'Score response must not upload audio');
  assert.equal((await request('history',{},'fast-account')).best,fastResult.result.score,'Score is durable before stars appear');
  assert.equal((await request('save-recording',{attemptId:fastAttempt.attemptId,audio},'fast-account')).recordingStatus,'saved');
  assert.equal(calls,callsBeforeScore+1,'Background archival must not repeat scoring');
  assert.equal((await request('evaluate',{attemptId:fastAttempt.attemptId,audio,deferRecording:true},'fast-account')).recordingStatus,'saved');
  assert.equal(calls,callsBeforeScore+1);
  const disabled=createHandler({...dependencies,env:{...env,SPEECH_ENABLED:'false'}});
  assert.equal((await disabled({...base,action:'begin'},'child-a')).code,'DISABLED');
  const noStorage=createHandler({...dependencies,env});assert.equal((await noStorage({...base,action:'begin'},'child-a')).code,'STORAGE_NOT_CONFIGURED');
  const limited=createHandler({...dependencies,env:{...dependencies.env,SPEECH_DAILY_LIMIT:'1'}});
  assert.equal((await limited({...base,action:'begin'},'child-a')).code,'DAILY_LIMIT');
  assert.equal(dayAt(Date.UTC(2026, 9, 19, 16)), '2026-10-20');
  assert.throws(() => normalize({ ...summary, PronAccuracy: -1 }, 'word'));
  assert.throws(() => normalize({ ...summary, PronCompletion: -1 }, 'sentence'));
  assert.equal(normalize({ PronAccuracy: 0 }, 'word').score, 0);
  const url = new URL(signedUrl(target, { appId: '123', secretId: 'id', secretKey: 'key' }, 'voice', time));
  assert.equal(url.searchParams.get('ref_text'), 'zip up'); assert.equal(url.searchParams.get('rec_mode'), '1'); assert.equal(url.searchParams.get('score_coeff'), '1');
  const params = [...url.searchParams.entries()].filter(([key]) => key !== 'signature').sort(([a], [b]) => a.localeCompare(b));
  const signature = require('crypto').createHmac('sha1', 'key').update(url.host + url.pathname + '?' + params.map(([k,v]) => `${k}=${v}`).join('&')).digest('base64');
  assert.equal(url.searchParams.get('signature'), signature);
  class Socket extends EventEmitter {
    constructor() { super(); Socket.latest = this; this.sent = []; this.closed = false; }
    send(data, callback) { this.sent.push(data); if (callback) callback(); }
    terminate() { this.closed = true; }
    message(value) { this.emit('message', Buffer.from(JSON.stringify(value))); }
  }
  const credentials = { appId: '123', secretId: 'id', secretKey: 'key' };
  const pending = evaluate(Buffer.from('test'), target, credentials, { WebSocket: Socket });
  const socket = Socket.latest; socket.message({ code: 0 }); assert.equal(socket.sent.length, 2);
  socket.message({ code: 0, result: { ...summary, SentenceId: 0, SuggestedScore: 99 } });
  socket.message({ code: 0, result: summary }); socket.message({ code: 0, final: 1 });
  assert.deepEqual(await pending, result); assert(socket.closed);
  const incomplete = evaluate(Buffer.from('test'), target, credentials, { WebSocket: Socket });
  Socket.latest.message({ code: 0, result: { ...summary, SentenceId: 0 } }); Socket.latest.message({ code: 0, final: 1 });
  await assert.rejects(incomplete, { code: 'INVALID_RESULT' });
  const silent = evaluate(Buffer.from('test'), target, credentials, { WebSocket: Socket });
  Socket.latest.message({ code: 4105 }); await assert.rejects(silent, { code: 'NO_SPEECH' });
  const timeout = evaluate(Buffer.from('test'), target, credentials, { WebSocket: Socket, timeoutMs: 5 });
  await assert.rejects(timeout, { code: 'TIMEOUT' }); assert(Socket.latest.closed);
  console.log('Passed: SOE protocol, family access/revocation, profile isolation and quotas, shared history, private playback, storage failure/retry, concurrent tied scores, migration, quotas and idempotency.');
})().catch(error => { console.error(error); process.exitCode = 1; });
