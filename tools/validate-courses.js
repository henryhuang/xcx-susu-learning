const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../miniprogram'),courses=require(path.join(root,'services/courses'));
const manifest=courses.catalog().manifest,seen=new Set();
function assets(value){if(typeof value==='string'&&/^\/(assets|chinese\/assets)\//.test(value)&&!fs.existsSync(path.join(root,value.slice(1))))throw new Error('Missing asset: '+value);else if(Array.isArray(value))value.forEach(assets);else if(value&&typeof value==='object')Object.values(value).forEach(assets);}
for(const entry of manifest.weeks){const w=courses.week(entry.id);if(w.reportDate!==entry.reportDate)throw new Error('Report date mismatch');for(const item of w.items){const l=courses.lesson(item.lesson.id);assets(l);seen.add(l.id);}}
assets('/assets/audio/home-hello.mp3');
console.log(`Validated ${manifest.weeks.length} weeks, ${seen.size} lessons, all local assets and cross references.`);
