"""Generate audition files outside the mini program; never overwrite bundled audio."""
import argparse
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.request
from xml.sax.saxutils import escape


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--all', action='store_true', help='Generate all 49 files instead of four audition samples')
    args = parser.parse_args()
    key = os.environ.get('AZURE_SPEECH_KEY')
    region = os.environ.get('AZURE_SPEECH_REGION')
    if not key or not region:
        sys.exit('Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION locally. Do not place credentials in the mini program.')
    if not all(c.isalnum() or c == '-' for c in region):
        sys.exit('Invalid Azure region')
    root = Path(__file__).resolve().parents[2]
    entries = json.loads((Path(__file__).parent / 'manifest.json').read_text())
    endpoint = f'https://{region}.tts.speech.microsoft.com/cognitiveservices/v1'
    for entry in entries:
        if not args.all and not entry['sample']:
            continue
        text = escape(entry['text'])
        ssml = f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="en-US-AnaNeural"><prosody rate="-10%">{text}</prosody></voice></speak>'
        request = urllib.request.Request(endpoint, data=ssml.encode(), headers={
            'Ocp-Apim-Subscription-Key': key,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
            'User-Agent': 'SusieAudioPreparation'
        }, method='POST')
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                audio = response.read()
                if 'audio/' not in response.headers.get('Content-Type', '') or not audio:
                    sys.exit('Azure did not return an audio file; bundled files were not changed.')
        except urllib.error.HTTPError as error:
            sys.exit(f'Azure synthesis failed (HTTP {error.code}); bundled files were not changed.')
        except urllib.error.URLError:
            sys.exit('Azure connection failed; bundled files were not changed.')
        relative = Path(entry['path']).relative_to('/assets/audio')
        target = root / 'audio-candidates' / 'ana' / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix('.tmp')
        temporary.write_bytes(audio)
        temporary.replace(target)
        print(relative)


if __name__ == '__main__':
    main()
