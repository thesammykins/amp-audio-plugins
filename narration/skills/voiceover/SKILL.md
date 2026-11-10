---
name: voiceover
description: Writes proof or marketing scripts for requested spoken voiceovers and selects built-in voices or project profiles. Use only when the user asks for narration, not ordinary replies, media inspection, or automatic recording processing.
license: MIT
---

# Voiceover

Write a speech-first script, then call `generate_narration`. The tool reads the script; it does not write or improve it. Do not generate speech unless the user asks for a voiceover or spoken narration.

## Choose the mode and write for speech

- **proof:** change → action → observed evidence → limitations, following the recording's order. Short, concrete sentences. Distinguish checked results from assumptions. No unsupported success claims, sales language, greetings, or outro padding. Default delivery is direct and plain, with a firm conversational pace and brief pauses; not soothing, warm, theatrical, or salesy. Default voice: **cedar**.
- **marketing:** start with a user problem or visible outcome. Demonstrate one benefit at a time with a concrete example. Vary sentence length. Invent no features, metrics, testimonials, or superlatives. Add a call to action only when requested. Default delivery is engaged and distinctive, with personality, varied rhythm, clear diction, and purposeful pauses; not forced excitement, hype, or an announcer voice. Default voice: **marin**.

For both: use words meant to be spoken, not Markdown. One idea per breath. Natural contractions and punctuation for pauses. Write numbers and abbreviations in the intended spoken form. Describe code and paths rather than spelling them out unless needed. Keep screen cues outside the spoken script. Put pronunciation hints in delivery instructions.

## Choose a project profile or a built-in voice

Read `.amp/voice-profiles.json` at the workspace root if present. Select a named profile and omit `mode`, `voice`, and `instructions` from the tool call. Each profile fixes those three fields. Optional `sample_script` is audition material, not an automatic production script. Unknown fields/profiles and one-off overrides are rejected before paid generation. Do not create or change a profile automatically.

Without a profile file, supply `mode`, optionally `voice` and `instructions`. Delivery instructions replace the mode's defaults, not the fixed script-reading rules; write a complete, non-conflicting delivery direction.

Available voices and suggested auditions:

- **alloy:** general-purpose comparison baseline.
- **ash:** compact, matter-of-fact technical updates.
- **ballad:** story-led introductions and longer marketing passages.
- **coral:** personable product demos and benefit-led marketing.
- **echo:** serious explainers with clear names and numbers.
- **sage:** step-by-step explanations and consistent everyday app narration.
- **shimmer:** short, lively launches and promotional clips.
- **verse:** expressive demos with changes in pace and emphasis.
- **marin:** general narration; marketing starting point.
- **cedar:** detailed walkthroughs; proof starting point.

These are editorial audition suggestions, not verified timbre guarantees. OpenAI recommends Marin and Cedar for quality. Profiles combine a built-in voice, instructions, and a mode; they are not custom voices and cannot guarantee identical performances.

## Generate and check

Use a new absolute `.wav` output path and at most 4,000 script characters. The tool uses only `gpt-realtime-2.1-mini` and the configured Platform key; each request incurs usage. Longer scripts need separately requested clips. No automatic retries or fallback models.

Review the returned generated-audio transcript against the script and listen when fidelity matters. It is the model's account of the speech, not independent verification. Do not automatically call transcription, assemble a video, or claim timing alignment. Disclose AI-generated speech to listeners.

## Sources

- [Realtime voices and lifecycle](https://developers.openai.com/api/docs/guides/realtime-conversations)
- [Realtime prompting: short labeled instructions, precise triggers, and resolving conflicts](https://developers.openai.com/api/docs/guides/voice-prompting)
