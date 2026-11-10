import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'
import type { PluginAPI, PluginToolContext, PluginToolDefinition } from '@ampcode/plugin'
import { mkdtemp, open, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import plugin from './index'

const saved = { key: process.env.OPENAI_PERSONAL, override: process.env.OPENAI_AUDIO_KEY_ENV, testKey: process.env.AUDIO_TEST_KEY }
let directory: string
let tool: PluginToolDefinition
let network: ReturnType<typeof spyOn>
const ctx = { signal: new AbortController().signal } as PluginToolContext

beforeEach(async () => {
	directory = await mkdtemp(join(tmpdir(), 'transcribe-test-'))
	process.env.OPENAI_PERSONAL = 'test-only-not-a-real-api-key'
	delete process.env.OPENAI_AUDIO_KEY_ENV
	plugin({ registerTool: definition => { tool = definition } } as PluginAPI)
	// No test may use the real network or credentials.
	network = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network request'))
})

afterEach(async () => {
	network.mockRestore()
	for (const [field, value] of Object.entries({ OPENAI_PERSONAL: saved.key, OPENAI_AUDIO_KEY_ENV: saved.override, AUDIO_TEST_KEY: saved.testKey })) {
		if (value === undefined) delete process.env[field]
		else process.env[field] = value
	}
	await rm(directory, { recursive: true, force: true })
})

test('missing key and a selected missing key fail clearly, without silently using another key', async () => {
	delete process.env.OPENAI_PERSONAL
	await expect(tool.execute({ path: join(directory, 'audio.wav') }, ctx)).rejects.toThrow('OPENAI_PERSONAL is not set')
	process.env.OPENAI_PERSONAL = 'test-only-not-a-real-api-key'
	process.env.OPENAI_AUDIO_KEY_ENV = 'AUDIO_TEST_KEY'
	delete process.env.AUDIO_TEST_KEY
	await expect(tool.execute({ path: join(directory, 'audio.wav') }, ctx)).rejects.toThrow('AUDIO_TEST_KEY is not set')
	expect(network).not.toHaveBeenCalled()
})

test('uploads context with the chosen key and returns the complete original transcript unchanged', async () => {
	const path = join(directory, 'audio.wav')
	await writeFile(path, 'fixture')
	process.env.OPENAI_AUDIO_KEY_ENV = 'AUDIO_TEST_KEY'
	process.env.AUDIO_TEST_KEY = 'test-only-alternate-key'
	const original = { text: 'Uh, forty seven dollars — not $48.\nLeave this line. ', languages: [{ code: 'en' }], extra: { preserved: true } }
	network.mockImplementation(async (url, request) => {
		expect(url).toBe('https://api.openai.com/v1/audio/transcriptions')
		expect(request.headers.Authorization).toBe('Bearer test-only-alternate-key')
		expect(request.body.get('model')).toBe('gpt-transcribe')
		expect(request.body.getAll('languages[]')).toEqual(['en'])
		expect(request.body.has('language')).toBe(false)
		expect(request.body.get('prompt')).toBe('Technical vocabulary')
		expect(await request.body.get('file').text()).toBe('fixture')
		return Response.json(original)
	})
	const result = JSON.parse(await tool.execute({ path, language: 'en', prompt: 'Technical vocabulary' }, ctx) as string)
	expect(result.transcript).toEqual(original)
	expect(result.model).toBe('gpt-transcribe')
	expect(result.warning).toContain('Not guaranteed verbatim')
})

test('accepts exactly 25,000,000 bytes and rejects one byte more before upload', async () => {
	const path = join(directory, 'boundary.mp4')
	const file = await open(path, 'w')
	try { await file.truncate(25_000_000) } finally { await file.close() }
	network.mockImplementation(async (_url, request) => {
		expect(request.body.get('file').size).toBe(25_000_000)
		return Response.json({ text: 'At the boundary.' })
	})
	await tool.execute({ path }, ctx)
	const larger = await open(path, 'r+')
	try { await larger.truncate(25_000_001) } finally { await larger.close() }
	await expect(tool.execute({ path }, ctx)).rejects.toThrow('Nothing was uploaded')
	expect(network).toHaveBeenCalledTimes(1)
})

test('rejects invalid local inputs before upload', async () => {
	const empty = join(directory, 'empty.wav')
	const unsupported = join(directory, 'audio.flac')
	await writeFile(empty, '')
	await writeFile(unsupported, 'fixture')
	for (const [input, error] of [
		[{ path: 'relative.wav' }, 'absolute'],
		[{ path: directory }, 'non-empty regular file'],
		[{ path: empty }, 'non-empty regular file'],
		[{ path: unsupported }, 'Unsupported format'],
		[{ path: empty, language: ' ' }, 'non-empty string'],
		[{ path: empty, timestamps: 'word' }, 'Timestamps are not supported'],
	] as const) await expect(tool.execute(input, ctx)).rejects.toThrow(error)
	expect(network).not.toHaveBeenCalled()
})

test('API failures expose status/code, not key fragments, and never retry or fallback', async () => {
	const path = join(directory, 'audio.wav')
	await writeFile(path, 'fixture')
	network.mockResolvedValue(Response.json({ error: { code: 'invalid_api_key', message: 'Do not echo this secret fragment' } }, { status: 401 }))
	let error = ''
	try { await tool.execute({ path }, ctx) } catch (caught) { error = String(caught) }
	expect(error).toContain('HTTP 401, code invalid_api_key')
	expect(error).not.toContain('secret fragment')
	expect(network).toHaveBeenCalledTimes(1)
})

test('cancellation aborts a pending upload and a pre-cancelled call does not upload', async () => {
	const path = join(directory, 'audio.wav')
	await writeFile(path, 'fixture')
	const controller = new AbortController()
	network.mockImplementation((_url, request) => new Promise((_resolve, reject) => {
		request.signal.addEventListener('abort', () => reject(request.signal.reason), { once: true })
		controller.abort()
	}))
	await expect(tool.execute({ path }, { signal: controller.signal } as PluginToolContext)).rejects.toThrow('cancelled')
	await expect(tool.execute({ path }, { signal: controller.signal } as PluginToolContext)).rejects.toThrow()
	expect(network).toHaveBeenCalledTimes(1)
})
