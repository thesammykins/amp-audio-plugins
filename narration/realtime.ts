import { readingInstructions, type Delivery } from './profiles'

export const MODEL = 'gpt-realtime-2.1-mini'

// One session, one explicit response. No microphone, tools, retries, or fallback model.
export async function synthesize(script: string, delivery: Delivery, key: string, signal: AbortSignal): Promise<{ wav: Buffer; duration: number; transcript: string }> {
	signal.throwIfAborted()
	return new Promise((resolve, reject) => {
		let socket: WebSocket
		let settled = false
		const chunks: Buffer[] = []
		let audioBytes = 0
		let requested = false
		const fail = (message: string) => finish(new Error(`${message} No output file was kept; no automatic retry or fallback was made.`))
		const abort = () => fail('OpenAI narration was cancelled or exceeded the five-minute deadline. The request may have been processed.')
		function finish(error?: Error, result?: { wav: Buffer; duration: number; transcript: string }) {
			if (settled) return
			settled = true
			signal.removeEventListener('abort', abort)
			socket?.close()
			if (error) reject(error)
			else resolve(result!)
		}
		try {
			socket = new WebSocket(`wss://api.openai.com/v1/realtime?model=${MODEL}`, { headers: { Authorization: `Bearer ${key}` } })
		} catch {
			fail('Could not open the OpenAI Realtime WebSocket. This plugin requires Amp’s Bun runtime with authenticated WebSocket support.')
			return
		}
		signal.addEventListener('abort', abort, { once: true })
		if (signal.aborted) { abort(); return }
		socket.onopen = () => {
			if (settled) return
			socket.send(JSON.stringify({
				type: 'session.update',
				session: {
					type: 'realtime', model: MODEL, output_modalities: ['audio'],
					instructions: readingInstructions(delivery), tools: [],
					audio: { input: { turn_detection: null }, output: { format: { type: 'audio/pcm', rate: 24000 }, voice: delivery.voice } },
				},
			}))
		}
		socket.onmessage = message => {
			if (settled) return
			try {
				const event = JSON.parse(String(message.data))
				if (event.type === 'session.updated' && !requested) {
					requested = true
					socket.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: script }] } }))
					socket.send(JSON.stringify({ type: 'response.create' }))
				} else if (event.type === 'response.output_audio.delta') {
					const bytes = Buffer.from(event.delta, 'base64')
					audioBytes += bytes.length
					// Bound memory even if the service ignores the short-script instruction.
					if (audioBytes > 48_000 * 300) { fail('OpenAI returned more than five minutes of audio.'); return }
					chunks.push(bytes)
				} else if (event.type === 'error') {
					// Never echo server messages; authentication errors can contain key fragments.
					const code = String(event.error?.code ?? event.error?.type ?? 'unknown').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)
					const param = String(event.error?.param ?? '').replace(/[^a-zA-Z0-9_.\[\]-]/g, '').slice(0, 80)
					fail(`OpenAI Realtime error (${code}${param ? `, parameter ${param}` : ''}). Check the Platform key, ${MODEL} access, billing/quota, and request settings.`)
				} else if (event.type === 'response.done') {
					if (event.response?.status !== 'completed') {
						const code = String(event.response?.status_details?.error?.code ?? event.response?.status_details?.reason ?? event.response?.status ?? 'unknown').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)
						fail(`OpenAI narration did not complete (${code}).`)
						return
					}
					if (!audioBytes || audioBytes % 2) { fail('OpenAI returned empty or incomplete PCM16 audio.'); return }
					const transcript = (event.response.output ?? []).flatMap((item: { content?: { type: string; transcript?: string }[] }) => (item.content ?? []).filter(part => part.type === 'output_audio').map(part => part.transcript ?? '')).join('\n')
					const header = Buffer.alloc(44)
					header.write('RIFF', 0); header.writeUInt32LE(36 + audioBytes, 4); header.write('WAVEfmt ', 8)
					header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22)
					header.writeUInt32LE(24000, 24); header.writeUInt32LE(48000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34)
					header.write('data', 36); header.writeUInt32LE(audioBytes, 40)
					finish(undefined, { wav: Buffer.concat([header, ...chunks]), duration: audioBytes / 48000, transcript })
				}
			} catch {
				fail('OpenAI returned an unreadable Realtime event or the connection closed while sending.')
			}
		}
		socket.onerror = () => fail(`OpenAI Realtime WebSocket connection failed. Check network access, the Platform key, ${MODEL} access, and API billing. The request may have been processed.`)
		socket.onclose = () => { if (!settled) fail('OpenAI closed the Realtime connection before response.done completed.') }
	})
}
