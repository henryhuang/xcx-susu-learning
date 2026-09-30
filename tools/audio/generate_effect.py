"""Generate a quiet, friendly retry chime locally (no network or speech service)."""
import math
from pathlib import Path
import struct
import wave

output = Path(__file__).resolve().parents[2] / 'miniprogram/assets/audio/effects/try-again.wav'
rate = 22050
notes = [(0.0, 523.25), (0.22, 659.25)]
frames = []
for i in range(int(rate * 0.65)):
    t = i / rate
    value = 0.0
    for start, frequency in notes:
        elapsed = t - start
        if 0 <= elapsed < 0.4:
            envelope = min(1, elapsed / 0.025) * math.exp(-elapsed * 10)
            envelope *= min(1, (0.4 - elapsed) / 0.04)
            value += 0.16 * envelope * math.sin(2 * math.pi * frequency * elapsed)
    frames.append(struct.pack('<h', round(value * 32767)))
output.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(output), 'wb') as audio:
    audio.setnchannels(1)
    audio.setsampwidth(2)
    audio.setframerate(rate)
    audio.writeframes(b''.join(frames))
print(output)
