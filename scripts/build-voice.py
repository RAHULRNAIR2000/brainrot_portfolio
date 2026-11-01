"""Generates Mehmet Usta's voice lines with Piper TTS (runs locally, no account).

The game uses the English voice. The Turkish voice can instead read the lines respelled the way a
Turkish speaker would say them, which gives a Turkish accent. Output is loudness-matched mp3.

  python -m pip install --user piper-tts lameenc
  cd assets-src/tts && python -m piper.download_voices tr_TR-dfki-medium en_GB-northern_english_male-medium
  python scripts/build-voice.py            # English set -> public/voice/vendor
  python scripts/build-voice.py --turkish  # Turkish-accent set -> assets-src/tts/turkish
"""
import array
import io
import math
import os
import sys
import wave

import lameenc
from piper import PiperVoice, SynthesisConfig

# key: (subtitle line for reference, how the Turkish voice should say it)
LINES = {
    'greeting': ('Heyy kid! Come, come. Best ice cream in the world.', 'Hey kid! Kam, kam! Best ays krim in dı vörld!'),
    'menu': ('Pick a flavor, kid. Any flavor.', 'Pik ı fleyvır, kid. Eni fleyvır.'),
    'offer-1': ('Here, take it!', 'Hiır, teyk it!'),
    'offer-2': ('For you, kid. Take!', 'For yu, kid. Teyk!'),
    'offer-3': ('Fresh, fresh! Come take.', 'Freş, freş! Kam, teyk.'),
    'taunt-1': ('Almost, kid!', 'Olmost, kid!'),
    'taunt-2': ('Too slow!', 'Tuu slou!'),
    'taunt-3': ('Ahh, hands like butter!', 'Aaa, hends layk batır!'),
    'taunt-4': ('Okay okay, one more.', 'Okey okey, van mor.'),
    'taunt-5': ('You are stubborn, I like this.', 'Yu ar stabırn. Ay layk dis.'),
    'taunt-6': ('This one is pistachio. Very fast flavor.', 'Dis van iz pistaşiyo. Veri fest fleyvır.'),
    'taunt-7': ('Kid, you blink too much.', 'Kid, yu blink tuu maç.'),
    'taunt-8': ('My grandmother catches faster!', 'May grendmadır keçiz festır!'),
    'lucky': ('WHAT?! Nobody does this!', 'Vaat?! Nobadi daz dis!'),
    'win-1': ('Ahh, good hands! Enjoy, kid.', 'Aaa, gud hends! Encoy, kid.'),
    'win-2': ('Okay, you earned it!', 'Okey, yu örnd it!'),
    'win-3': ('Respect, kid. Respect.', 'Rispekt, kid. Rispekt.'),
    'yield': ('Hahaha okay, okay. You win. Take, take.', 'Ha ha ha! Okey, okey. Yu vin. Teyk, teyk.'),
    'all-tasted': ('Ahh, you tasted everything. Now, the secret flavor...', 'Aaa, yu teystid evriting. Nav... dı sikrit fleyvır.'),
    'gift': ('This one is free, kid. Secret flavor.', 'Dis van iz fri, kid. Sikrit fleyvır.'),
    'cat': ('Ahh, you found Pamuk! Free double scoop for you, kid.', 'Aaa, yu faund Pamuk! Fri dabıl skup for yu, kid.'),
    'idle-1': ('Kid? You still there?', 'Kid? Yu stil der?'),
    'idle-2': ('Ice cream is melting, kid!', 'Ays krim iz melting, kid!'),
}

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
english = '--turkish' not in sys.argv
model = 'en_GB-northern_english_male-medium' if english else 'tr_TR-dfki-medium'
out_dir = os.path.join(ROOT, 'public', 'voice', 'vendor') if english else os.path.join(ROOT, 'assets-src', 'tts', 'turkish')
os.makedirs(out_dir, exist_ok=True)

voice = PiperVoice.load(os.path.join(ROOT, 'assets-src', 'tts', model + '.onnx'))
cfg = SynthesisConfig(length_scale=1.0 if english else 0.92, noise_scale=0.7, noise_w_scale=0.85)
TARGET_RMS = 0.11  # same loudness for every line

for key, (plain, accented) in LINES.items():
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        voice.synthesize_wav(plain if english else accented, wf, syn_config=cfg)
    buf.seek(0)
    with wave.open(buf, 'rb') as wf:
        rate = wf.getframerate()
        pcm = array.array('h', wf.readframes(wf.getnframes()))
    # trim silence at both ends, then match loudness without clipping
    thr = 300
    start = next((i for i, s in enumerate(pcm) if abs(s) > thr), 0)
    end = len(pcm) - next((i for i, s in enumerate(reversed(pcm)) if abs(s) > thr), 0)
    pcm = pcm[max(0, start - int(rate * 0.03)):min(len(pcm), end + int(rate * 0.08))]
    rms = math.sqrt(sum(s * s for s in pcm) / max(len(pcm), 1)) / 32768
    peak = max(abs(s) for s in pcm) / 32768
    gain = min(TARGET_RMS / max(rms, 1e-6), 0.95 / max(peak, 1e-6))
    pcm = array.array('h', (max(-32767, min(32767, int(s * gain))) for s in pcm))
    enc = lameenc.Encoder()
    enc.set_bit_rate(64)
    enc.set_in_sample_rate(rate)
    enc.set_channels(1)
    enc.set_quality(2)
    mp3 = enc.encode(pcm.tobytes()) + enc.flush()
    with open(os.path.join(out_dir, key + '.mp3'), 'wb') as f:
        f.write(mp3)
    print(f'{key:11s} {len(pcm) / rate:4.1f}s  {len(mp3) // 1024} KB')
