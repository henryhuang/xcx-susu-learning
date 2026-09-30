const share=require('../../services/share');
const audio=require('../../services/audio');
const courses=require('../../services/courses');
const progress=require('../../services/course-progress');
const config=require('../../config/courses');
const labels={english:'英语小冒险',poetry:'古诗小天地',dizigui:'弟子规小故事'};
Page({
  data:{weeks:[],week:{},lessons:[],loading:true,error:'',playingKey:'',audioError:'',canUpdate:!!config.latestUrl,updating:false,updateMessage:''},
  onLoad(options={}){this.requestedWeek=options.weekId||'';},
  onShareAppMessage(){return {...share.friend('home'),path:'/pages/home/index?weekId='+encodeURIComponent(this.data.week.id||'')};},
  onShareTimeline(){return {...share.timeline('home'),query:'weekId='+encodeURIComponent(this.data.week.id||'')};},
  onShow(){
    this.visible=true;share.showMenu();this.unsub=audio.subscribe(s=>this.setData({playingKey:s.playing?s.key:'',audioError:s.error||''}));
    try{courses.reloadCached();const c=courses.catalog();this.setData({weeks:c.manifest.weeks.map(w=>({...w,shortDate:w.reportDate.slice(5).replace('-','/')}))});
      let saved='';try{saved=wx.getStorageSync('susu-selected-week');}catch(_){}
      const candidate=this.requestedWeek||this.data.week.id||saved||c.manifest.latestWeekId;this.requestedWeek='';
      this.select(c.manifest.weeks.some(w=>w.id===candidate)?candidate:c.manifest.latestWeekId);
    }catch(_){this.setData({loading:false,error:'课程还没准备好。'});}
    if(config.latestUrl&&(!this.lastUpdate||Date.now()-this.lastUpdate>300000))this.updateCourses();
  },
  async updateCourses(){
    if(this.data.updating)return;this.setData({updating:true,updateMessage:'正在检查课程更新…'});
    try{const state=await courses.sync(()=>this.visible);this.lastUpdate=Date.now();
      if(this.visible){audio.stop();const c=courses.catalog();this.setData({weeks:c.manifest.weeks.map(w=>({...w,shortDate:w.reportDate.slice(5).replace('-','/')})),updateMessage:state==='updated'?'课程已更新':state==='current'?'已是最新课程':''});this.select(c.manifest.weeks.some(w=>w.id===this.data.week.id)?this.data.week.id:c.manifest.latestWeekId);}
    }catch(error){console.warn('[course-update]',error&&error.message||error&&error.errMsg||'更新失败');if(this.visible)this.setData({updateMessage:'更新暂未成功，仍可学习已有课程。'});}
    finally{this.setData({updating:false});}
  },
  select(id){
    audio.stop();const week=courses.week(id),lessons=week.items.map(item=>{
      const l=courses.lesson(item.lesson.id),r=progress.read(l);
      return {id:l.id,category:l.category,categoryLabel:labels[l.category],title:l.title,description:l.description,art:l.presentation.art||'📖',mode:item.mode,
        completed:r.completed,status:r.completed?'再练一次 →':r.cursor>=0?'继续上次学习 →':'一起开始 →'};
    });
    this.setData({week,lessons,loading:false,error:''});try{wx.setStorageSync('susu-selected-week',id);}catch(_){}
  },
  selectWeek(e){this.select(e.currentTarget.dataset.id);},
  onHide(){this.visible=false;audio.stop();if(this.unsub)this.unsub();},onUnload(){this.onHide();},
  goLesson(e){audio.stop();wx.navigateTo({url:courses.route(e.currentTarget.dataset.id,this.data.week.id)});},
  hello(){audio.play('/assets/audio/home-hello.mp3');}
});
