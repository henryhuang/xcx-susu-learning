const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../miniprogram'),config=JSON.parse(fs.readFileSync(path.join(root,'project.config.json'))),app=JSON.parse(fs.readFileSync(path.join(root,'app.json')));
const groups={main:0};(app.subPackages||[]).forEach(s=>groups[s.root]=0);
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){
 const abs=path.join(dir,e.name),rel=path.relative(root,abs).split(path.sep).join('/');
 if(e.name.startsWith('.')||config.packOptions.ignore.some(r=>r.type==='folder'?(rel===r.value||rel.startsWith(r.value+'/')):rel===r.value))continue;
 if(e.isDirectory())walk(abs);else {const group=Object.keys(groups).find(g=>g!=='main'&&rel.startsWith(g+'/'))||'main';groups[group]+=fs.statSync(abs).size;}
}}
walk(root);
for(const [name,bytes] of Object.entries(groups)){console.log(`${name}: ${Math.ceil(bytes/1024)} KB / 2048 KB (local source estimate)`);if(bytes>2*1024*1024)process.exitCode=1;}
console.log('Total: '+Math.ceil(Object.values(groups).reduce((a,b)=>a+b,0)/1024)+' KB. Actual upload size must be verified in WeChat Developer Tools.');
