const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
let definition;
global.Component=value=>definition=value;
require('../components/poppy/index');
const component={data:{...definition.data},setData(value){Object.assign(this.data,value);}};
for(const pose of ['welcome','listen','think','cheer','celebrate','retry']){
  definition.observers['pose, theme'].call(component,pose,'poppy');
  const file=path.join(root,component.data.imageSrc.slice(1));
  assert(fs.existsSync(file),`missing ${pose} asset`);
  const png=fs.readFileSync(file);
  assert.equal(png.readUInt32BE(0),0x89504e47,'asset is not PNG');
  assert(png.readUInt32BE(16)>0&&png.readUInt32BE(20)>0,'invalid dimensions');
  const chunks=[];
  for(let offset=8;offset+12<=png.length;){
    const size=png.readUInt32BE(offset);
    chunks.push(png.toString('ascii',offset+4,offset+8));
    offset+=size+12;
  }
  assert([4,6].includes(png[25]) || chunks.includes('tRNS'),'mascot must have transparency');
  assert(component.data.imageLabel.includes('Poppy'));
}
definition.observers['pose, theme'].call(component,'invalid','poppy');
assert.equal(component.data.imageSrc,definition.data.imageSrc,'unknown pose should fall back');
for(const page of ['shapes','body','lesson']){
 const template=fs.readFileSync(path.join(root,`pages/${page}/index.wxml`),'utf8');
 assert(template.includes('pose="celebrate"'),'finish must celebrate');
 assert(template.includes("solved ? 'cheer'"),'answer feedback must change pose');
 assert(template.includes("'think'"),'unanswered question must show thinking');
 const expressions=[...template.matchAll(/pose="{{([^}]+)}}"/g)].map(match=>match[1]);
 assert.equal(expressions.length,1,'choice activity must have a reaction');
 for(const expression of expressions){
  const pose=new Function('solved','feedbackKind','playingKey', 'return '+expression);
  assert.equal(pose(false,'good',''),'think');
  assert.equal(pose(false,'good','word'),'listen');
  assert.equal(pose(false,'try',''),'retry');
  assert.equal(pose(false,'try','word'),'retry','wrong answer stays encouraging during replay');
  assert.equal(pose(true,'good',''),'cheer');
 }

}
console.log('Poppy checks passed: all six transparent assets, pose switching, fallback and course state bindings.');

for(const pose of ['welcome','read','listen','think','retry','cheer','celebrate']){
 definition.observers['pose, theme'].call(component,pose,'hanfu');
 assert(component.data.imageSrc.startsWith('/chinese/assets/images/'));
 assert(component.data.imageLabel.includes('酥酥'));
 const png=fs.readFileSync(path.join(root,component.data.imageSrc.slice(1)));
 assert.equal(png.readUInt32BE(0),0x89504e47);
 const chunks=[];for(let offset=8;offset+12<=png.length;){const size=png.readUInt32BE(offset);chunks.push(png.toString('ascii',offset+4,offset+8));offset+=size+12;}
 assert([4,6].includes(png[25])||chunks.includes('tRNS'),'Hanfu mascot must have transparency');
}
console.log('Hanfu checks passed: welcome, reading and encouragement mappings with transparent PNGs.');
