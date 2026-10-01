// Exercise bundled fallback independently of the deployment URL.
require('../config/courses').latestUrl='';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),clone=x=>JSON.parse(JSON.stringify(x));
// Keep regression coverage for all existing courses, including weeks with only one category.
const fixture={manifest:{schemaVersion:2,revision:8,latestWeekId:'2026-09-30',weeks:[]},weeks:{},lessons:{}};
for(const id of ['2026-09-30','2026-09-24','2026-09-18','2026-09-11']){
 const w=JSON.parse(fs.readFileSync(path.join(root,'courses/weeks/'+id+'.json')));
 fixture.manifest.weeks.push({id,reportDate:w.reportDate,title:w.title,url:'weeks/'+id+'.json'});fixture.weeks[id]=w;
 for(const item of w.items)fixture.lessons[item.lesson.id]=JSON.parse(fs.readFileSync(path.join(root,'courses',item.lesson.url)));
}
require('../data/local-courses');require.cache[require.resolve('../data/local-courses')].exports=fixture;

let stores={},active=0,contexts=[],dialogs=[],routes=[],redirects=[];
global.wx={getStorageSync:k=>stores[k],setStorageSync:(k,v)=>stores[k]=clone(v),showShareMenu(){},showActionSheet:o=>dialogs.push(o),navigateTo:o=>routes.push(o.url),redirectTo:o=>redirects.push(o.url),reLaunch:o=>routes.push(o.url),request(){throw new Error('Local courses must never request remote data');},
 createInnerAudioContext(){active++;let destroyed=false;const cb={};const c={onPlay:f=>cb.play=f,onEnded:f=>cb.end=f,onError:f=>cb.error=f,play(){if(cb.play)cb.play();},stop(){},destroy(){if(!destroyed){active--;destroyed=true;}},end(){cb.end();},fail(){cb.error();}};contexts.push(c);return c;}};
function definition(file){let d;global.Page=x=>d=x;delete require.cache[require.resolve(file)];require(file);return d;}
async function page(id,weekId='',file){const c=require('../services/courses');const l=c.lesson(id);const d=definition(file||(l.category==='english'?'../pages/lesson/index.js':'../chinese/pages/lesson/index.js'));const p={...d,data:clone(d.data),setData(v){Object.assign(this.data,v);}};p.onLoad({id,weekId});p.onShow();await p.ready;assert(!p.data.error,p.data.error);return p;}
const answer=(p,v)=>p.choose({currentTarget:{dataset:{answer:v}}});
(async()=>{
 const courses=require('../services/courses'),protocol=require('../services/course-data'),cp=require('../services/course-progress'),audio=require('../services/audio');
 const app=JSON.parse(fs.readFileSync(path.join(root,'app.json')));const pages=app.pages.concat(app.subPackages.flatMap(s=>s.pages.map(p=>s.root+'/'+p)));
 pages.forEach(p=>['js','wxml','wxss','json'].forEach(e=>assert(fs.existsSync(path.join(root,p+'.'+e)))));
 const map=require('../data/audio-map');Object.values(map).forEach(s=>assert(fs.existsSync(path.join(root,s.slice(1)))));
 audio.play('star');audio.play('diamond');assert.equal(active,1);audio.stop();assert.equal(active,0);assert.equal(audio.play('javascript:alert(1)'),false);
 const catalog=courses.catalog();assert.equal(catalog.manifest.schemaVersion,2);assert.equal(catalog.manifest.weeks.length,4);assert.equal(catalog.manifest.latestWeekId,'2026-09-30');
 const thisWeek=courses.week('2026-09-30');assert.equal(thisWeek.items.length,1);assert.equal(thisWeek.items[0].category,'english');
 const ants=courses.lesson('english-ants-and-pants');assert.equal(ants.version,2);assert.deepEqual(ants.activities.filter(a=>a.step==='words').map(a=>a.text),['dolphin','dress','kangaroo','socks','shoes','ant','pants']);assert.deepEqual(ants.activities.filter(a=>a.step==='patterns').map(a=>a.text),['I like pink.',"I don't like red."]);assert.deepEqual(ants.activities.filter(a=>a.step==='speaking').map(a=>a.text),['I like ants...in yellow pants.',"I don't like yellow. I like green.",'An ant in green pants?','Did you do this? Good job!']);
 const parents=courses.lesson('dizigui-parents'),daily=courses.lesson('dizigui-daily-and-small'),small=courses.lesson('dizigui-small-things');
 assert([parents,daily,small].every(l=>l.version===2));assert.equal(daily.content.lines[2].explanation,small.content.lines[0].explanation);
 assert(daily.content.lines[0].explanation.includes('父母'));assert(daily.content.lines[1].explanation.includes('回来当面报平安'));assert(small.content.lines[1].explanation.includes('私自拿走藏起来'));
 const ids=new Set(catalog.manifest.weeks.flatMap(e=>courses.week(e.id).items.map(i=>i.lesson.id)));assert.equal(ids.size,10);
 for(const id of ids){
  let p=await page(id,'2026-09-24');assert.equal(p.data.phase,'welcome');assert.equal(p.data.theme,p.lesson.category==='english'?'poppy':'hanfu');assert(p.data.playingKey.startsWith('/'));
  p.start();let count=0;
  while(p.data.phase==='activity'){
   assert(++count<100);const a=p.data.activity;
   if(a.type==='choice'){
    const before=p.data.stars,cursor=p.data.cursor;p.next();assert.equal(p.data.cursor,cursor);answer(p,'wrong');assert.equal(p.data.stars,before);assert.equal(p.data.feedback,p.data.ui.retry);assert.equal(contexts.at(-1).src,map['try-again']);
    answer(p,a.answer);answer(p,a.answer);assert.equal(p.data.stars,before+(a.reward||0));p.onUnload();assert.equal(active,0);p=await page(id);assert(p.data.solved);assert.equal(p.data.cursor,cursor);answer(p,a.answer);assert.equal(p.data.stars,before+(a.reward||0));
   }
   if(a.type==='read-along'){
    p.playLines();const first=contexts.at(-1);assert.equal(p.data.activeLineId,p.data.lines[0].id);first.end();assert.equal(p.data.activeLineId,p.data.lines[1].id);assert.equal(active,1);
    const stale=contexts.at(-1);p.onHide();const n=contexts.length;stale.end();assert.equal(contexts.length,n,'hidden page started next audio');assert.equal(active,0);p.onShow();
    p.playLine({currentTarget:{dataset:{id:p.data.lines[0].id}}});assert.equal(contexts.at(-1).src,p.data.lines[0].audio);
   }
   if(a.type==='sound-examples'){p.revealExample({currentTarget:{dataset:{group:0}}});assert.equal(p.data.exampleWord,'look');p.revealExample({currentTarget:{dataset:{group:0}}});assert.equal(p.data.exampleWord,'cook');}
   if(a.type==='line-practice'&&p.data.lineIndex===0){
    const cursor=p.data.cursor;p.next();assert.equal(p.data.lineIndex,1);assert.equal(p.data.cursor,cursor);p.onUnload();p=await page(id);assert.equal(p.data.lineIndex,1);p.previousLine();assert.equal(p.data.lineIndex,0);p.next();
   }
   p.next();
  }
  assert.equal(p.data.phase,'finish');assert.equal(p.data.stars,p.data.totalStars);if(['shapes','body'].includes(id))assert.equal(p.data.stars,10);assert(p.record.completed);
  const persisted=stores[`susu-course-run:${id}:${p.lesson.version}`];assert.equal(persisted.lessonId,id);assert.equal(persisted.lessonVersion,p.lesson.version);assert(persisted.completedActivityIds.length>0);
  p.replay();assert.equal(p.data.stars,0);assert.equal(p.data.phase,'welcome');assert.equal(p.record.bestStars,p.data.totalStars);
  p.start();p.next();const before=clone(p.record);p.restart();p.restart();assert.equal(dialogs.length,1);dialogs.pop().complete();assert.deepEqual(p.record,before);
  p.restart();const dialog=dialogs.pop();p.onHide();dialog.success({tapIndex:1});dialog.complete();assert.deepEqual(p.record,before);p.onUnload();assert.equal(active,0);
  assert(p.onShareAppMessage().path.includes('id='+id));assert(p.onShareAppMessage().path.startsWith(p.lesson.category==='english'?'/pages/lesson/index':'/chinese/pages/lesson/index'));
 }
 // Chinese content must route through its subpackage, including old generic URLs.
 await page('poem-cunju','','../pages/lesson/index.js');assert(redirects.at(-1).startsWith('/chinese/pages/lesson/index?id=poem-cunju'));
 stores={};const l=courses.lesson('shapes');stores['susu-mini-shapes-v1']={bestStars:3,completed:false,run:{stage:'quiz',index:1,stars:2,awarded:['shape-0','shape-1']}};const migrated=cp.read(l);assert.equal(migrated.cursor,6);assert.equal(cp.stars(l,migrated.awarded),2);
 assert.equal(cp.read({...l,version:2}).cursor,-1);
 const badMutations=[l=>l.activities[0].type='script',l=>l.activities[0].js='alert(1)',l=>l.activities[0].image='https://example.com/image.png',l=>l.activities[1].id=l.activities[0].id,l=>l.intro.audio='/assets/../secret.mp3'];
 for(const mutate of badMutations){const bad=clone(l);mutate(bad);assert.throws(()=>protocol.validateLesson(bad));}
 const badLine=clone(courses.lesson('poem-cunju'));badLine.activities[0].lineIds=['missing'];assert.throws(()=>protocol.validateLesson(badLine));
 const badAnswer=clone(l);badAnswer.activities.find(a=>a.type==='choice').answer='missing';assert.throws(()=>protocol.validateLesson(badAnswer));
 let home=definition('../pages/home/index.js');home={...home,data:clone(home.data),setData(v){Object.assign(this.data,v);}};home.onLoad();home.onShow();assert.equal(home.data.lessons.length,1);assert.equal(home.data.week.id,'2026-09-30');assert.equal(home.data.lessons[0].id,'english-ants-and-pants');
 home.selectWeek({currentTarget:{dataset:{id:'2026-09-24'}}});assert.equal(home.data.lessons.length,3);
 assert.equal(home.data.lessons.find(l=>l.id==='body').completed,false);home.onHide();cp.save(courses.lesson('body'),{cursor:courses.lesson('body').activities.length,awarded:[],completed:true,bestStars:10});home.onShow();assert.equal(home.data.lessons.find(l=>l.id==='body').completed,true);assert.equal(home.data.lessons.find(l=>l.id==='body').status,'再练一次 →');assert.equal(home.data.lessons.find(l=>l.id==='poem-cunju').completed,false);
 home.selectWeek({currentTarget:{dataset:{id:'2026-09-11'}}});assert.equal(home.data.lessons[0].id,'english-evening');home.goLesson({currentTarget:{dataset:{id:'poem-tixilinbi'}}});assert(routes.at(-1).includes('/chinese/pages/lesson/index?id=poem-tixilinbi&weekId=2026-09-11'));
 home.hello();assert.equal(contexts.at(-1).src,'/assets/audio/home-hello.mp3');home.onUnload();assert.equal(active,0);home.onShow();assert.equal(home.data.week.id,'2026-09-11');home.onUnload();
 // Step rewind removes only current/later work and retains previous rewards.
 let p=await page('dizigui-small-things');p.start();p.next();p.next();answer(p,p.data.activity.answer);p.next();p.next();p.next();assert.equal(p.data.phase,'finish');assert.equal(p.data.stars,2);p.reset('step');assert.equal(p.data.activity.type,'line-practice');assert.equal(p.data.stars,1);p.onUnload();
 console.log('Passed: 4 weeks / 10 local lessons, English and Chinese flows, sequential audio cancellation, line resume, progress migration, rewards, restart, languages, subpackage routing, sharing and strict schema validation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
