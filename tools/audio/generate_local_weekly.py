"""Offline macOS voice preparation; generates bundled audio, no runtime speech calls."""
import json, subprocess, concurrent.futures, argparse, sys
from pathlib import Path
root=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser();parser.add_argument('--english-only',action='store_true');args=parser.parse_args()
entries=json.loads((Path(__file__).parent/'weekly-manifest.json').read_text())
if not args.english_only:sys.exit('Chinese voice is now configured for Xiaoshuang. Use tools/audio/generate_xiaoshuang.py, or --english-only to regenerate English without changing Chinese audio.')
entries=[e for e in entries if e['voice']=='Samantha']
if not entries:
    raise SystemExit('No Samantha clips remain. Use generate_ana_weekly.py for English audio.')
work=root/'work/audio';work.mkdir(parents=True,exist_ok=True)
def generate(e):
 target=root/'miniprogram'/e['path'].lstrip('/');target.parent.mkdir(parents=True,exist_ok=True)
 source=work/(target.stem+'.aiff');textfile=work/(target.stem+'.txt');textfile.write_text(e['text'])
 subprocess.run(['say','-v',e['voice'],'-r','155' if e['voice']=='Tingting' else '145','-f',str(textfile),'-o',str(source)],check=True,stdout=subprocess.DEVNULL)
 subprocess.run(['ffmpeg','-y','-v','error','-i',str(source),'-ar','22050','-ac','1','-b:a','32k',str(target)],check=True)
 return target.name
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for name in pool.map(generate,entries):print(name,flush=True)
