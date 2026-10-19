const speech=require('../../services/speech');
Page({
 data:{learnerId:'',allowed:false,requestCode:'',busy:false,message:''},
 onShow(){this.refresh();},
 async refresh(){await this.load('access');},
 async request(){await this.load('request-access');},
 async load(action){
  if(this.data.busy)return;
  this.setData({busy:true,message:''});
  try{const status=await speech.call(action,{});this.setData({allowed:status.allowed,learnerId:status.learnerId||'',requestCode:status.requestCode||''});}
  catch(error){this.setData({allowed:false,learnerId:'',message:'暂时无法读取权限，请检查云函数配置后重试。服务代码：'+(error.code||'UNKNOWN')});}
  finally{this.setData({busy:false});}
 },
 copy(){wx.setClipboardData({data:this.data.requestCode});},
 back(){wx.navigateBack({fail:()=>wx.reLaunch({url:'/pages/home/index'})});}
});
