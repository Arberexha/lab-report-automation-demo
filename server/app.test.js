import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { imageType, submitCase } from './app.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=', 'base64');

test('fictional report is stored privately and sent as authenticated multipart to webhook', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'lab-upload-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const sent = [];
  const result = await submitCase({
    buffer: png, type: imageType(png), uploadDir: directory,
    webhookUrl: 'https://n8n.example.test/webhook/lab-report-upload', webhookSecret: 'test-secret',
    fetchImpl: async (url, options) => {
      sent.push({ url, method: options.method, secret: options.headers['x-webhook-secret'], caseId: options.body.get('caseId'), report: Buffer.from(await options.body.get('report').arrayBuffer()) });
      return { ok: true };
    },
  });
  assert.match(result.caseId, /^[0-9a-f-]{36}$/);
  assert.equal(result.status, 'processing');
  assert.deepEqual(sent, [{ url: 'https://n8n.example.test/webhook/lab-report-upload', method: 'POST', secret: 'test-secret', caseId: result.caseId, report: png }]);
  assert.deepEqual(await readdir(directory), [`${result.caseId}.png`]);
  assert.deepEqual(await readFile(path.join(directory, `${result.caseId}.png`)), png);
});

test('disguised file is not treated as an image', () => {
  assert.equal(imageType(Buffer.from('not a png')), null);
  assert.equal(imageType(Buffer.from([0xff, 0xd8, 0, 0])), null);
});

test('webhook failure removes the private copy', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'lab-upload-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await assert.rejects(submitCase({ buffer: png, type: imageType(png), uploadDir: directory, webhookUrl: 'https://n8n.example.test/hook', webhookSecret: 'test-secret', fetchImpl: async () => ({ ok: false }) }));
  assert.deepEqual(await readdir(directory), []);
});

test('completed n8n response returns raw transcription only for the matching case', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'lab-upload-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const result = await submitCase({
    buffer: png, type: imageType(png), uploadDir: directory,
    webhookUrl: 'https://n8n.example.test/hook', webhookSecret: 'test-secret',
    fetchImpl: async (_url, options) => Response.json({
      caseId: options.body.get('caseId'),
      ocrStatus: 'completed',
      transcription: 'FICTIONAL REPORT\nSample value: 1',
    }),
  });
  assert.equal(result.status, 'transcribed');
  assert.equal(result.transcription, 'FICTIONAL REPORT\nSample value: 1');
});

test('rejects a final result for a different case ID', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'lab-upload-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await assert.rejects(submitCase({
    buffer: png, type: imageType(png), uploadDir: directory,
    webhookUrl: 'https://n8n.example.test/hook', webhookSecret: 'test-secret',
    fetchImpl: async () => Response.json({ caseId: 'wrong-id', ocrStatus: 'completed', transcription: 'wrong text' }),
  }));
  assert.deepEqual(await readdir(directory), []);
});

test('returns a fictional discussion without displaying the OCR text', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'lab-upload-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const result = await submitCase({
    buffer: png, type: imageType(png), uploadDir: directory,
    webhookUrl: 'https://n8n.example.test/hook', webhookSecret: 'test-secret',
    fetchImpl: async (_url, options) => Response.json({
      caseId: options.body.get('caseId'),
      ocrStatus: 'completed',
      transcription: 'FICTIONAL REPORT',
      demoDiscussion: 'A clinician would need more context before discussing medication categories.',
    }),
  });
  assert.equal(result.status, 'demo_ready');
  assert.match(result.demoDiscussion, /more context/);
  assert.equal('transcription' in result, false);
});
