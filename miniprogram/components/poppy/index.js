const assets=require('../../services/course-assets');
const POSES = {
  welcome:{src:'/assets/images/poppy.png',label:'Poppy 抱着粉色书本挥手欢迎你'},
  listen:{src:'/assets/images/poppy-listen.png',label:'Poppy 把手放在耳边认真听'},
  think:{src:'/assets/images/poppy-think.png',label:'Poppy 托着下巴思考'},
  cheer:{src:'/assets/images/poppy-cheer.png',label:'Poppy 竖起大拇指为你加油'},
  retry:{src:'/assets/images/poppy-retry.png',label:'Poppy 微微歪头摊开手，温柔地邀请你再试一次'},
  celebrate:{src:'/assets/images/poppy-celebrate.png',label:'Poppy 举起双手庆祝完成学习'}
};
const HANFU={welcome:{src:'/chinese/assets/images/susu-hanfu-welcome.png',label:'汉服酥酥挥手欢迎你'},read:{src:'/chinese/assets/images/susu-hanfu-read.png',label:'汉服酥酥打开书本陪你读书'},cheer:{src:'/chinese/assets/images/susu-hanfu-cheer.png',label:'汉服酥酥竖起大拇指为你加油'}};
function select(pose,theme){return theme==='hanfu'?(['cheer','celebrate'].includes(pose)?HANFU.cheer:['read','listen','think','retry'].includes(pose)?HANFU.read:HANFU.welcome):POSES[pose]||POSES.welcome;}
Component({
  properties:{
    message:{type:String,value:''},
    theme:{type:String,value:'poppy'},
    compact:{type:Boolean,value:false},
    reaction:{type:Boolean,value:false},
    pose:{type:String,value:'welcome'}
  },
  data:{imageSrc:POSES.welcome.src,imageLabel:POSES.welcome.label},
  observers:{
    'pose, theme'(pose,theme){const selected=select(pose,theme);this.setData({imageSrc:assets.resolve(selected.src),imageLabel:selected.label});}
  }
});
