const { get, put } = require('./data');
const { fault } = require('./soe');
// Record file IDs before uploading so a killed invocation cannot orphan a voice file.
function createStorage(cloud, db, env) {
  async function prefix() {
    if (env.SPEECH_STORAGE_PRIVATE !== 'true') throw fault('STORAGE_NOT_CONFIGURED');
    const saved = await get(db, 'speech_recordings', 'storage-config');
    if (saved && /^cloud:\/\//.test(saved.prefix)) return saved.prefix;
    const path = 'speech-internal/storage-probe.txt';
    const result = await cloud.uploadFile({ cloudPath: path, fileContent: Buffer.from('susu') });
    if (!result.fileID || !result.fileID.startsWith('cloud://') || !result.fileID.endsWith('/' + path)) throw fault('STORAGE_ERROR');
    const value = result.fileID.slice(0, -path.length);
    await put(db, 'speech_recordings', 'storage-config', { prefix: value });
    // The fixed probe contains no personal information and may safely be overwritten.
    try { await cloud.deleteFile({ fileList: [result.fileID] }); } catch (_) {}
    return value;
  }
  return {
    async fileId(path) { return await prefix() + path; },
    async upload(path, audio) {
      if (env.SPEECH_STORAGE_PRIVATE !== 'true') throw fault('STORAGE_NOT_CONFIGURED');
      const result = await cloud.uploadFile({ cloudPath: path, fileContent: audio });
      if (!result.fileID) throw fault('STORAGE_ERROR');
      return result.fileID;
    },
    async download(fileID) {
      const result = await cloud.downloadFile({ fileID });
      return result.fileContent;
    }
  };
}
module.exports = { createStorage };
