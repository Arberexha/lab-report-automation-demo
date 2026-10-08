import { existsSync } from 'node:fs';
import path from 'node:path';
import { createApp } from './app.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const { N8N_WEBHOOK_URL, N8N_WEBHOOK_SECRET } = process.env;
if (!N8N_WEBHOOK_URL || !N8N_WEBHOOK_SECRET || N8N_WEBHOOK_SECRET === 'replace-with-a-long-random-secret') {
  throw new Error('Set N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET in .env before starting the server.');
}
const url = new URL(N8N_WEBHOOK_URL);
if (!['http:', 'https:'].includes(url.protocol)) throw new Error('N8N_WEBHOOK_URL must use HTTP or HTTPS.');
if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
  throw new Error('Use HTTPS for a non-local N8N_WEBHOOK_URL to protect the image and webhook secret.');
}
const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'private_uploads');
const publicDir = path.resolve('dist');
if (uploadDir === publicDir || uploadDir.startsWith(publicDir + path.sep)) throw new Error('UPLOAD_DIR must be outside dist.');
const port = Number(process.env.PORT || 3001);
createApp({ webhookUrl: url.href, webhookSecret: N8N_WEBHOOK_SECRET, uploadDir }).listen(port, () => {
  console.log(`Upload server listening on http://127.0.0.1:${port}`);
});
