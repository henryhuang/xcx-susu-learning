const legacy=require('./progress');
function key(l){return `susu-course-run:${l.id}:${l.version}`;}
function empty(){return {cursor:-1,lineIndex:0,awarded:[],completed:false,bestStars:0};}
function read(l){
  try{const r=wx.getStorageSync(key(l));if(!r||typeof r!=='object')return migrate(l);
    const valid=new Set(l.activities.map(a=>a.id));
    const ids=r.completedActivityIds||r.awarded;const matched=l.activities.findIndex(a=>a.id===r.currentActivityId);const cursor=matched>=0?matched:r.cursor;
    return {lineIndex:Number.isInteger(r.lineIndex)&&r.lineIndex>=0?r.lineIndex:0,cursor:Number.isInteger(cursor)&&cursor>=-1&&cursor<=l.activities.length?cursor:-1,awarded:Array.isArray(ids)?[...new Set(ids.filter(id=>valid.has(id)))]:[],completed:!!r.completed,bestStars:Number.isInteger(r.bestStars)?Math.max(0,Math.min(total(l),r.bestStars)):0};
  }catch(_){return empty();}
}
function migrate(l){
  if(l.version!==1||!['shapes','body'].includes(l.id))return empty();
  const old=legacy.read(l.id),r=old.run;if(!r)return {...empty(),bestStars:old.bestStars,completed:old.completed};
  const indexes=l.activities.map((a,i)=>({a,i})).filter(x=>x.a.step===r.stage);
  const selected=indexes[Math.min(r.index,indexes.length-1)];
  const cursor=r.stage==='finish'?l.activities.length:r.stage==='welcome'?-1:selected?selected.i:-1;
  const awarded=[];
  for(const reward of r.awarded){
    if(reward==='actions'){const a=l.activities.find(a=>a.step==='actions'&&a.reward);if(a)awarded.push(a.id);continue;}
    const [prefix,index]=reward.split('-'),step=prefix==='shape'?'quiz':prefix==='count'?'counting':'phonics';
    const a=l.activities.filter(a=>a.step===step)[Number(index)];if(a)awarded.push(a.id);
  }
  const record={cursor,awarded,completed:old.completed,bestStars:old.bestStars};return save(l,record);
}
function stars(l,awarded){return l.activities.reduce((n,a)=>n+(awarded.includes(a.id)?a.reward||0:0),0);}
function total(l){return l.activities.reduce((n,a)=>n+(a.reward||0),0);}
function save(l,r){try{wx.setStorageSync(key(l),{...r,lessonId:l.id,lessonVersion:l.version,currentActivityId:l.activities[r.cursor]?l.activities[r.cursor].id:null,completedActivityIds:r.awarded,updatedAt:new Date().toISOString()});}catch(_){}return r;}
module.exports={read,save,stars,total};
