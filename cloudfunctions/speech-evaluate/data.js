const crypto = require('crypto');
const hash = (...parts) => crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');
const ref = (store, collection, id) => store.collection(collection).doc(id);
async function get(store, collection, id) { return (await ref(store, collection, id).get()).data || null; }
function put(store, collection, id, data) {
  // CloudBase returns _id on reads but rejects it in set/update data.
  const { _id, ...fields } = data;
  return ref(store, collection, id).set({ data: fields });
}
const validLearnerId = value => typeof value === 'string' && /^[a-z][a-z0-9_-]{0,31}$/.test(value);
module.exports = { hash, ref, get, put, validLearnerId };
