"""Generate and verify the 9/11 weekly English clips with Azure Ana."""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape

ROOT=Path(__file__).resolve().parents[2]
TOOLS=Path(__file__).parent
MANIFEST=TOOLS/'weekly-manifest.json'
VALIDATION=TOOLS/'weekly-validation.json'
CANDIDATES=ROOT/'audio-candidates'/'ana-weekly'
VOICE='en-US-AnaNeural'

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def inspect(path):
    subprocess.run(['ffmpeg','-v','error','-i',str(path),'-f','null','-'],check=True,capture_output=True)
    data=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(path)]))
    duration=float(data['format']['duration'])
    stderr=subprocess.run(['ffmpeg','-v','info','-i',str(path),'-af','volumedetect','-f','null','-'],check=True,capture_output=True,text=True).stderr
    match=re.search(r'max_volume: (-?[\d.]+) dB',stderr)
    if duration<=.1 or not match or float(match.group(1))<-50:raise RuntimeError('Empty or silent audio: '+path.name)
    return {'bytes':path.stat().st_size,'durationSeconds':round(duration,3),'maxVolumeDb':float(match.group(1)),'sha256':digest(path),'decoded':True}

def generate(entry,key,region):
    text=escape(entry['text'])
    ssml=f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="{VOICE}"><prosody rate="-8%">{text}</prosody></voice></speak>'
    request=urllib.request.Request(f'https://{region}.tts.speech.microsoft.com/cognitiveservices/v1',data=ssml.encode(),headers={'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'audio-24khz-48kbitrate-mono-mp3','User-Agent':'SusuCourseAudioPreparation'},method='POST')
    try:
        with urllib.request.urlopen(request,timeout=45) as response:
            content=response.read()
            if 'audio/' not in response.headers.get('Content-Type','') or len(content)<1000:raise RuntimeError('Azure did not return valid audio')
    except urllib.error.HTTPError as error:raise RuntimeError(f'Azure synthesis failed (HTTP {error.code})') from None
    target=CANDIDATES/entry['path'].lstrip('/')
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes(content)
    return {'path':entry['path'],'voice':VOICE,**inspect(target)}

def main():
    local=TOOLS/'azure-speech.local.json'
    config=json.loads(local.read_text()) if local.exists() else {}
    key=(os.environ.get('AZURE_SPEECH_KEY') or config.get('key') or '').strip()
    region=(os.environ.get('AZURE_SPEECH_REGION') or config.get('region') or '').strip()
    if not key or not re.fullmatch(r'[a-zA-Z0-9-]+',region):raise RuntimeError('Azure Speech local key/region is missing or invalid')
    entries=json.loads(MANIFEST.read_text())
    selected=[e for e in entries if e['path'].startswith('/assets/audio/weekly/evening-')]
    if len(selected)!=16 or any(e['voice'] not in ('Samantha',VOICE) for e in selected):raise RuntimeError('Unexpected English clip manifest')
    report=[]
    for entry in selected:
        report.append(generate(entry,key,region))
        print(entry['path'],flush=True)
    if len({r['path'] for r in report})!=16:raise RuntimeError('Incomplete candidate set')
    for r in report:
        candidate=CANDIDATES/r['path'].lstrip('/')
        if digest(candidate)!=r['sha256']:raise RuntimeError('Candidate checksum mismatch')
        inspect(candidate)
    backup=ROOT/'audio-candidates'/('english-before-ana-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    for entry in selected:
        relative=entry['path'].lstrip('/')
        destination=backup/relative
        destination.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(ROOT/'miniprogram'/relative,destination)
    for source in (MANIFEST,VALIDATION):shutil.copy2(source,backup/source.name)
    try:
        for entry in selected:
            relative=entry['path'].lstrip('/')
            destination=ROOT/'miniprogram'/relative
            temp=destination.with_suffix('.replacement.mp3')
            shutil.copy2(CANDIDATES/relative,temp)
            temp.replace(destination)
            upload_copy=destination.with_name(destination.stem+'.compressed.mp3')
            if upload_copy.exists():shutil.copy2(destination,upload_copy)
        by_path={r['path']:r for r in report}
        for entry in entries:
            if entry['path'] in by_path:entry['voice']=VOICE
        MANIFEST.write_text(json.dumps(entries,ensure_ascii=False,indent=2)+'\n')
        previous=json.loads(VALIDATION.read_text())
        if {r['path'] for r in previous}.intersection(by_path.keys())!=set(by_path):raise RuntimeError('Validation record missing clips')
        VALIDATION.write_text(json.dumps([by_path.get(r['path'],r) for r in previous],ensure_ascii=False,indent=2)+'\n')
    except Exception:
        for entry in selected:
            relative=entry['path'].lstrip('/')
            destination=ROOT/'miniprogram'/relative
            shutil.copy2(backup/relative,destination)
            upload_copy=destination.with_name(destination.stem+'.compressed.mp3')
            if upload_copy.exists():shutil.copy2(destination,upload_copy)
            destination.with_suffix('.replacement.mp3').unlink(missing_ok=True)
        for source in (MANIFEST,VALIDATION):shutil.copy2(backup/source.name,source)
        raise
    print(f'Replaced {len(report)} English clips with {VOICE}. Backup: {backup}')

if __name__=='__main__':
    try:main()
    except Exception as error:sys.exit(str(error))
