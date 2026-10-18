module.exports = {
  words: [
    {word:'diamond',color:'#6fbde7',symbol:'◆'},
    {word:'oval',color:'#51c6b7',symbol:'⬭'},
    {word:'heart',color:'#ff6b81',symbol:'♥'},
    {word:'crescent',color:'#a78bd4',symbol:'☾'},
    {word:'star',color:'#ffd74b',symbol:'★'}
  ],
  questions: [
    {object:'starfish',art:'🌟',shape:'star',sentence:'The starfish is a star.',choices:['star','heart','diamond']},
    {object:'moon',art:'🌙',shape:'crescent',sentence:'The moon is a crescent.',choices:['crescent','oval','star']},
    {object:'egg',art:'🥚',shape:'oval',sentence:'The egg is an oval.',choices:['diamond','oval','heart']},
    {object:'kite',art:'🪁',shape:'diamond',sentence:'The kite is a diamond.',choices:['heart','diamond','crescent']},
    {object:'cookie',art:'💗',shape:'heart',sentence:'The cookie is a heart.',choices:['star','oval','heart']}
  ],
  examples: {k:['look','cook','book','talk'],g:['flag','dog','leg','log']},
  phonics: [
    {word:'flag',sound:'g',art:'🚩'}, {word:'dog',sound:'g',art:'🐶'},
    {word:'leg',sound:'g',art:'🦵'}, {word:'log',sound:'g',art:'🪵'},
    {word:'look',sound:'k',art:'👀'}, {word:'cook',sound:'k',art:'👩‍🍳'},
    {word:'book',sound:'k',art:'📕'}, {word:'talk',sound:'k',art:'💬'}
  ]
};
