// Export declarative data and media only; never include code or credentials.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),app=path.join(root,'miniprogram');
cp.execFileSync(process.execPath,[path.join(__dirname,'build-local-courses.js')],{stdio:'inherit'});
const data=require(path.join(app,'data/local-courses'));
const revision=Number(process.argv[2]||data.manifest.revision);
if(!Number.isSafeInteger(revision)||revision<1)throw new Error('Revision must be a positive integer');
data.manifest.revision=revision;
const out=path.join(root,'outputs','course-package-r'+revision),stage=path.join(root,'work','course-package-r'+revision);
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(stage,{recursive:true});
const files=[];
function add(relative,bytes){if(files.some(f=>f.path===relative))throw new Error('Duplicate path');const target=path.join(stage,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);files.push({path:relative,bytes:bytes.length});}
add('data.json',Buffer.from(JSON.stringify(data)));
function walk(dir){for(const e of fs.readdirSync(path.join(app,dir),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())walk(p);else if(/\.compressed\.mp3$/i.test(p))continue;else if(/\.(mp3|png|jpg|jpeg|webp)$/i.test(p))add(p,fs.readFileSync(path.join(app,p)));}}
walk('assets');walk('chinese/assets');
const archive='susu-courses-r'+revision+'.zip';
// Python's stored ZIP avoids unsupported compression modes and makes inspection predictable.
const script='import zipfile,sys,json,pathlib\ns=pathlib.Path(sys.argv[1])\nwith zipfile.ZipFile(sys.argv[2],"w",compression=zipfile.ZIP_STORED) as z:\n for f in json.loads(sys.argv[3]): z.write(s/f["path"],f["path"])';
cp.execFileSync('python3',['-c',script,stage,path.join(out,archive),JSON.stringify(files)]);
const bytes=fs.readFileSync(path.join(out,archive));
const index={packageFormat:1,schemaVersion:2,revision,minEngineVersion:1,archive:{url:archive,bytes:bytes.length,md5:crypto.createHash('md5').update(bytes).digest('hex')},unpackedBytes:files.reduce((n,f)=>n+f.bytes,0),filesCount:files.length};
const packageValidator=require(path.join(app,'services/course-package'));
packageValidator.inspectZip(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),index);
fs.writeFileSync(path.join(out,'latest.json'),JSON.stringify(index,null,2)+'\n');
fs.writeFileSync(path.join(out,'README.txt'),'上传本目录的 latest.json 与 '+archive+' 到同一个 HTTPS 目录。\n提供 latest.json 的完整下载地址。先上传 ZIP，再上传 latest.json。\n资源包仅包含 JSON、图片、MP3；不含 JS、密钥。\n每次更新使用递增 revision：node tools/make-course-package.js 2\n不要覆盖已发布的 ZIP，保留旧版本供回退。\n');
console.log(`Exported ${files.length} files, ${bytes.length} bytes: ${out}`);
