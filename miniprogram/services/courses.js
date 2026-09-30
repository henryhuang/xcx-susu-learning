// Bundled courses are the fallback; a fully validated downloaded package takes priority.
const protocol=require('./course-data');
const data=require('../data/local-courses');
const packages=require('./course-package');
const assets=require('./course-assets');
let active=data,source='local',restored=false;
function activate(result){active=result.data;source='downloaded';assets.setDirectory(result.directory);}
function ensure(){if(!restored){restored=true;const cached=packages.restore();if(cached)activate(cached);}}
function reloadCached(){ensure();const cached=packages.restore();if(cached)activate(cached);else{active=data;source='local';assets.setDirectory('');}}
async function sync(activateNow=()=>true){ensure();const result=await packages.sync();if(result.data&&activateNow())activate(result);return result.state;}
function catalog(){ensure();return {manifest:protocol.validateManifest(active.manifest),source};}
function lesson(id){ensure();const l=active.lessons[id];if(!l)throw new Error('课程不存在');protocol.validateLesson(l);const copy=JSON.parse(JSON.stringify(l));function images(v){if(!v||typeof v!=='object')return;for(const k of Object.keys(v)){if((k==='image'||k==='cover')&&typeof v[k]==='string')v[k]=assets.resolve(v[k]);else images(v[k]);}}images(copy);return copy;}
function week(id){ensure();const w=protocol.validateWeek(active.weeks[id||active.manifest.latestWeekId]);
  w.items.forEach(item=>{const l=lesson(item.lesson.id);if(l.version!==item.lesson.version||l.category!==item.category)throw new Error('周安排与课程不匹配');});return w;
}
async function open(id){return {lesson:lesson(id||week().items[0].lesson.id),source};}
function route(id,weekId){const l=lesson(id),base=l.category==='english'?'/pages/lesson/index':'/chinese/pages/lesson/index';return base+'?id='+encodeURIComponent(id)+(weekId?'&weekId='+encodeURIComponent(weekId):'');}
module.exports={catalog,week,lesson,open,route,sync,reloadCached};
