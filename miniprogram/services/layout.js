function headerStyle() {
  let top = 32;
  try {
    const menu = wx.getMenuButtonBoundingClientRect();
    const info = wx.getSystemInfoSync();
    top = menu && menu.bottom ? menu.bottom + 8 : (info.statusBarHeight || 24) + 48;
  } catch (_) {}
  return `padding-top:${top}px`;
}
module.exports = {headerStyle};
