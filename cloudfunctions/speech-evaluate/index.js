const cloud = require('wx-server-sdk');
const parseBuffer = async (...args) => (await import('music-metadata')).parseBuffer(...args);
const { evaluate } = require('./soe');
const { createHandler } = require('./service');
const { createStorage } = require('./storage');
const catalog = require('./catalog.json');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
exports.main = async event => {
  // 不记录 event、音频、供应商响应或含签名的 URL。
  const handler = createHandler({ db, storage: createStorage(cloud, db, process.env), catalog, evaluate, parseBuffer, env: process.env });
  const context = cloud.getWXContext();
  if (context.APPID !== 'wx6c6344be213a1384' || !context.OPENID || event && (event.httpMethod || event.Type === 'Timer')) return { ok: false, code: 'UNAUTHORIZED' };
  return handler(event, context.OPENID);
};
