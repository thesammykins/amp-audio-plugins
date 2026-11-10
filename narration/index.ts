import type { PluginAPI } from '@ampcode/plugin'
import { mkdir, open, rm } from 'node:fs/promises'
import { dirname, extname, isAbsolute } from 'node:path'
import { resolveDelivery, VOICES } from './profiles'
import { MODEL, synthesize } from './realtime'

export const description = 'Requested proof or marketing voiceovers using gpt-realtime-2.1-mini, built-in voices, and project voice profiles.'

export default async function (amp: PluginAPI) {
	await amp.registerSkill({ path: 'skills/voiceover' })
	amp.registerTool({
		name: 'generate_narration',
		description: 'Create a voiceover file only when the user asks for spoken narration or a voiceover. Load narration:voiceover first to write a script for proof or marketing. Do not narrate ordinary replies, read media, or automatically add speech to recordings. Supply a prepared script and a new WAV output path. In projects with voice profiles, select a profile; otherwise select a mode and optionally a built-in voice and delivery instructions. Uses only gpt-realtime-2.1-mini, sends the script to OpenAI, and incurs API usage. Returns the saved path and generated-audio transcript. Never overwrites files, automatically retries, or falls back to another model. Tell listeners the speech is AI-generated.',
		inputSchema: {
			type: 'object',
			properties: {
				script: { type: 'string', minLength: 1, maxLength: 4000, description: 'Exact words to speak. Plugin limit: 4,000 characters per call.' },
				output_path: { type: 'string', description: 'New absolute .wav file path. Missing parent directories are created; existing files are refused before generation.' },
				profile: { type: 'string', minLength: 1, description: 'Required when .amp/voice-profiles.json exists at the workspace root. Fixes mode, voice, and instructions; omit their overrides.' },
				mode: { type: 'string', enum: ['proof', 'marketing'], description: 'Required without a profile file. Proof: direct evidence walkthrough. Marketing: benefit-led demo.' },
				voice: { type: 'string', enum: [...VOICES], description: 'Only without profiles. Default cedar for proof, marin for marketing.' },
				instructions: { type: 'string', minLength: 1, description: 'Only without profiles. Delivery, accent, pacing, or pronunciation. Replaces mode delivery defaults, not the fixed reading rules.' },
			},
			required: ['script', 'output_path'],
			additionalProperties: false,
		},
		async execute(input, ctx) {
			const keyEnv = process.env.OPENAI_AUDIO_KEY_ENV ?? 'OPENAI_PERSONAL'
			if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(keyEnv)) throw new Error('OPENAI_AUDIO_KEY_ENV must name an environment variable, not contain a key.')
			const key = process.env[keyEnv]?.trim()
			if (!key) throw new Error(`${keyEnv} is not set. Store your OpenAI Platform key as a personal Amp secret at https://ampcode.com/settings/environment-variables, then run amp orb restart-processes. Locally, supply it in Amp’s environment. OPENAI_AUDIO_KEY_ENV selects another variable name. No request was made.`)
			if (Object.keys(input).some(field => !['script', 'output_path', 'profile', 'mode', 'voice', 'instructions'].includes(field))) throw new Error('Allowed inputs: script, output_path, profile, mode, voice, instructions.')
			if (typeof input.script !== 'string' || !input.script.trim() || input.script.length > 4000) throw new Error('script must contain 1–4,000 characters. Split longer scripts into separate calls.')
			if (typeof input.output_path !== 'string' || !isAbsolute(input.output_path) || extname(input.output_path).toLowerCase() !== '.wav') throw new Error('output_path must be a new absolute .wav file path.')
			const root = amp.system.workspaceRoot ? amp.helpers.filePathFromURI(amp.system.workspaceRoot) : null
			const delivery = await resolveDelivery(input, root)
			ctx.signal.throwIfAborted()
			await mkdir(dirname(input.output_path), { recursive: true })
			// Exclusive reservation prevents overwrite races, before spending on generation.
			const output = await open(input.output_path, 'wx', 0o600).catch(error => {
				if (error.code === 'EEXIST') throw new Error('output_path already exists. Choose a new file; no request was made.')
				throw error
			})
			let complete = false
			try {
				const signal = AbortSignal.any([ctx.signal, AbortSignal.timeout(300_000)])
				const audio = await synthesize(input.script, delivery, key, signal)
				signal.throwIfAborted()
				await output.writeFile(audio.wav)
				signal.throwIfAborted()
				complete = true
				return JSON.stringify({ output_path: input.output_path, model: MODEL, mode: delivery.mode, voice: delivery.voice, ...(delivery.profile ? { profile: delivery.profile } : {}), duration_seconds: audio.duration, transcript: audio.transcript, disclosure: 'AI-generated speech. Review the audio and generated transcript; word-perfect reading is not guaranteed.' })
			} finally {
				await output.close()
				if (!complete) await rm(input.output_path, { force: true })
			}
		},
	})
}
