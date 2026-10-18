"""Compact original 48 kbps English clips to 24 kbps until the main bundle fits.

Backups and candidates stay outside the mini-program. The validation report records
which original generation checksums are superseded by the compact copies.
"""
import json
import shutil
import subprocess
from pathlib import Path
from generate_xiaoshuang import inspect

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / 'miniprogram'
OUTPUT = ROOT / 'audio-candidates/compact-oct16'
REPORT = Path(__file__).with_name('oct16-compaction-validation.json')


def main_bytes():
    config = json.loads((APP / 'project.config.json').read_text())
    ignores = [r['value'] for r in config['packOptions']['ignore']]
    return sum(p.stat().st_size for p in APP.rglob('*') if p.is_file()
               and not any(s.startswith('.') for s in p.relative_to(APP).parts)
               and not p.relative_to(APP).as_posix().startswith('chinese/')
               and not any(p.relative_to(APP).as_posix() == v or p.relative_to(APP).as_posix().startswith(v + '/') for v in ignores))


def main():
    report = json.loads(REPORT.read_text()) if REPORT.exists() else []
    candidates = sorted([* (APP / 'assets/audio/sentences').glob('*.mp3'),
                         * (APP / 'assets/audio/words').glob('*.mp3')],
                        key=lambda p: p.stat().st_size, reverse=True)
    for target in candidates:
        if main_bytes() <= 2000 * 1024:
            break
        info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=bit_rate', '-of', 'json', str(target)]))
        if int(info['format']['bit_rate']) < 40000:
            continue
        relative = target.relative_to(APP)
        backup = OUTPUT / 'original' / relative
        compact = OUTPUT / 'compact' / relative
        backup.parent.mkdir(parents=True, exist_ok=True)
        compact.parent.mkdir(parents=True, exist_ok=True)
        if backup.exists():
            raise RuntimeError('Existing original backup; inspect before overwriting')
        shutil.copy2(target, backup)
        before = inspect(target)
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(target), '-ac', '1', '-b:a', '24k', str(compact)], check=True)
        after = inspect(compact)
        if abs(after['durationSeconds'] - before['durationSeconds']) > .15:
            raise RuntimeError('Unexpected audio duration change')
        shutil.copy2(compact, target)
        report.append({'path': '/' + relative.as_posix(), 'voice': 'en-US-AnaNeural', 'original': before, 'compact': after})
        REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    if main_bytes() > 2000 * 1024:
        raise RuntimeError('Main bundle remains too large')
    print(f'Compacted {len(report)} clips; main bundle {main_bytes()} bytes.')


if __name__ == '__main__':
    main()
