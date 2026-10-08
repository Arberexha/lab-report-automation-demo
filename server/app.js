import express from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdir, open, unlink } from 'node:fs/promises';
import path from 'node:path';

const MAX_BYTES = 10 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1, fields: 0, parts: 1 },
}).single('report');

function imageType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mime: 'image/png', extension: '.png' };
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer.at(-2) === 0xff && buffer.at(-1) === 0xd9) return { mime: 'image/jpeg', extension: '.jpg' };
  return null;
}

export function createApp({ webhookUrl, webhookSecret, uploadDir, fetchImpl = fetch }) {
  const app = express();
  app.disable('x-powered-by');

  app.post('/api/cases', (req, res) => {
    if (!req.is('multipart/form-data')) return res.status(415).json({ error: 'Send a report image as multipart/form-data.' });
    upload(req, res, async error => {
      if (error) {
        const message = error.code === 'LIMIT_FILE_SIZE' ? 'The image must be 10 MB or smaller.' : 'Select one report image only.';
        return res.status(400).json({ error: message });
      }
      if (!req.file) return res.status(400).json({ error: 'Select a report image.' });
      const type = imageType(req.file.buffer);
      if (!type || req.file.mimetype !== type.mime) return res.status(415).json({ error: 'Only PNG and JPEG report images are accepted.' });

      try {
        const result = await submitCase({ buffer: req.file.buffer, type, webhookUrl, webhookSecret, uploadDir, fetchImpl });
        return res.status(202).json(result);
      } catch (cause) {
        if (cause.uploadStage === 'storage') return res.status(500).json({ error: 'The report could not be saved. Please try again.' });
        if (cause.webhookStatus === 404) return res.status(502).json({ error: 'The n8n webhook was not found. Publish the workflow and check N8N_WEBHOOK_URL.' });
        if (cause.webhookStatus === 401 || cause.webhookStatus === 403) return res.status(502).json({ error: 'n8n rejected the webhook secret. Check the Header Auth credential and N8N_WEBHOOK_SECRET.' });
        return res.status(502).json({ error: 'The report could not be sent for processing. Please try again.' });
      }
    });
  });

  app.use(express.static(path.resolve('dist')));
  app.use((_req, res) => res.sendFile(path.resolve('dist/index.html')));
  return app;
}

export { imageType, MAX_BYTES };

export async function submitCase({ buffer, type, webhookUrl, webhookSecret, uploadDir, fetchImpl = fetch }) {
  const caseId = randomUUID();
  const filePath = path.join(uploadDir, `${caseId}${type.extension}`);
  let stored = false;
  let stage = 'storage';
  try {
    await mkdir(uploadDir, { recursive: true, mode: 0o700 });
    const handle = await open(filePath, 'wx', 0o600);
    stored = true;
    try { await handle.writeFile(buffer); } finally { await handle.close(); }
    stage = 'webhook';
    const body = new FormData();
    body.append('caseId', caseId);
    body.append('report', new Blob([buffer], { type: type.mime }), `report${type.extension}`);
    const response = await fetchImpl(webhookUrl, {
      method: 'POST',
      headers: { 'x-webhook-secret': webhookSecret },
      body,
      signal: AbortSignal.timeout(90000),
    });
    if (!response.ok) {
      const error = new Error('Webhook response was unsuccessful');
      error.webhookStatus = response.status;
      throw error;
    }
    const result = { caseId, status: 'processing' };
    if (response.headers?.get?.('content-type')?.includes('application/json')) {
      const payload = await response.json();
      let data = payload;
      while (Array.isArray(data) && data.length === 1) data = data[0];
      if (data && typeof data === 'object' && 'caseId' in data) {
        if (data.caseId !== caseId) throw new Error('Webhook returned a different case ID');
        if (data.ocrStatus === 'completed' && typeof data.demoDiscussion === 'string' && data.demoDiscussion.trim()) {
          return { caseId, status: 'demo_ready', demoDiscussion: data.demoDiscussion };
        }
        if (data.ocrStatus === 'completed' && typeof data.transcription === 'string' && data.transcription.trim()) {
          return { caseId, status: 'transcribed', transcription: data.transcription };
        }
        if (data.ocrStatus) return { caseId, status: 'review_needed' };
      }
    }
    return result;
  } catch (error) {
    if (stored) await unlink(filePath).catch(() => {});
    error.uploadStage = stage;
    throw error;
  }
}
