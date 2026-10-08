import { existsSync } from 'node:fs';
import { fictionalTestImage } from './fictional-test-image.mjs';

if (existsSync('.env')) process.loadEnvFile('.env');
const { N8N_WEBHOOK_URL, N8N_WEBHOOK_SECRET } = process.env;
if (!N8N_WEBHOOK_URL || !N8N_WEBHOOK_SECRET) {
  console.error('Set N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET in .env first.');
  process.exit(1);
}
const png = fictionalTestImage();
const form = new FormData();
form.append('caseId', 'fictional-connection-check');
form.append('report', new Blob([png], { type: 'image/png' }), 'report.png');
try {
  const response = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'x-webhook-secret': N8N_WEBHOOK_SECRET },
    body: form,
    signal: AbortSignal.timeout(90000),
  });
  console.log(`n8n webhook HTTP ${response.status} ${response.statusText}`);
  if (!response.ok) process.exitCode = 1;
} catch (error) {
  console.error(`n8n connection failed: ${error.cause?.code || error.name}`);
  process.exitCode = 1;
}
