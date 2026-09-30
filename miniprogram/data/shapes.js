module.exports = {
  words: [
    {word:'diamond',zh:'菱形',color:'#6fbde7',symbol:'◆'},
    {word:'oval',zh:'椭圆形',color:'#51c6b7',symbol:'⬭'},
    {word:'heart',zh:'心形',color:'#ff6b81',symbol:'♥'},
    {word:'crescent',zh:'月牙形',color:'#a78bd4',symbol:'☾'},
    {word:'star',zh:'星形',color:'#ffd74b',symbol:'★'}
  ],
  questions: [
    {object:'starfish',zh:'海星',art:'🌟',shape:'star',sentence:'The starfish is a star.',choices:['star','heart','diamond']},
    {object:'moon',zh:'月亮',art:'🌙',shape:'crescent',sentence:'The moon is a crescent.',choices:['crescent','oval','star']},
    {object:'egg',zh:'鸡蛋',art:'🥚',shape:'oval',sentence:'The egg is an oval.',choices:['diamond','oval','heart']},
    {object:'kite',zh:'风筝',art:'🪁',shape:'diamond',sentence:'The kite is a diamond.',choices:['heart','diamond','crescent']},
    {object:'cookie',zh:'饼干',art:'💗',shape:'heart',sentence:'The cookie is a heart.',choices:['star','oval','heart']}
  ],
  examples: {k:['look','cook','book','talk'],g:['flag','dog','leg','log']},
  phonics: [
    {word:'flag',sound:'g',art:'🚩'}, {word:'dog',sound:'g',art:'🐶'},
    {word:'leg',sound:'g',art:'🦵'}, {word:'log',sound:'g',art:'🪵'},
    {word:'look',sound:'k',art:'👀'}, {word:'cook',sound:'k',art:'👩‍🍳'},
    {word:'book',sound:'k',art:'📕'}, {word:'talk',sound:'k',art:'💬'}
  ]
};
