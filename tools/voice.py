# Speaks every word of the score announcement (always English, see utils/voice.js) with an offline
# AI voice and writes assets/default.s/voice/en/<word>.mp3, trimmed, evened out and loud, as small mono MP3s,
# plus the app name in Spanish for the sound test on the diagnosis page (sound/padel_punto.mp3).
# The word keys must match WORDS in utils/voice.js (test/strings.test.mjs checks the files).
#
# Only voices without strings attached (see CREDITS.md): not trained on research-only or non-commercial
# recordings, with a public-domain or permissive model license. Most Piper voices are fine-tuned
# from "lessac", whose recordings are licensed for research only, so they are not used.
#
# Every word is spoken several times; Whisper picks the take it understands best through a
# small-speaker filter, like on the watch.
#
# Needs ffmpeg and a virtual environment with Piper, Kokoro and Whisper (transformers):
#   python3 -m venv ~/.cache/padelpunto/tts
#   ~/.cache/padelpunto/tts/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
#   ~/.cache/padelpunto/tts/bin/pip install piper-tts kokoro "misaki[en]" transformers
#   cd <voices dir> && ~/.cache/padelpunto/tts/bin/python -m piper.download_voices en_US-bryce-medium
# (Kokoro and Whisper download their models themselves on first use.)
# Usage: ~/.cache/padelpunto/tts/bin/python tools/voice.py <voices dir> assets/default.s [--only-sound]
import os
import re
import shutil
import subprocess
import sys
import tempfile
import wave

import numpy as np
import soundfile
import torch

# Bryce Beattie's own recordings, Piper voice released into the public domain. German (Thorsten,
# Coqui) and Spanish voices were tried too; the score call is English only, the padel standard.
VOICE = 'en_US-bryce-medium'
# The app name in Kokoro's Spanish voice (Kokoro-82M, Apache-2.0); its Spanish words were too unclear
# for a score call, but the name alone is fine.
NAME = ('em_alex', 'es', 'Padel Punto')
TAKES = 6  # per end mark ("." and "!")

WORDS = {'p0': 'love', 'p15': 'fifteen', 'p30': 'thirty', 'p40': 'forty', 'all': 'all', 'deuce': 'deuce',
         'advIn': 'advantage server', 'advOut': 'advantage receiver', 'golden': 'golden point',
         'star': 'star point',
         # 'won' after the team color: "Green – wins"
         'won': 'wins', 'c_green': 'Green', 'c_blue': 'Blue', 'c_orange': 'Orange', 'c_pink': 'Pink',
         'c_purple': 'Purple', 'c_red': 'Red', 'c_cyan': 'Turquoise', 'c_white': 'White'}
WORDS.update({f'n{i}': n for i, n in enumerate('zero one two three four five six seven eight nine ten eleven twelve '
                                               'thirteen fourteen fifteen sixteen seventeen eighteen nineteen '
                                               'twenty'.split())})

# Cut the silence at both ends, then even out and raise the level without clipping.
FILTER = ('silenceremove=start_periods=1:start_threshold=-45dB,areverse,'
          'silenceremove=start_periods=1:start_threshold=-45dB,areverse,'
          'acompressor=threshold=-20dB:ratio=4:makeup=8,alimiter=limit=0.89')

voices, out = sys.argv[1:3]


def piper(voice):
    """Returns speak(text, wav) for a Piper voice."""
    from piper import PiperVoice
    v = PiperVoice.load(os.path.join(voices, voice + '.onnx'))

    def speak(text, wav):
        with wave.open(wav, 'wb') as f:
            v.synthesize_wav(text, f)
    return speak


def kokoro(voice):
    """Returns speak(text, wav) for a Kokoro voice (the first letter of its name is the language)."""
    from kokoro import KPipeline
    v = KPipeline(lang_code=voice[0], repo_id='hexgrad/Kokoro-82M')

    def speak(text, wav):
        soundfile.write(wav, np.concatenate([a for _, _, a in v(text, voice=voice)]), 24000)
    return speak


def mp3(wav, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', wav, '-af', FILTER, '-ac', '1', '-ar', '22050',
                    '-c:a', 'libmp3lame', '-b:a', '32k', path], check=True)


class Judge:
    """How sure Whisper is that a clip says a word (mean negative log-likelihood, lower is better)."""

    def __init__(self, name='openai/whisper-small', seconds=6):
        from transformers import WhisperForConditionalGeneration, WhisperProcessor
        self.p = WhisperProcessor.from_pretrained(name)
        self.m = WhisperForConditionalGeneration.from_pretrained(name).eval()
        # A short audio window (like whisper.cpp's audio_ctx): the clips are short, 30 s would be 5x slower.
        enc = self.m.model.encoder
        enc.embed_positions = torch.nn.Embedding.from_pretrained(enc.embed_positions.weight[:seconds * 50], True)
        self.m.config.max_source_positions = seconds * 50
        self.frames = seconds * 100

    @torch.no_grad()
    def __call__(self, lang, path, texts):
        # high- and low-pass: roughly the tiny watch speaker; a short lead-in, as Whisper mishears a
        # clip that starts right on the first sound
        pcm = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-af',
                              'adelay=300:all=1,highpass=f=500,lowpass=f=4000',
                              '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True, check=True).stdout
        audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
        feats = self.p(audio, sampling_rate=16000, return_tensors='pt').input_features[..., :self.frames]
        enc = self.m.model.encoder(feats).last_hidden_state
        tok = self.p.tokenizer
        prefix = tok.convert_tokens_to_ids(['<|startoftranscript|>', f'<|{lang}|>', '<|transcribe|>',
                                            '<|notimestamps|>'])
        best = 99.0
        for text in texts:
            ids = prefix + tok.encode(' ' + text, add_special_tokens=False) + [tok.eos_token_id]
            lp = torch.log_softmax(self.m(encoder_outputs=(enc,), decoder_input_ids=torch.tensor([ids[:-1]])).logits[0], -1)
            target = ids[len(prefix):]
            best = min(best, -sum(lp[len(prefix) - 1 + i, t].item() for i, t in enumerate(target)) / len(target))
        return best


def accepted(key, text):
    """What Whisper may write for the word: as it is, capitalized, or in digits."""
    texts = [text, text.capitalize(), text.title()]
    m = re.fullmatch(r'n(\d+)', key)
    if m:
        texts.append(m.group(1))
    if key in ('p0', 'p15', 'p30', 'p40') and text != 'love':
        texts.append(key[1:])
    return texts


def best_take(speak, judge, lang, key, text, spellings, path, tmp):
    takes = []
    for i, spoken in enumerate([text] + spellings):
        for end in '.!':
            for j in range(TAKES):
                wav = os.path.join(tmp, f'{i}{end}{j}.wav')
                speak(spoken + end, wav)
                mp3(wav, wav[:-4] + '.mp3')
                takes.append((judge(lang, wav[:-4] + '.mp3', accepted(key, text)), wav[:-4] + '.mp3'))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    shutil.copy(min(takes)[1], path)


with tempfile.TemporaryDirectory() as tmp:
    voice, lang, text = NAME
    # only a few takes: the full 30 s window judges them more reliably
    best_take(kokoro(voice), Judge(seconds=30), lang, 'name', text, ['¡Pádel Punto'],
              os.path.join(out, 'sound', 'padel_punto.mp3'), tmp)
    if '--only-sound' in sys.argv:
        sys.exit()
    speak, judge = piper(VOICE), Judge()
    for key, text in WORDS.items():
        best_take(speak, judge, 'en', key, text, [], os.path.join(out, 'voice', 'en', key + '.mp3'), tmp)
    print(len(WORDS), 'words')
