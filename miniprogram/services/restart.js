const shapes = require('../data/shapes');
const body = require('../data/body');
function keys(prefix,items) { return items.map((_,index) => `${prefix}-${index}`); }
const COURSES = {
  shapes:{lesson:3,steps:[
    {stage:'words',keys:[]}, {stage:'quiz',keys:keys('shape',shapes.questions)},
    {stage:'sounds',keys:[]}, {stage:'phonics',keys:keys('sound',shapes.phonics)}
  ]},
  body:{lesson:4,steps:[
    {stage:'words',keys:[]}, {stage:'actions',keys:['actions']},
    {stage:'counting',keys:keys('count',body.questions)}, {stage:'phonics',keys:keys('sound',body.phonics)}
  ]}
};
function stepIndex(course,stage) {
  const steps = COURSES[course].steps;
  const index = steps.findIndex(step => step.stage === stage);
  return index >= 0 ? index : stage === 'finish' ? steps.length-1 : 0;
}
function run(course,stage,awarded,scope) {
  const index = stepIndex(course,stage);
  const previousKeys = new Set(COURSES[course].steps.slice(0,index).reduce((all,step) => all.concat(step.keys),[]));
  // Rewind the current and later steps, keeping only rewards from earlier steps.
  const kept = scope === 'lesson' ? [] : [...awarded].filter(key => previousKeys.has(key));
  const stars = kept.reduce((total,key) => total + (course === 'shapes' && /^sound-[5-7]$/.test(key) ? 0 : 1),0);
  return {stage:scope === 'lesson' ? 'welcome' : COURSES[course].steps[index].stage,index:0,stars,awarded:kept,exampleSound:'k',exampleCount:0,exampleWord:''};
}
function prompt(page,course) {
  if (page.restartOpen) return;
  page.restartOpen = true;
  const index = stepIndex(course,page.data.stage);
  wx.showActionSheet({
    itemList:[`回到 STEP ${index+1} 开始`,`回到 LESSON ${COURSES[course].lesson} 开始`],
    success(result){ if (page.visible) page.reset(result.tapIndex === 0 ? 'step' : 'lesson'); },
    complete(){page.restartOpen = false;}
  });
}
module.exports = {run,prompt};
