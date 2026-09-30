const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto'),cp=require('child_process');
const app=path.resolve(__dirname,'..'),exported=path.resolve(app,'../outputs/course-package-r1');
const index=JSON.parse(fs.readFileSync(path.join(exported,'latest.json'))),archive=path.join(exported,index.archive.url),temp=fs.mkdtempSync(path.join(os.tmpdir(),'susu-package-test-'));
let stores={},downloads=0,response=index,downloadSource=archive,offline=false;
const api={readFileSync:(...a)=>{const b=fs.readFileSync(...a);return Buffer.isBuffer(b)?b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength):b;},mkdirSync:(p,recursive)=>fs.mkdirSync(p,{recursive}),accessSync:p=>fs.accessSync(p),statSync:p=>fs.statSync(p),readdirSync:p=>fs.readdirSync(p),unlinkSync:p=>fs.unlinkSync(p),
 getFileInfo(o){try{const b=fs.readFileSync(o.filePath);o.success({size:b.length,digest:crypto.createHash(o.digestAlgorithm).update(b).digest('hex')});}catch(e){o.fail(e);}},
 rmdir(o){try{fs.rmSync(o.dirPath,{recursive:true,force:true});o.success({});}catch(e){o.fail(e);}},
 unzip(o){try{cp.execFileSync('python3',['-c','import zipfile,sys;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',o.zipFilePath,o.targetPath]);o.success({});}catch(e){o.fail(e);}}};
global.wx={env:{USER_DATA_PATH:temp},getFileSystemManager:()=>api,getStorageSync:k=>stores[k],setStorageSync:(k,v)=>stores[k]=JSON.parse(JSON.stringify(v)),request:o=>offline?o.fail(new Error('offline')):o.success({statusCode:200,data:response}),downloadFile:o=>{downloads++;const target=path.join(temp,'download-'+downloads+'.zip');fs.copyFileSync(downloadSource,target);o.success({statusCode:200,tempFilePath:target});}};
const config=require('../config/courses'),configuredUrl=config.latestUrl,packages=require('../services/course-package'),courses=require('../services/courses'),assets=require('../services/course-assets');
(async()=>{try{
 config.latestUrl='';
 assert.equal(await courses.sync(),'disabled');assert.equal(downloads,0);
 const b=fs.readFileSync(archive),array=b.buffer.slice(b.byteOffset,b.byteOffset+b.length);assert.equal(packages.inspectZip(array,index).size,110);
 assert.throws(()=>packages.validateIndex({...index,minEngineVersion:2}));assert.throws(()=>packages.validateIndex({...index,archive:{...index.archive,url:'../bad.zip'}}));
 const evil=Buffer.from(b);const central=evil.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));evil.write('../bad.js',central+46,'ascii');assert.throws(()=>packages.inspectZip(evil.buffer.slice(evil.byteOffset,evil.byteOffset+evil.length),index));
 config.latestUrl='https://example.invalid/courses/latest.json';
 assert.equal(await courses.sync(),'updated');assert.equal(courses.catalog().source,'downloaded');assert.equal(courses.week().items.length,3);const pointer=JSON.stringify(stores);const dir=packages.restore().directory;
 assert.equal(assets.resolve('/chinese/assets/audio/poem-cunju-line-1.mp3'),dir+'/chinese/assets/audio/poem-cunju-line-1.mp3');
 const progress=require('../services/course-progress'),lesson=courses.lesson('body');progress.save(lesson,{cursor:lesson.activities.length,awarded:[],completed:true,bestStars:10});
 delete require.cache[require.resolve('../services/courses')];const cold=require('../services/courses');assert.equal(cold.catalog().source,'downloaded');assert.equal(cold.lesson('body').id,'body');offline=true;await assert.rejects(()=>courses.sync());assert.equal(courses.catalog().source,'downloaded');offline=false;
 assert.equal(await courses.sync(),'current');assert.equal(downloads,1);assert(progress.read(courses.lesson('body')).completed);
 response={...index,revision:2,archive:{...index.archive,md5:'0'.repeat(32)}};await assert.rejects(()=>courses.sync());assert.equal(packages.restore().index.revision,1);assert(progress.read(courses.lesson('body')).completed);
 response={...index,revision:2};await assert.rejects(()=>courses.sync());assert.equal(packages.restore().index.revision,1);assert.equal(fs.readdirSync(path.join(temp,'susu-courses')).length,1);
 response=index;const cached=packages.restore();assert.equal(cached.data.manifest.latestWeekId,'2026-09-24');
 fs.unlinkSync(dir+'/chinese/assets/audio/poem-cunju-line-1.mp3');assert.equal(packages.restore(),null);courses.reloadCached();assert.equal(courses.catalog().source,'local');assert.equal(assets.resolve('/assets/audio/home-hello.mp3'),'/assets/audio/home-hello.mp3');
 const currentRevision=require('../data/local-courses').manifest.revision,currentExport=path.resolve(app,'../outputs/course-package-r'+currentRevision);
 response=JSON.parse(fs.readFileSync(path.join(currentExport,'latest.json')));downloadSource=path.join(currentExport,response.archive.url);
 assert.equal(await courses.sync(),'updated');assert.equal(courses.week().id,'2026-09-30');assert.equal(courses.week().items.length,1);assert.equal(courses.lesson('english-ants-and-pants').version,2);assert.equal(courses.lesson('english-ants-and-pants').activities.length,13);
 console.log('Passed remote package: disabled networking, ZIP safety, version rejection, install, cache restore, media mapping, checksum failure, failed staging cleanup, unchanged progress and missing-asset fallback.');
 }finally{config.latestUrl=configuredUrl;fs.rmSync(temp,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
