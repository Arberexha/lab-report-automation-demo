// Blank fictional image; this script never sends a real report.
import { existsSync } from 'node:fs';
import { fictionalTestImage } from './fictional-test-image.mjs';

if (existsSync('.env')) process.loadEnvFile('.env');
const png = fictionalTestImage();
const form = new FormData();
form.append('report', new Blob([png], { type: 'image/png' }), 'fictional-report.png');
const port = process.env.PORT || 3001;
try {
  const response = await fetch(`http://127.0.0.1:${port}/api/cases`, { method: 'POST', body: form, signal: AbortSignal.timeout(100000) });
  const result = await response.json();
  if (response.status !== 202 || !['processing', 'transcribed', 'demo_ready', 'review_needed'].includes(result.status) || !result.caseId) throw new Error(result.error || `Unexpected HTTP ${response.status}`);
  console.log(`Webhook accepted fictional case ${result.caseId}; status: ${result.status}`);
} catch (error) {
  console.error(`Webhook verification failed: ${error.message}`);
  process.exitCode = 1;
}
