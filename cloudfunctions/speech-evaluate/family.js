const crypto = require('crypto');
const { hash, get, put, validLearnerId } = require('./data');
const { fault } = require('./soe');
const memberId = openid => hash('family', openid);
function approved(member) { return !!(member && member.enabled === true && validLearnerId(member.learnerId)); }
async function requireFamily(db, openid, expectedLearnerId) {
  const member = openid && await get(db, 'speech_family', memberId(openid));
  if (!approved(member) || expectedLearnerId && member.learnerId !== expectedLearnerId) throw fault('FAMILY_ONLY');
  return member;
}
async function access(db, openid, request, now) {
  const id = memberId(openid);
  let member = await get(db, 'speech_family', id);
  if (request && !member) {
    const requestCode = crypto.randomBytes(8).toString('hex').toUpperCase();
    await db.runTransaction(async transaction => {
      if (!await get(transaction, 'speech_family', id)) await put(transaction, 'speech_family', id, {
        enabled: false, learnerId: '', requestCode, createdAt: now
      });
    });
    member = await get(db, 'speech_family', id);
  }
  return { ok: true, allowed: approved(member), ...(approved(member) ? { learnerId: member.learnerId } : {}), requestCode: member ? member.requestCode || '' : '' };
}
module.exports = { memberId, approved, requireFamily, access };
