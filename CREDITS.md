# Credits

The code of Padel Punto is © 2026 Fat Toni and licensed under the [GNU General Public License v3.0 or later](LICENSE).
The score-call voices were made with third-party voices, listed below.

## Score-call voices

The words in `assets/default.s/voice/` and the app name in `assets/default.s/sound/padel_punto.mp3`
were spoken by offline AI voices that come without strings attached: none was trained on research-only or
non-commercial recordings, and the models are public domain or under permissive licenses.
No attribution is required; it is given here anyway, with thanks.
Changes: each word was synthesized several times, the take that speech recognition understood best was
kept, then silence was trimmed, the level evened out and raised, and the result saved as a small mono MP3
(`tools/voice.py`).

| Files | Voice | Recordings | Model |
|---|---|---|---|
| `voice/en/` | [Piper](https://github.com/rhasspy/piper) voice `en_US-bryce-medium` from [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices) | [Bryce Beattie](https://brycebeattie.com/files/tts/)'s own voice | public domain |
| `sound/padel_punto.mp3` (the app name in Spanish) | [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) voice `em_alex` | public-domain, permissively licensed and synthetic audio (see the model card) | Apache-2.0, by hexgrad |
