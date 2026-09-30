const KEYS = {shapes:'susu-mini-shapes-v1',body:'susu-mini-body-v1'};
const STAGES = {
  shapes:{welcome:1,words:5,quiz:5,sounds:1,phonics:8,finish:1},
  body:{welcome:1,words:5,actions:4,counting:5,phonics:4,finish:1}
};
const DEFAULT = {bestStars:0,completed:false,run:null};
function normalizeRun(course,run) {
  if (!run || typeof run !== 'object') return null;
  const limit = STAGES[course] && STAGES[course][run.stage];
  if (!limit) return null;
  const index = Number.isInteger(run.index) && run.index >= 0 && run.index < limit ? run.index : 0;
  const stars = Number.isInteger(run.stars) ? Math.max(0,Math.min(10,run.stars)) : 0;
  const awarded = Array.isArray(run.awarded) ? run.awarded.filter(key => typeof key === 'string' && /^(shape|sound|count)-\d+$|^actions$/.test(key)) : [];
  return {stage:run.stage,index,stars,awarded:[...new Set(awarded)],
    exampleSound:run.exampleSound === 'g' ? 'g' : 'k',
    exampleCount:Number.isInteger(run.exampleCount) ? Math.max(0,run.exampleCount % 4) : 0,
    exampleWord:typeof run.exampleWord === 'string' ? run.exampleWord : ''};
}
function read(course) {
  try {
    const saved = wx.getStorageSync(KEYS[course]);
    if (!saved || typeof saved !== 'object') return {...DEFAULT};
    return {
      bestStars:Number.isInteger(saved.bestStars) ? Math.max(0,Math.min(10,saved.bestStars)) : 0,
      completed:!!saved.completed,
      run:normalizeRun(course,saved.run)
    };
  } catch (_) { return {...DEFAULT}; }
}
function saveRun(course,run) {
  const old = read(course);
  const value = {...old,run:normalizeRun(course,run)};
  try { wx.setStorageSync(KEYS[course],value); } catch (_) {}
  return value;
}
function complete(course,stars) {
  const old = read(course);
  const value = {...old,bestStars:Math.max(old.bestStars || 0,stars),completed:true};
  try { wx.setStorageSync(KEYS[course],value); } catch (_) {}
  return value;
}
function restart(course,run) {
  const value={...read(course),completed:false,run:normalizeRun(course,run)};
  try { wx.setStorageSync(KEYS[course],value); } catch (_) {}
  return value;
}
module.exports = {read,saveRun,complete,restart};
