"""Prepare local Ana files through Microsoft's Edge voice service, outside the app."""
import argparse
import asyncio
import json
from pathlib import Path
import edge_tts

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--all', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    entries = json.loads((Path(__file__).parent / 'manifest.json').read_text())
    limiter = asyncio.Semaphore(2)
    async def generate(entry):
        if not args.all and not entry['sample']:
            return
        relative = Path(entry['path']).relative_to('/assets/audio')
        target = root / 'audio-candidates' / 'ana' / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix('.tmp.mp3')
        async with limiter:
            voice = edge_tts.Communicate(entry['text'], 'en-US-AnaNeural', rate='-8%')
            try:
                await asyncio.wait_for(voice.save(str(temporary)), timeout=60)
                if not temporary.exists() or temporary.stat().st_size < 1000:
                    raise RuntimeError('Empty audio response')
                temporary.replace(target)
            finally:
                if temporary.exists():
                    temporary.unlink()
        print(relative, flush=True)
    await asyncio.gather(*(generate(entry) for entry in entries))

if __name__ == '__main__':
    asyncio.run(main())
