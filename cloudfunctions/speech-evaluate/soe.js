const crypto = require('crypto');

function fault(code) { return Object.assign(new Error(code), { code }); }
function signedUrl(target, credentials, voiceId, now = Date.now()) {
  const params = {
    eval_mode: target.mode === 'word' ? 0 : 1,
    expired: Math.floor(now / 1000) + 60,
    nonce: crypto.randomInt(1, 1000000000),
    rec_mode: 1,
    ref_text: target.text,
    score_coeff: 1.0,
    secretid: credentials.secretId,
    sentence_info_enabled: 1,
    server_engine_type: '16k_en',
    text_mode: 0,
    timestamp: Math.floor(now / 1000),
    voice_format: 2,
    voice_id: voiceId
  };
  const keys = Object.keys(params).sort();
  const hostPath = `soe.cloud.tencent.com/soe/api/${credentials.appId}`;
  const plain = hostPath + '?' + keys.map(k => `${k}=${params[k]}`).join('&');
  const signature = crypto.createHmac('sha1', credentials.secretKey).update(plain).digest('base64');
  return 'wss://' + hostPath + '?' + keys.map(k => `${k}=${encodeURIComponent(params[k])}`).join('&') + '&signature=' + encodeURIComponent(signature);
}
function percentage(value, scale = 1) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100 / scale) return null;
  return Math.round(value * scale);
}
function normalize(result, mode) {
  if (!result || typeof result !== 'object') throw fault('INVALID_RESULT');
  const accuracy = percentage(result.PronAccuracy);
  const score = mode === 'word' ? accuracy : percentage(result.SuggestedScore);
  // -1 表示没有有效评测结果，不能展示成孩子得了 0 分。
  if (score === null || accuracy === null) throw fault('NO_SPEECH');
  const normalized = { score, accuracy };
  if (mode === 'sentence') {
    normalized.fluency = percentage(result.PronFluency, 100);
    normalized.completion = percentage(result.PronCompletion, 100);
    if (normalized.fluency === null || normalized.completion === null) throw fault('INVALID_RESULT');
  }
  return normalized;
}
function providerError(code) {
  if ([4105, 4108].includes(code)) return fault('NO_SPEECH');
  if ([4007, 4107].includes(code)) return fault('INVALID_AUDIO');
  if (code === 4002) return fault('PROVIDER_AUTH');
  if (code === 4003) return fault('SERVICE_NOT_ENABLED');
  if (code === 4004) return fault('RESOURCE_EXHAUSTED');
  if (code === 4005) return fault('ACCOUNT_OVERDUE');
  if (code === 4006) return fault('PROVIDER_BUSY');
  return fault('EVALUATION_FAILED');
}
// 仅在收到最终标识后采用最终/汇总结果；绝不把中间断句当整句成绩。
function evaluate(audio, target, credentials, { WebSocket = require('ws'), timeoutMs = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    let socket, timer, settled = false, sent = false, overall;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (socket) socket.terminate();
      if (error) reject(error); else resolve(result);
    };
    try {
      socket = new WebSocket(signedUrl(target, credentials, crypto.randomUUID()), { handshakeTimeout: 5000, maxPayload: 1024 * 1024 });
      timer = setTimeout(() => finish(fault('TIMEOUT')), timeoutMs);
      socket.on('error', () => finish(fault('EVALUATION_FAILED')));
      socket.on('close', () => finish(fault('EVALUATION_FAILED')));
      socket.on('message', bytes => {
        if (settled) return;
        try {
          const message = JSON.parse(bytes.toString());
          if (message.code !== 0) return finish(providerError(message.code));
          if (!sent) {
            sent = true;
            // rec_mode=1：一次二进制消息，随后发送结束标记。
            socket.send(audio, error => { if (error) finish(fault('EVALUATION_FAILED')); });
            socket.send(JSON.stringify({ type: 'end' }), error => { if (error) finish(fault('EVALUATION_FAILED')); });
          }
          let result = message.result;
          if (typeof result === 'string') result = JSON.parse(result);
          if (result && (result.SentenceId === -1 || message.final === 1)) overall = result;
          if (message.final === 1) finish(null, normalize(overall, target.mode));
        } catch (error) { finish(error.code ? error : fault('INVALID_RESULT')); }
      });
    } catch (_) { finish(fault('EVALUATION_FAILED')); }
  });
}
module.exports = { evaluate, normalize, signedUrl, providerError, fault };
