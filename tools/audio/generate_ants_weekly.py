"""Generate the 9/30 English lesson's local MP3 files with Ana."""
import json
import os
import re
import subprocess
import urllib.request
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[2]
LESSON = ROOT / 'miniprogram/courses/lessons/english-ants-and-pants-v2.json'
CONFIG = Path(__file__).with_name('azure-speech.local.json')
VOICE = 'en-US-AnaNeural'


def main():
    lesson = json.loads(LESSON.read_text())
    entries = [lesson['intro'], *lesson['activities']]
    config = json.loads(CONFIG.read_text()) if CONFIG.exists() else {}
    key = (os.environ.get('AZURE_SPEECH_KEY') or config.get('key') or '').strip()
    region = (os.environ.get('AZURE_SPEECH_REGION') or config.get('region') or '').strip()
    if not key or not re.fullmatch(r'[a-zA-Z0-9-]+', region):
        raise RuntimeError('Azure Speech local key/region is missing or invalid')
    endpoint = f'https://{region}.tts.speech.microsoft.com/cognitiveservices/v1'
    for entry in entries:
        target = ROOT / 'miniprogram' / entry['audio'].lstrip('/')
        if target.exists():
            continue
        ssml = f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="{VOICE}"><prosody rate="-8%">{escape(entry["text"])}</prosody></voice></speak>'
        request = urllib.request.Request(endpoint, data=ssml.encode(), headers={
            'Ocp-Apim-Subscription-Key': key,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
            'User-Agent': 'SusuCourseAudioPreparation'
        }, method='POST')
        with urllib.request.urlopen(request, timeout=45) as response:
            data = response.read()
            if 'audio/' not in response.headers.get('Content-Type', '') or len(data) < 1000:
                raise RuntimeError(f'No valid audio for {target.name}')
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix('.tmp.mp3')
        temporary.write_bytes(data)
        compact = target.with_suffix('.compact.mp3')
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(temporary), '-ac', '1', '-b:a', '32k', str(compact)], check=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(compact), '-f', 'null', '-'], check=True)
        compact.replace(temporary)
        temporary.replace(target)
        print(target.name, flush=True)


if __name__ == '__main__':
    main()
