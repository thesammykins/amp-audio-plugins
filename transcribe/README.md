# Transcribe for Amp

One deferred tool, `transcribe`, using **gpt-transcribe only**. This is a **last resort** for a requested transcript when captions, subtitles, YouTube transcripts, transcript files, and Amp's native tools cannot provide it. Not dictation, summaries, generic media inspection, or automatic recording processing. No dependencies or model fallback.

## Install and configure

Put the whole `transcribe/` directory in your personal Amp plugin repository, commit and publish it, then reload plugins. For a project-only install, put it in `.amp/plugins/transcribe/`. Verify with `amp plugins list`.

1. Create an OpenAI **Platform API key** with `gpt-transcribe` access and API billing/credits.
2. In [Amp personal Secrets & Env Vars](https://ampcode.com/settings/environment-variables), add **OPENAI_PERSONAL**, mark it as a **Secret**, and enter the key privately. New orbs receive it automatically. For a running orb, run `amp orb restart-processes`, then reload plugins in the thread.
3. Override the name with the ordinary environment variable **OPENAI_AUDIO_KEY_ENV=OPENAI_API_KEY**, then store the key as the secret **OPENAI_API_KEY**. This selects a variable name, not a fallback. No key-valued tool argument; no key logging.
4. Locally, supply the chosen secret variable in Amp's process environment using your shell's secret manager or secure injection. For local served runner threads, `amp --no-tui --amp-env` injects Amp Secrets & Env Vars. Do not paste keys into threads, source, or saved shell commands.

ChatGPT and Platform API billing are separate; a ChatGPT subscription does not itself establish API access/credit. Eligible subscription grants may need activation. Check [Platform billing](https://platform.openai.com/settings/organization/billing/overview), [OpenAI's billing guidance](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform), and [Amp secret handling](https://ampcode.com/docs/orbs/handling-secrets).

## Use

Ask Amp: “I need the transcript of this local recording. No captions, transcript file, or native transcript are available; use transcribe.”

```json
{
  "path": "/absolute/input/recording.wav",
  "language": "en",
  "prompt": "A technical walkthrough."
}
```

Required: `path`, an absolute local audio/video file. Optional: `language`, a non-empty hint such as `en` (sent as `languages[]`), and `prompt`, recording context/vocabulary. Omit the language hint for detection. The tool uploads once to `POST /v1/audio/transcriptions` and returns the model, fidelity warning, and **unchanged API transcript JSON**. There is no text-model rewriting pass.

## Limits and failures

- At most **25,000,000 bytes**. Supported: `mp3`, `mp4`, `mpeg`, `mpga`, `m4a`, `wav`, `webm`. Non-files, empty files, unsupported formats, and unknown inputs are rejected.
- Oversize files get a compression/splitting error **before upload**. Compress/extract audio or split at sentence boundaries before another call. No automatic splitting/transcoding.
- No timestamps: the current guide restricts word/segment timestamps to deprecated Whisper, which this plugin does not use. No translation or speaker-labeling option.
- “Unedited” is not “guaranteed verbatim”: recognition can still normalize numbers/wording. Use existing transcripts first and review important text against the audio.
- Five-minute deadline; cancellation stops the request. No automatic retries or fallback, including Amp media fallback. A failed connection may still have incurred usage. Errors report HTTP status/API codes without echoing key fragments from server messages.

Tests: `bun test transcribe` from the directory containing this plugin. They use local fakes, never your API key or paid API calls.

References: [current file transcription guide](https://developers.openai.com/api/docs/guides/speech-to-text), [tool definition guidance](https://developers.openai.com/api/docs/guides/function-calling#best-practices-for-defining-functions), [Amp plugins](https://ampcode.com/docs/customize/plugins). MIT licensed; see LICENSE.
