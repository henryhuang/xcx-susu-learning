// 本地协议 v2：所有活动由小程序预先实现；只允许声明式数据。
const schemas=require('../data/course-schemas');
const lessonSchema=schemas.lesson,weekSchema=schemas.week,manifestSchema=schemas.manifest;
function check(value,schema,path='data'){
  const fail=()=>{throw new Error('数据格式错误：'+path);};
  if(schema.oneOf){const valid=schema.oneOf.filter(s=>{try{check(value,s,path);return true;}catch(_){return false;}});if(valid.length!==1)fail();return;}
  if(schema.const!==undefined&&value!==schema.const)fail();
  if(schema.enum&&!schema.enum.includes(value))fail();
  if(schema.type==='object'){
    if(!value||typeof value!=='object'||Array.isArray(value))fail();
    for(const key of schema.required||[])if(value[key]===undefined)fail();
    for(const key of Object.keys(value)){if(!schema.properties[key])fail();check(value[key],schema.properties[key],path+'.'+key);}
  }else if(schema.type==='array'){
    if(!Array.isArray(value)||value.length<schema.minItems||value.length>schema.maxItems)fail();
    value.forEach((x,i)=>check(x,schema.items,path+'['+i+']'));
  }else if(schema.type==='string'){
    if(typeof value!=='string'||value.length>(schema.maxLength||2000)||value.length<(schema.minLength||0)||schema.minLength&&!value.trim()||schema.pattern&&!new RegExp(schema.pattern).test(value))fail();
    if((path.endsWith('.audio')||path.endsWith('.image')||path.endsWith('.cover')||path.endsWith('Audio'))&&value.includes('..'))fail();
  }else if(schema.type==='integer'&&(!Number.isSafeInteger(value)||value<schema.minimum))fail();
}
function unique(values){if(new Set(values).size!==values.length)throw new Error('ID 重复');}
function validateLesson(l){
  check(l,lessonSchema);unique(l.activities.map(a=>a.id));
  const lines=l.content?l.content.lines:[];unique(lines.map(x=>x.id));const lineIds=new Set(lines.map(x=>x.id)),steps=new Set();let last;
  for(const a of l.activities){
    if(last!==a.step){if(steps.has(a.step))throw new Error('同一步骤必须连续');steps.add(a.step);last=a.step;}
    if(a.lineIds){unique(a.lineIds);if(a.lineIds.some(id=>!lineIds.has(id)))throw new Error('引用的原文句子不存在');}
    if(a.type==='choice'){unique(a.choices.map(c=>c.value));if(!a.choices.some(c=>c.value===a.answer))throw new Error('答案不在选项中');}
  }
  if(l.category!=='english'&&(!l.content||l.language.content!=='zh-CN'||l.language.guidance!=='zh-CN'||l.presentation.theme!=='hanfu'))throw new Error('中文课程语言与形象配置不匹配');
  return l;
}
function validateWeek(w){check(w,weekSchema);unique(w.items.map(x=>x.id));return w;}
function validateManifest(m){check(m,manifestSchema);unique(m.weeks.map(w=>w.id));if(!m.weeks.some(w=>w.id===m.latestWeekId))throw new Error('最新周不存在');return m;}
module.exports={validateLesson,validateWeek,validateManifest};
