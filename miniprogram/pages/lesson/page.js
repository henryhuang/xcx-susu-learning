const courses=require('../../services/courses');
const progress=require('../../services/course-progress');
const audio=require('../../services/audio');
const share=require('../../services/share');
const UI={
 'zh-CN':{hello:'听酥酥打招呼',listen:'听发音',listenAll:'听整篇',listenLine:'再听这一句',answer:'再听答案',next:'下一步 →',finish:'我学过了 →',retry:'再想一想，试一次～',again:'再练一次',complete:'今天又进步了一点点！',step:'回到当前步骤开始',lesson:'回到整门课程开始',cancel:'先想一想',restart:'重新开始',audioError:'声音暂时没响，先一起读一读吧。'},
 'en-US':{hello:'Listen to Susie',listen:'Listen',listenAll:'Listen all',listenLine:'Listen again',answer:'Listen to the answer',next:'Next →',finish:'Finish →',retry:'Listen again. Try once more!',again:'Play again',complete:'ADVENTURE COMPLETE!',step:'Restart this step',lesson:'Restart this lesson',cancel:'Think again',restart:'Restart',audioError:'The sound is not ready. Let’s read together.'}
};
module.exports=function(defaultId){return {
 data:{loading:true,error:'',lesson:{},ui:UI['zh-CN'],theme:'poppy',categoryLabel:'',phase:'welcome',activity:{},cursor:-1,stars:0,totalStars:0,progress:0,solved:false,feedback:'',feedbackKind:'good',playingKey:'',audioError:'',exampleWord:'',exampleAudio:'',stepIndex:0,stepCount:0,lines:[],lineIndex:0,currentLine:{},activeLineId:''},
 onLoad(options={}){this.courseId=defaultId||options.id||'';this.weekId=options.weekId||'';this.alive=true;this.ready=this.load();},
 async load(){
  const generation=(this.generation||0)+1;this.generation=generation;this.setData({loading:true,error:''});
  try{const result=await courses.open(this.courseId);if(!this.alive||generation!==this.generation)return;
   this.lesson=result.lesson;this.courseId=this.lesson.id;
   // 中文媒体位于中文分包，旧的通用链接也统一进入分包页。
   if(this.lesson.category!=='english'&&!this.inChinesePackage){this.alive=false;wx.redirectTo({url:courses.route(this.courseId,this.weekId)});return;}
   this.record=progress.read(this.lesson);this.setData({lesson:this.lesson,ui:UI[this.lesson.language.guidance],theme:this.lesson.presentation.theme,categoryLabel:{english:'ENGLISH ADVENTURE',poetry:'古诗小天地',dizigui:'弟子规小故事'}[this.lesson.category],totalStars:progress.total(this.lesson),loading:false});this.render();if(this.visible)this.playCurrent();
  }catch(_){if(this.alive&&generation===this.generation)this.setData({loading:false,error:'本地课程暂时没准备好，请回首页选择课程。'});}
 },
 retry(){this.ready=this.load();},
 onShow(){this.visible=true;share.showMenu();this.unsub=audio.subscribe(s=>this.setData({playingKey:s.playing?s.key:'',audioError:s.error?this.data.ui.audioError:''}));if(this.lesson&&!this.data.loading)this.playCurrent();},
 onHide(){this.visible=false;this.stopAudio();if(this.unsub)this.unsub();},onUnload(){this.alive=false;this.onHide();},
 onShareAppMessage(){return {title:'酥酥的学习小屋 · '+(this.lesson?this.lesson.title:'学习小冒险'),path:this.lesson?courses.route(this.courseId,this.weekId):'/pages/home/index',imageUrl:'/assets/images/share-cover.png'};},
 onShareTimeline(){return {title:this.lesson?this.lesson.title:'酥酥的学习小屋',query:'id='+encodeURIComponent(this.courseId)+(this.weekId?'&weekId='+encodeURIComponent(this.weekId):''),imageUrl:'/assets/images/logo.png'};},
 stopAudio(){this.sequence=(this.sequence||0)+1;audio.stop();},
 render(){
  const l=this.lesson,r=this.record,a=l.activities[r.cursor]||{},phase=r.cursor<0?'welcome':r.cursor>=l.activities.length?'finish':'activity';
  const stepItems=l.activities.filter(x=>x.step===a.step),stepIndex=stepItems.findIndex(x=>x.id===a.id),solved=a.type==='choice'&&r.awarded.includes(a.id);
  const lines=(a.lineIds||[]).map(id=>l.content.lines.find(line=>line.id===id));const lineIndex=Math.min(r.lineIndex||0,Math.max(0,lines.length-1));
  this.exampleCounts={};this.setData({phase,cursor:r.cursor,activity:a,stars:progress.stars(l,r.awarded),progress:Math.round(Math.max(0,r.cursor)/l.activities.length*100),solved,feedback:solved?a.answerText:'',feedbackKind:'good',audioError:'',exampleWord:'',exampleAudio:'',stepIndex:stepIndex+1,stepCount:stepItems.length,lines,lineIndex,currentLine:lines[lineIndex]||{},activeLineId:''});
 },
 persist(){progress.save(this.lesson,this.record);},
 move(cursor){this.stopAudio();this.record.cursor=cursor;this.record.lineIndex=0;this.persist();this.render();if(this.visible)this.playCurrent();},
 start(){if(this.lesson&&!this.data.loading)this.move(0);},
 next(){
  if(!this.lesson||this.data.phase!=='activity')return;const a=this.data.activity;if(a.type==='choice'&&!this.data.solved)return;
  if(a.type==='line-practice'&&this.data.lineIndex<this.data.lines.length-1){this.stopAudio();this.record.lineIndex=this.data.lineIndex+1;this.persist();this.render();if(this.visible)this.playCurrent();return;}
  if(a.type!=='choice'&&!this.record.awarded.includes(a.id))this.record.awarded.push(a.id);
  const cursor=this.record.cursor+1;if(cursor===this.lesson.activities.length){this.record.completed=true;this.record.bestStars=Math.max(this.record.bestStars,progress.stars(this.lesson,this.record.awarded));}this.move(cursor);
 },
 previousLine(){if(!this.data.lineIndex)return;this.stopAudio();this.record.lineIndex=this.data.lineIndex-1;this.persist();this.render();if(this.visible)this.playCurrent();},
 back(){if(!this.lesson||this.record.cursor<0)return this.home();if(this.data.activity.type==='line-practice'&&this.data.lineIndex>0)return this.previousLine();this.move(this.record.cursor-1);},
 choose(e){const a=this.data.activity;if(a.type!=='choice'||this.data.solved)return;this.stopAudio();
  if(String(e.currentTarget.dataset.answer)!==a.answer){this.setData({feedback:a.retryText||this.data.ui.retry,feedbackKind:'try'});audio.play('try-again');return;}
  this.record.awarded.push(a.id);this.persist();this.setData({solved:true,feedback:a.answerText,feedbackKind:'good',stars:progress.stars(this.lesson,this.record.awarded)});if(a.answerAudio)audio.play(a.answerAudio);
 },
 revealExample(e){this.stopAudio();const index=Number(e.currentTarget.dataset.group),g=this.data.activity.groups&&this.data.activity.groups[index];if(!g)return;const count=this.exampleCounts[index]||0,w=g.words[count%g.words.length];this.exampleCounts[index]=count+1;this.setData({exampleWord:w.text,exampleAudio:w.audio||''});if(w.audio)audio.play(w.audio);},
 playLine(e){const line=this.data.lines.find(x=>x.id===e.currentTarget.dataset.id);if(!line||!line.audio)return;this.stopAudio();this.setData({activeLineId:line.id});audio.play(line.audio);},
 playLines(){
  this.stopAudio();const sequence=this.sequence,lines=this.data.lines;let index=0;
  const next=()=>{if(!this.visible||this.sequence!==sequence||index>=lines.length)return;const line=lines[index++];this.setData({activeLineId:line.id});if(line.audio)audio.play(line.audio,next);else next();};next();
 },
 playCurrent(){
  if(!this.lesson||this.data.loading||this.data.error)return;
  if(this.data.phase==='activity'&&this.data.activity.type==='read-along')return this.playLines();
  this.stopAudio();const src=this.data.phase==='welcome'?this.lesson.intro.audio:this.data.phase==='finish'?this.lesson.completion.audio:this.data.activity.type==='line-practice'?this.data.currentLine.audio:this.data.activity.type==='sound-examples'?this.data.exampleAudio:this.data.activity.audio;
  if(src)audio.play(src);
 },
 playAnswer(){this.stopAudio();if(this.data.activity.answerAudio)audio.play(this.data.activity.answerAudio);},
 reset(scope){if(!this.lesson)return;let cursor=-1;if(scope==='step'){const current=this.lesson.activities[Math.min(Math.max(0,this.record.cursor),this.lesson.activities.length-1)];cursor=this.lesson.activities.findIndex(a=>a.step===current.step);}const keep=new Set(this.lesson.activities.slice(0,Math.max(0,cursor)).map(a=>a.id));this.record.awarded=this.record.awarded.filter(id=>keep.has(id));this.record.completed=false;this.move(cursor);},
 restart(){if(!this.lesson||this.data.loading||this.restartOpen)return;this.stopAudio();this.restartOpen=true;wx.showActionSheet({itemList:[this.data.ui.step,this.data.ui.lesson],success:r=>{if(this.visible)this.reset(r.tapIndex===0?'step':'lesson');},complete:()=>{this.restartOpen=false;}});},
 replay(){this.reset('lesson');},home(){this.stopAudio();wx.reLaunch({url:'/pages/home/index'+(this.weekId?'?weekId='+encodeURIComponent(this.weekId):'')});}
};};
