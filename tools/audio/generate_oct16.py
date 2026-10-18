"""Prepare the 10/16 clips with existing Azure voices; validate before installing.

New clips use 24 kbps mono MP3 to keep the mini-program within its package limit.
Credentials stay in the local ignored configuration or environment variables.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path
from xml.sax.saxutils import escape

from generate_xiaoshuang import inspect

ROOT = Path(__file__).resolve().parents[2]
TOOLS = Path(__file__).parent
OUTPUT = ROOT / 'audio-candidates/oct16'


def main():
    entries = json.loads((TOOLS / 'oct16-manifest.json').read_text())
    if len({e['path'] for e in entries}) != len(entries):
        raise RuntimeError('Duplicate audio paths')
    local = TOOLS / 'azure-speech.local.json'
    config = json.loads(local.read_text()) if local.exists() else {}
    key = (os.environ.get('AZURE_SPEECH_KEY') or config.get('key') or '').strip()
    region = (os.environ.get('AZURE_SPEECH_REGION') or config.get('region') or '').strip()
    if not key or not re.fullmatch(r'[a-zA-Z0-9-]+', region):
        raise RuntimeError('Azure Speech local key/region is missing or invalid')
    report = []
    for entry in entries:
        relative = entry['path'].lstrip('/')
        if not relative.startswith(('assets/audio/weekly/', 'chinese/assets/audio/')) or '..' in relative:
            raise RuntimeError('Unexpected audio path')
        target = OUTPUT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        language = 'zh-CN' if entry['voice'] == 'zh-CN-XiaoshuangNeural' else 'en-US'
        ssml = (f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="{language}">'
                f'<voice name="{entry["voice"]}"><prosody rate="-8%">{escape(entry["text"])}</prosody></voice></speak>')
        if not target.exists():
            request = urllib.request.Request(
                f'https://{region}.tts.speech.microsoft.com/cognitiveservices/v1', data=ssml.encode(),
                headers={'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml',
                         'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
                         'User-Agent': 'SusuCourseAudioPreparation'}, method='POST')
            try:
                with urllib.request.urlopen(request, timeout=45) as response:
                    data = response.read()
                    if 'audio/' not in response.headers.get('Content-Type', '') or len(data) < 1000:
                        raise RuntimeError('Azure did not return valid audio')
            except urllib.error.HTTPError as error:
                raise RuntimeError(f'Azure synthesis failed (HTTP {error.code})') from None
            except urllib.error.URLError:
                raise RuntimeError('Azure connection failed') from None
            raw = target.with_suffix('.raw.mp3')
            raw.write_bytes(data)
            subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(raw), '-ac', '1', '-b:a', '24k', str(target)], check=True)
            raw.unlink()
        report.append({'path': entry['path'], 'voice': entry['voice'], 'text': entry['text'], **inspect(target)})
        print(target.name, flush=True)
    # Install only when the complete candidate set passes validation.
    for entry in report:
        candidate = OUTPUT / entry['path'].lstrip('/')
        if hashlib.sha256(candidate.read_bytes()).hexdigest() != entry['sha256']:
            raise RuntimeError('Candidate checksum mismatch')
    for entry in report:
        relative = entry['path'].lstrip('/')
        target = ROOT / 'miniprogram' / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(OUTPUT / relative, target)
    (TOOLS / 'oct16-validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(f'Installed {len(report)} validated clips.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        sys.exit(str(error))
