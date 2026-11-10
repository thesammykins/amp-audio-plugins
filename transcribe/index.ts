import type { PluginAPI } from '@ampcode/plugin'
import { readFile, stat } from 'node:fs/promises'
import { basename, extname, isAbsolute } from 'node:path'

export const description = 'Last-resort local file transcription with gpt-transcribe and a separately configured OpenAI Platform key.'

const MAX_BYTES = 25_000_000
const FORMATS = new Set(['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm'])

export default function (amp: PluginAPI) {
	amp.registerTool({
		name: 'transcribe',
		description: 'Last-resort transcription of a local audio or video file. Use only when the user needs a transcript and none can be obtained from existing captions or subtitles, YouTube transcripts, transcript files, or Amp’s native tools. Do not use for dictation, general media inspection, summaries, or automatic processing of recordings. Sends the file to OpenAI using the configured secret and incurs API usage. Uses gpt-transcribe and returns unedited transcript JSON; exact verbatim fidelity is not guaranteed. Maximum upload: 25 MB. No automatic retry or model fallback.',
		inputSchema: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'Absolute local audio/video file path.' },
				language: { type: 'string', minLength: 1, description: 'Language hint, for example en. Omit for detection. Sent as languages[].' },
				prompt: { type: 'string', minLength: 1, description: 'Vocabulary or recording context passed to the transcription API.' },
			},
			required: ['path'],
			additionalProperties: false,
		},
		async execute(input, ctx) {
			const keyEnv = process.env.OPENAI_AUDIO_KEY_ENV ?? 'OPENAI_PERSONAL'
			if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(keyEnv)) throw new Error('OPENAI_AUDIO_KEY_ENV must name an environment variable, not contain a key.')
			const key = process.env[keyEnv]?.trim()
			if (!key) throw new Error(`${keyEnv} is not set. Store your OpenAI Platform key as a personal Amp secret at https://ampcode.com/settings/environment-variables, then run amp orb restart-processes. Locally, supply it in Amp’s environment. OPENAI_AUDIO_KEY_ENV selects another variable name. No request or fallback was made.`)
			if (Object.keys(input).some(field => !['path', 'language', 'prompt'].includes(field))) throw new Error('Allowed inputs: path, language, prompt. Timestamps are not supported.')
			if (typeof input.path !== 'string' || !isAbsolute(input.path)) throw new Error('path must be an absolute local audio/video file path.')
			for (const field of ['language', 'prompt']) {
				if (input[field] !== undefined && (typeof input[field] !== 'string' || !input[field].trim())) throw new Error(`${field} must be a non-empty string when supplied.`)
			}
			ctx.signal.throwIfAborted()
			const info = await stat(input.path)
			if (!info.isFile() || info.size === 0) throw new Error('path must point to a non-empty regular file.')
			if (info.size > MAX_BYTES) throw new Error('File exceeds the 25 MB (25,000,000 bytes) upload limit. Extract/compress the audio or split it at sentence boundaries into files under the limit, then transcribe the parts. Nothing was uploaded; no automatic splitting or transcoding.')
			if (!FORMATS.has(extname(input.path).toLowerCase())) throw new Error('Unsupported format. Use mp3, mp4, mpeg, mpga, m4a, wav, or webm; convert other recordings first.')
			const bytes = await readFile(input.path)
			if (bytes.length > MAX_BYTES) throw new Error('File grew beyond the 25 MB upload limit. Stop recording and compress or split it before retrying. Nothing was uploaded.')
			const form = new FormData()
			form.set('file', new Blob([bytes]), basename(input.path))
			form.set('model', 'gpt-transcribe')
			form.set('response_format', 'json')
			if (input.language) form.append('languages[]', String(input.language))
			if (input.prompt) form.set('prompt', String(input.prompt))
			const signal = AbortSignal.any([ctx.signal, AbortSignal.timeout(300_000)])
			try {
				signal.throwIfAborted()
				const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
					method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal, redirect: 'error',
				})
				if (!response.ok) {
					// Do not echo server messages: authentication errors can contain key fragments.
					const body = await response.json().catch(() => ({}))
					const code = String(body?.error?.code ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)
					throw new Error(`OpenAI transcription failed (HTTP ${response.status}${code ? `, code ${code}` : ''}). Check the Platform key, gpt-transcribe access, billing/quota, and file validity. No automatic retry or fallback was made.`)
				}
				const transcript = await response.json()
				if (typeof transcript?.text !== 'string') throw new Error('OpenAI returned no transcript text. No automatic retry was made.')
				return JSON.stringify({ model: 'gpt-transcribe', warning: 'Unedited OpenAI transcript; speech recognition may normalize wording or numbers. Not guaranteed verbatim.', transcript })
			} catch (error) {
				if (error instanceof Error && error.message.startsWith('OpenAI ')) throw error
				throw new Error('OpenAI transcription connection failed, timed out, or was cancelled. The request may have been processed; no automatic retry or fallback was made.')
			}
		},
	})
}
