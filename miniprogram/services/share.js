const PAGES = {
  home:{title:'酥酥的学习小屋',path:'/pages/home/index'},
  shapes:{title:'酥酥的学习小屋 · 形状大冒险',path:'/pages/lesson/index?id=shapes'},
  body:{title:'酥酥的学习小屋 · 身体大冒险',path:'/pages/lesson/index?id=body'}
};
function showMenu() {
  if (typeof wx.showShareMenu !== 'function') return;
  wx.showShareMenu({
    menus:['shareAppMessage','shareTimeline'],
    fail(){ wx.showShareMenu({menus:['shareAppMessage'],fail(){}}); }
  });
}
function friend(page) {
  return {...PAGES[page],imageUrl:'/assets/images/share-cover.png'};
}
function timeline(page) {
  return {title:PAGES[page].title,query:'',imageUrl:'/assets/images/logo.png'};
}
module.exports = {showMenu,friend,timeline};
