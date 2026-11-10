# Audio plugins for Amp

Two small, dependency-free [Amp plugins](https://ampcode.com/docs/customize/plugins) that call OpenAI directly with your own Platform API key. They fill gaps, not replace Amp's everyday media tools.

| Plugin | Tool | Use it for |
| --- | --- | --- |
| [Transcribe](transcribe/README.md) | `transcribe(path, language?, prompt?)` | A requested transcript of a local audio/video file, **only after** captions, subtitles, transcript files, YouTube transcripts, and Amp's native tools cannot provide it. Uses `gpt-transcribe`. |
| [Narration](narration/README.md) | `generate_narration(script, output_path, profile?, mode?, voice?, instructions?)` | A **requested voiceover** from a prepared script. Uses only `gpt-realtime-2.1-mini` and includes the `narration:voiceover` script-writing skill. |

Neither tool runs automatically. Transcription is not dictation or general media inspection; narration is not for ordinary replies or automatically processing recordings. Requests send the file or script to OpenAI and incur API usage.

## Install in Amp

These are **directory plugins**. Keep each whole directory, including the narration skill and supporting TypeScript files. `amp plugins add <url>` installs single-file plugins, not these directory bundles.

**Personal installation, available across your Amp environments:** ask Amp:

```text
Review the narration/ and transcribe/ plugins in https://github.com/thesammykins/amp-audio-plugins. Install both whole directories into my personal Amp plugin repository, commit and publish them there, then reload plugins. Do not install them workspace-wide.
```

Amp can locate your personal repository with `amp plugins repositories` and clone it with `amp clone user-plugins`. A commit and push to that repository publishes the plugins. Existing plugins with these names should be reviewed before replacement.

**Project-only installation:** run this POSIX-shell block from the project root. It refuses to replace existing project plugins:

```sh
(
  set -eu
  test ! -e .amp/plugins/narration
  test ! -e .amp/plugins/transcribe
  source_dir="$(mktemp -d)"
  trap 'rm -rf "$source_dir"' EXIT
  git clone https://github.com/thesammykins/amp-audio-plugins.git "$source_dir"
  mkdir -p .amp/plugins
  cp -R "$source_dir/narration" "$source_dir/transcribe" .amp/plugins/
  amp plugins list
  amp skill info narration:voiceover
)
```

In an existing thread, ask Amp to reload plugins or run `plugins: reload` in its command palette. `amp plugins list` checks loading in its own command; it does not reload a running thread. Project plugins take precedence over same-name personal plugins. Commit project-installed directories if they should persist with the project. Installing narration registers its skill; do not install that skill separately.

## Set up your key

1. Create an OpenAI **Platform API key**, with model access and API billing/credits. ChatGPT and Platform API billing are separate; a ChatGPT subscription does not automatically pay for these requests. Check [OpenAI's billing guidance](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform) and your [Platform billing](https://platform.openai.com/settings/organization/billing/overview). Any eligible promotional API grant may require activation.
2. In [Amp personal Secrets & Env Vars](https://ampcode.com/settings/environment-variables), add **`OPENAI_PERSONAL`**, mark it as a **Secret**, and enter the key privately. New orbs receive it. For an orb already running, run `amp orb restart-processes`, then reload plugins.
3. To use another variable name, set the ordinary Amp environment variable **`OPENAI_AUDIO_KEY_ENV=OPENAI_API_KEY`** and store your key as the secret **`OPENAI_API_KEY`** instead. The override names one variable; it is not a key or a fallback.
4. Locally, inject the selected secret variable into the process environment before starting Amp, using your secret manager or secure shell integration. For threads served by a local runner, `amp --no-tui --amp-env` injects your configured Amp Secrets & Env Vars. See [Amp secret handling](https://ampcode.com/docs/orbs/handling-secrets).

Keys are read at tool-call time, never accepted as tool arguments or logged. Missing keys fail clearly before a network request. Never put a key in source, a profile, a thread, or a command saved to shell history.

## Narration modes and voices

Ask for a proof or marketing voiceover. Amp loads `narration:voiceover`, writes a speech-first script, and calls `generate_narration` with a **new absolute `.wav` path**.

| Mode | Script style | Default delivery and voice |
| --- | --- | --- |
| `proof` | What changed → action → observed evidence → limitations, following the recording. Short, concrete sentences; no invented results. | Direct and plain, firm conversational pace, brief pauses. Not warm, soothing, or salesy. **Cedar**. |
| `marketing` | User problem or outcome → demonstrated benefits, one concrete example at a time. Varied sentences; no invented claims. | Engaged, distinctive, clear, with personality but no forced hype. **Marin**. |

Built-in voices: **alloy, ash, ballad, coral, echo, sage, shimmer, verse, marin, cedar**. OpenAI recommends Marin and Cedar for quality. The bundled [voiceover skill](narration/skills/voiceover/SKILL.md) offers audition suggestions for all ten; these are suggested uses, not guaranteed vocal characteristics. Without profiles, pass `mode` and optionally `voice` and `instructions`. Instructions replace the mode's delivery defaults, not the fixed script-reading rules.

## Project voice profiles

Copy [voice-profiles.json](voice-profiles.json) to **`.amp/voice-profiles.json` at your project's workspace root**, then edit its generic names and settings. Each profile fixes a mode, built-in voice, and delivery instructions. There are no custom voices or dependencies.

When that file exists, select a profile instead of supplying one-off mode, voice, or instruction overrides:

```json
{
  "script": "The form now rejects an empty title. The existing entry is unchanged. This check covers the form, not the live service.",
  "output_path": "/absolute/output/proof.wav",
  "profile": "product-proof"
}
```

`mode`, `voice`, and `instructions` are required in each profile. Optional `sample_script` stores audition material; it is never spoken automatically. The plugin does not discover profiles in parent directories, merge settings, create profiles, or silently override them. Keep real app-specific profiles in your project, not in this distribution.

## Limits

- **Transcribe:** at most **25,000,000 bytes** per file; mp3, mp4, mpeg, mpga, m4a, wav, or webm. Larger files fail before upload with compression/splitting guidance. No automatic splitting, timestamps, translation, or speaker-labeling options. Returned transcript JSON is unedited, but recognition may normalize words or numbers: **not guaranteed verbatim**.
- **Narration:** at most **4,000 script characters**, a five-minute deadline/audio cap, and mono 24 kHz PCM16 WAV output. New absolute output paths only; existing files are refused before generation. Review the returned transcript and listen: a successful Realtime response is **not a word-perfect reading guarantee**. Disclose AI-generated speech to listeners.
- **Both:** no automatic retry, alternative model, SDK, runtime package install, or fallback to Amp media tools. Failed requests may still incur API charges. Errors omit raw API messages that might contain key fragments. API/model availability and account access remain OpenAI requirements.
- No video overlay, timing alignment, tuning portal, live microphone, or background server. Profiles use built-in voices plus instructions only.

## Checks and source

From a checkout, with [Bun](https://bun.sh) installed:

```sh
bun test ./transcribe ./narration
```

The tests use local fakes, not your credentials or paid requests. They cover key selection and missing-key errors, upload limits, unchanged transcripts, mode/profile rules, ordered WAV output, no-overwrite behavior, and cleanup after failed or cancelled generation. Amp supplies the plugin runtime; no dependency install is needed.

The plugin READMEs link the OpenAI model, API, and prompting guidance used. This repository distributes generic source, tests, documentation, and a sample profile only—not recordings, keys, or real project profiles. [MIT licensed](LICENSE).
