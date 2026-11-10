# Narration for Amp

One deferred tool, `generate_narration`, and one bundled skill, `narration:voiceover`. Creates **requested** proof or marketing voiceovers from prepared scripts. Uses **gpt-realtime-2.1-mini only**, via an authenticated, single-response Realtime WebSocket. No SDK, dependencies, microphone, background server, custom voices, fallback models, video overlay, or tuning portal.

## Install and configure

Put the whole `narration/` directory in your personal Amp plugin repository, commit and publish it, then reload plugins. For a project-only install, put it in `.amp/plugins/narration/`. It runs in Amp's Bun plugin runtime. Verify with `amp plugins list` and `amp skill info narration:voiceover`.

1. Create an OpenAI **Platform API key** with access to `gpt-realtime-2.1-mini` and API billing/credits.
2. In [Amp personal Secrets & Env Vars](https://ampcode.com/settings/environment-variables), add **OPENAI_PERSONAL**, mark it as a **Secret**, and enter the key privately. New orbs pick it up automatically. Refresh a running orb with `amp orb restart-processes`, then reload plugins in the thread.
3. To use a different name, add the ordinary environment variable **OPENAI_AUDIO_KEY_ENV=OPENAI_API_KEY**, and store the key as the secret **OPENAI_API_KEY** instead. This selects a variable name, not a second key or a fallback. The key is read at call time and is never a tool argument or logged.
4. Locally, start Amp with the chosen secret variable in its process environment, supplied by your shell's secret manager or secure environment injection. A local runner started with `amp --no-tui --amp-env` receives Amp Secrets & Env Vars for the threads it serves. Do not put the key in source, profiles, commands saved to shell history, or a thread.

ChatGPT billing and OpenAI Platform API billing are separate. A subscription alone is not proof of API credit; eligible subscriptions may have grants that require activation. Check your [Platform billing](https://platform.openai.com/settings/organization/billing/overview). See [OpenAI's billing guidance](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform) and [Amp secret handling](https://ampcode.com/docs/orbs/handling-secrets).

## Use

Ask Amp: “Make a proof-mode voiceover explaining what changed and the checks shown in this recording.” Amp loads `narration:voiceover`, prepares a spoken script, and calls:

```json
{
  "script": "I changed the validation. An empty title is now rejected. The existing entry is unchanged. This check covers the form, not the live service.",
  "output_path": "/absolute/output/proof.wav",
  "mode": "proof"
}
```

Only narrate observations that actually happened. Marketing scripts should demonstrate a benefit, not invent claims.

| Mode | Script | Default delivery | Default voice |
| --- | --- | --- | --- |
| `proof` | Change, action, observed evidence, limitations, in recording order. | Direct, plain, firm conversational pace; brief pauses. Not warm/soothing or salesy. | `cedar` |
| `marketing` | User problem or outcome, then concrete benefits; varied sentences. | Engaged, distinctive, clear, with personality. No forced hype. | `marin` |

Inputs: required `script` and `output_path`; `profile` when the project profile file exists; otherwise required `mode` and optional `voice`, `instructions`. Delivery instructions replace mode defaults, not the fixed reading rules. Unknown/conflicting inputs are rejected. The return JSON includes `output_path`, model, resolved mode/voice/profile, duration in seconds, the model's generated-audio transcript, and an AI-speech notice.

## Project voice profiles

Use one file at the **workspace root**, `.amp/voice-profiles.json`:

```json
{
  "product-proof": {
    "mode": "proof",
    "voice": "sage",
    "instructions": "Direct, plain delivery. Brief pauses between checks. Give technical names clear emphasis."
  },
  "product-marketing": {
    "mode": "marketing",
    "voice": "sage",
    "instructions": "Engaged and distinctive. Brisk, clear delivery. Emphasize the demonstrated benefit."
  }
}
```

Then call with `script`, `output_path`, and `profile: "product-proof"`. If this file exists, a named profile is required and `mode`/`voice`/`instructions` overrides are refused. Each entry requires those three fields; `sample_script` is an optional non-empty string reserved for future auditions and is never read aloud automatically. No inheritance, directory search, hidden merges, or automatic creation. Edit the profile to change its voice or delivery. Keep app-specific profiles in the project, not the distributed plugin.

Voices: `alloy`, `ash`, `ballad`, `coral`, `echo`, `sage`, `shimmer`, `verse`, `marin`, `cedar`. The skill lists suggested uses for each; those are audition suggestions, not verified timbre facts. OpenAI recommends Marin and Cedar for quality.

## Limits and failures

- New absolute WAV path only; missing parents are created. Existing files are refused **before a paid request**. Incomplete outputs are removed.
- PCM16, mono, 24 kHz. Up to **4,000 characters per call** (plugin limit), with a five-minute deadline/audio cap. No MP3 encoder or ffmpeg requirement.
- Cancellation closes the session. Network, API, incomplete-response, and empty-audio errors keep no output. No automatic retries: a failed connection may still have incurred usage. Errors report API codes, not server text that could expose key fragments.
- A successful response is not a guarantee of word-perfect reading. Compare the returned transcript and listen. Realtime delivery can vary. No timestamps, timing alignment, automatic transcription, or video editing. Disclose AI-generated speech to listeners.
- The live tuning portal is a separate future phase, not installed by this plugin.

Tests: `bun test narration` from the directory containing this plugin. They use local fakes, never your API key or paid API calls.

References: [model](https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini), [server WebSocket](https://developers.openai.com/api/docs/guides/voice-websockets?api=realtime), [audio lifecycle and voices](https://developers.openai.com/api/docs/guides/realtime-conversations), [voice prompting](https://developers.openai.com/api/docs/guides/voice-prompting), [tool definitions](https://developers.openai.com/api/docs/guides/function-calling#best-practices-for-defining-functions), [Amp plugins](https://ampcode.com/docs/customize/plugins). MIT licensed; see LICENSE.
