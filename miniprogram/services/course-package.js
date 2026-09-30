// Remote packages contain data/media only. Activation happens after complete validation.
const protocol=require('./course-data');
const config=require('../config/courses');
const POINTER='susu-course-package-v1',ENGINE=1,MAX_BYTES=20*1024*1024,MAX_FILES=1000;
let busy=null;
function root(){return wx.env.USER_DATA_PATH+'/susu-courses';}
function call(fs,name,options){return new Promise((resolve,reject)=>fs[name]({...options,success:resolve,fail:reject}));}
function safePath(p){return typeof p==='string'&&!p.includes('..')&&(p==='data.json'||/^(?:assets|chinese\/assets)\/[a-zA-Z0-9_/-]+\.(mp3|png|jpg|jpeg|webp)$/.test(p));}
function validateData(data){
 if(!data||Object.keys(data).sort().join(',')!=='lessons,manifest,weeks')throw new Error('资源包结构不支持');
 protocol.validateManifest(data.manifest);
 if(!data.weeks||!data.lessons||Array.isArray(data.weeks)||Array.isArray(data.lessons))throw new Error('课程列表无效');
 const usedWeeks=new Set(),usedLessons=new Set();
 for(const e of data.manifest.weeks){const w=protocol.validateWeek(data.weeks[e.id]);if(w.id!==e.id||w.reportDate!==e.reportDate)throw new Error('周安排不匹配');usedWeeks.add(w.id);
  for(const i of w.items){const l=protocol.validateLesson(data.lessons[i.lesson.id]);if(l.id!==i.lesson.id||l.version!==i.lesson.version||l.category!==i.category)throw new Error('课程不匹配');usedLessons.add(l.id);}}
 if(Object.keys(data.weeks).length!==usedWeeks.size||Object.keys(data.lessons).length!==usedLessons.size)throw new Error('存在未引用课程');
 return data;
}
function media(data){const paths=new Set();function walk(v){if(typeof v==='string'&&/^\/(?:assets|chinese\/assets)\//.test(v)){if(!safePath(v.slice(1)))throw new Error('素材路径无效');paths.add(v.slice(1));}else if(v&&typeof v==='object')Object.values(v).forEach(walk);}walk(data);return paths;}
function validateIndex(i){
 if(!i||Object.keys(i).sort().join(',')!=='archive,filesCount,minEngineVersion,packageFormat,revision,schemaVersion,unpackedBytes'||i.packageFormat!==1||i.schemaVersion!==2||!Number.isSafeInteger(i.minEngineVersion)||i.minEngineVersion<1||i.minEngineVersion>ENGINE||!Number.isSafeInteger(i.revision)||i.revision<1)throw new Error('资源包版本不支持，请更新小程序');
 if(!i.archive||Object.keys(i.archive).sort().join(',')!=='bytes,md5,url'||typeof i.archive.url!=='string'||!(/^[a-zA-Z0-9_-]+\.zip$/.test(i.archive.url)||/^https:\/\/[^\s\\]+\.zip$/.test(i.archive.url))||!/^[a-f0-9]{32}$/.test(i.archive.md5))throw new Error('下载配置无效');
 for(const n of [i.archive.bytes,i.unpackedBytes])if(!Number.isSafeInteger(n)||n<1||n>MAX_BYTES)throw new Error('资源包过大');
 if(!Number.isSafeInteger(i.filesCount)||i.filesCount<1||i.filesCount>MAX_FILES)throw new Error('资源包文件数量无效');return i;
}
// Inspect ZIP central directory before unzip: reject traversal, executable files,
// encryption, symlinks, compression bombs and inconsistent local entry names.
function inspectZip(buffer,index){
 const v=new DataView(buffer),u=new Uint8Array(buffer);let end=-1;
 for(let p=buffer.byteLength-22;p>=Math.max(0,buffer.byteLength-65557);p--)if(v.getUint32(p,true)===0x06054b50){end=p;break;}
 if(end<0||v.getUint16(end+4,true)||v.getUint16(end+6,true)||v.getUint16(end+8,true)!==index.filesCount||v.getUint16(end+10,true)!==index.filesCount||end+22+v.getUint16(end+20,true)!==buffer.byteLength)throw new Error('ZIP 格式无效');
 const offset=v.getUint32(end+16,true),size=v.getUint32(end+12,true);if(offset+size!==end)throw new Error('ZIP 目录无效');
 let p=offset,total=0;const entries=new Map(),ranges=[];const name=(start,len)=>{let s='';for(let j=0;j<len;j++){if(u[start+j]>127)throw new Error('文件名无效');s+=String.fromCharCode(u[start+j]);}return s;};
 for(let n=0;n<index.filesCount;n++){
  if(p+46>end||v.getUint32(p,true)!==0x02014b50)throw new Error('ZIP 文件无效');
  const flags=v.getUint16(p+8,true),method=v.getUint16(p+10,true),compressed=v.getUint32(p+20,true),bytes=v.getUint32(p+24,true),len=v.getUint16(p+28,true),extra=v.getUint16(p+30,true),comment=v.getUint16(p+32,true),local=v.getUint32(p+42,true),attr=v.getUint32(p+38,true);
  if(p+46+len+extra+comment>end)throw new Error('ZIP 文件越界');const path=name(p+46,len);
  if(!safePath(path)||entries.has(path)||flags!==0||method!==0||compressed!==bytes||((attr>>>16)&0xf000)===0xa000||local+30>offset||v.getUint32(local,true)!==0x04034b50)throw new Error('ZIP 含不允许的文件');
  const localLen=v.getUint16(local+26,true),localExtra=v.getUint16(local+28,true);if(local+30+localLen+localExtra+bytes>offset||name(local+30,localLen)!==path||v.getUint16(local+6,true)!==flags||v.getUint16(local+8,true)!==method||v.getUint32(local+18,true)!==compressed||v.getUint32(local+22,true)!==bytes||v.getUint32(local+14,true)!==v.getUint32(p+16,true))throw new Error('ZIP 文件路径不一致');
  const stop=local+30+localLen+localExtra+bytes;if(ranges.some(r=>local<r[1]&&stop>r[0]))throw new Error('ZIP 文件重叠');ranges.push([local,stop]);total+=bytes;entries.set(path,bytes);p+=46+len+extra+comment;
 }
 if(p!==end||total!==index.unpackedBytes||!entries.has('data.json')||entries.get('data.json')>1024*1024)throw new Error('ZIP 文件清单不匹配');return entries;
}
function readPackage(fs,dir,revision){const data=validateData(JSON.parse(fs.readFileSync(dir+'/data.json','utf8')));if(data.manifest.revision!==revision)throw new Error('课程修订号不匹配');for(const p of media(data))fs.accessSync(dir+'/'+p);return data;}
function restore(){try{const pointer=wx.getStorageSync(POINTER);if(!pointer)return null;validateIndex(pointer.index);const dir=root()+'/r'+pointer.index.revision+'-'+pointer.index.archive.md5;if(pointer.directory!==dir)return null;return {data:readPackage(wx.getFileSystemManager(),dir,pointer.index.revision),directory:dir,index:pointer.index};}catch(_){return null;}}
function request(url){return new Promise((resolve,reject)=>wx.request({url,timeout:config.timeout||15000,dataType:'json',success:r=>r.statusCode===200?resolve(r.data):reject(new Error('获取课程目录失败')),fail:reject}));}
function download(url){return new Promise((resolve,reject)=>wx.downloadFile({url,timeout:60000,success:r=>r.statusCode===200?resolve(r.tempFilePath):reject(new Error('资源包下载失败')),fail:reject}));}
async function update(){
 if(!config.latestUrl)return {state:'disabled'};if(!/^https:\/\/[^\s\\]+$/.test(config.latestUrl))throw new Error('请配置 HTTPS 课程地址');
 const index=validateIndex(await request(config.latestUrl)),current=restore();
 if(current&&current.index.revision>=index.revision)return {state:'current',...current};
 const fs=wx.getFileSystemManager(),zip=await download(index.archive.url.startsWith('https://')?index.archive.url:config.latestUrl.slice(0,config.latestUrl.lastIndexOf('/')+1)+index.archive.url);
 const dir=root()+'/r'+index.revision+'-'+index.archive.md5;let committed=false;
 try{
  const info=await call(fs,'getFileInfo',{filePath:zip,digestAlgorithm:'md5'});if(info.size!==index.archive.bytes||info.digest!==index.archive.md5)throw new Error('下载文件不完整');
  const entries=inspectZip(fs.readFileSync(zip),index);
  try{fs.accessSync(root());}catch(_){fs.mkdirSync(root(),true);}try{await call(fs,'rmdir',{dirPath:dir,recursive:true});}catch(_){}
  fs.mkdirSync(dir,true);await call(fs,'unzip',{zipFilePath:zip,targetPath:dir});
  const data=readPackage(fs,dir,index.revision);
  for(const [p,size] of entries){const stat=fs.statSync(dir+'/'+p);if(stat.size!==size)throw new Error('解压文件不完整');}
  for(const p of media(data))if(!entries.has(p))throw new Error('素材缺失');
  wx.setStorageSync(POINTER,{directory:dir,index});committed=true;
  // Keep only current and previous validated package; failed staging never becomes active.
  try{for(const p of fs.readdirSync(root())){const full=root()+'/'+p;if(full!==dir&&(!current||full!==current.directory)&&/^r\d+-[a-f0-9]{32}$/.test(p))await call(fs,'rmdir',{dirPath:full,recursive:true});}}catch(_){}
  return {state:'updated',data,directory:dir,index};
 }finally{try{fs.unlinkSync(zip);}catch(_){}if(!committed&&(!current||dir!==current.directory)){try{await call(fs,'rmdir',{dirPath:dir,recursive:true});}catch(_){}}}
}
function sync(){if(!busy)busy=update().finally(()=>{busy=null;});return busy;}
module.exports={restore,sync,validateData,validateIndex,inspectZip,media};
