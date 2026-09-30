"""Prepare verified Xiaoshuang clips, then replace only bundled Chinese audio.
Credentials are read from the local environment; no secrets enter mini-program files.
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[2]
TOOLS = Path(__file__).parent
PROFILE = json.loads((TOOLS / 'chinese-voice.json').read_text())
VOICE = PROFILE['voice']

def chinese(entry):
    return entry['path'].startswith('/chinese/assets/audio/') or entry['path'] == '/assets/audio/home-hello.mp3'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def inspect(path):
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'null', '-'], check=True, capture_output=True)
    info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(path)]))
    duration = float(info['format']['duration'])
    volume = subprocess.run(['ffmpeg', '-v', 'info', '-i', str(path), '-af', 'volumedetect', '-f', 'null', '-'], check=True, capture_output=True, text=True).stderr
    match = re.search(r'max_volume: (-?[\d.]+) dB', volume)
    if duration <= 0.1 or not match or float(match.group(1)) < -50:
        raise RuntimeError('Audio is empty or silent: ' + path.name)
    return {'bytes': path.stat().st_size, 'durationSeconds': round(duration, 3), 'maxVolumeDb': float(match.group(1)), 'sha256': sha(path), 'decoded': True}

def synthesize(entry, key, region, destination):
    # Keep prepared homophone overrides for rare readings from the existing manifest.
    text = escape(entry['text'])
    ssml = f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><voice name="{VOICE}"><prosody rate="{PROFILE["rate"]}">{text}</prosody></voice></speak>'
    request = urllib.request.Request(f'https://{region}.tts.speech.microsoft.com/cognitiveservices/v1', data=ssml.encode('utf-8'), headers={
        'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': PROFILE['outputFormat'], 'User-Agent': 'SusuCourseAudioPreparation'
    }, method='POST')
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            data = response.read()
            if 'audio/' not in response.headers.get('Content-Type', '') or len(data) < 1000:
                raise RuntimeError('Azure did not return valid audio; bundled files are unchanged.')
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'Azure synthesis failed (HTTP {error.code}); bundled files are unchanged.') from None
    except urllib.error.URLError:
        raise RuntimeError('Azure connection failed; bundled files are unchanged.') from None
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    return {'path': entry['path'], 'voice': VOICE, **inspect(destination)}

def install(entries, output, report):
    by_path = {r['path']: r for r in report}
    if set(by_path) != {e['path'] for e in entries}:
        raise RuntimeError('Candidate report does not match all Chinese clips.')
    for entry in entries:
        candidate = output / entry['path'].lstrip('/')
        r = by_path[entry['path']]
        if r['voice'] != VOICE or sha(candidate) != r['sha256']:
            raise RuntimeError('Candidate identity or checksum mismatch.')
        inspect(candidate)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    backup = ROOT / 'audio-candidates' / ('chinese-before-xiaoshuang-' + stamp)
    targets = [(ROOT / 'miniprogram' / e['path'].lstrip('/'), e['path'].lstrip('/')) for e in entries]
    manifest_path = TOOLS / 'weekly-manifest.json'
    validation_path = TOOLS / 'weekly-validation.json'
    # Back up every affected file and provenance before changing the app.
    for target, relative in targets:
        if not target.exists():
            raise RuntimeError('Bundled audio is missing: ' + relative)
        saved = backup / relative
        saved.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(target, saved)
    for p in [manifest_path, validation_path]:
        shutil.copy2(p, backup / p.name)
    try:
        for target, relative in targets:
            temporary = target.with_suffix('.replacement.mp3')
            shutil.copy2(output / relative, temporary)
            temporary.replace(target)
        manifest = json.loads(manifest_path.read_text())
        for e in manifest:
            if chinese(e):
                e['voice'] = VOICE
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        previous = json.loads(validation_path.read_text())
        final = [by_path.get(r['path'], r) for r in previous]
        validation_path.write_text(json.dumps(final, ensure_ascii=False, indent=2) + '\n')
    except Exception:
        for target, relative in targets:
            shutil.copy2(backup / relative, target)
            target.with_suffix('.replacement.mp3').unlink(missing_ok=True)
        for p in [manifest_path, validation_path]:
            shutil.copy2(backup / p.name, p)
        raise
    print(f'Replaced {len(entries)} Chinese clips with {VOICE}. Backup: {backup}')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--generate-only', action='store_true', help='Generate and validate without replacing bundled files')
    parser.add_argument('--install-only', action='store_true', help='Install previously generated and verified candidate files')
    args = parser.parse_args()
    if args.generate_only and args.install_only:
        parser.error('Choose one mode.')
    if not shutil.which('ffmpeg') or not shutil.which('ffprobe'):
        raise RuntimeError('ffmpeg and ffprobe are required for audio checks.')
    entries = [e for e in json.loads((TOOLS / 'weekly-manifest.json').read_text()) if chinese(e)]
    output = ROOT / 'audio-candidates' / 'xiaoshuang'
    report_path = output / 'validation.json'
    if args.install_only:
        report = json.loads(report_path.read_text())
    else:
        config_path = TOOLS / 'azure-speech.local.json'
        local = json.loads(config_path.read_text()) if config_path.exists() else {}
        key = (os.environ.get('AZURE_SPEECH_KEY') or local.get('key') or '').strip()
        region = (os.environ.get('AZURE_SPEECH_REGION') or local.get('region') or '').strip()
        if not key or not region:
            raise RuntimeError('Fill tools/audio/azure-speech.local.json with key and region, or set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION. Bundled files are unchanged.')
        if not re.fullmatch(r'[a-zA-Z0-9-]+', region):
            raise RuntimeError('Invalid Azure region.')
        report = []
        for entry in entries:
            report.append(synthesize(entry, key, region, output / entry['path'].lstrip('/')))
            print(entry['path'], flush=True)
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    if not args.generate_only:
        install(entries, output, report)
    else:
        print(f'Generated {len(entries)} verified Xiaoshuang clips. Bundled files unchanged.')

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        sys.exit(str(error))
