import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  const [file, setFile] = useState(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const statusLabels = { processing: 'Processing', transcribed: 'Transcription ready', demo_ready: 'Learning discussion ready', review_needed: 'Review needed' };

  async function submit(event) {
    event.preventDefault();
    if (!file || pending) return;
    setPending(true);
    setResult(null);
    setError('');
    const form = new FormData();
    form.append('report', file);
    try {
      const response = await fetch('/api/cases', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The upload could not be completed.');
      setResult(data);
    } catch (cause) {
      setError(cause instanceof TypeError ? 'Could not connect to the upload server. Please try again.' : cause.message);
    } finally {
      setPending(false);
    }
  }

  return <main className="panel">
    <p className="eyebrow">Lab report intake</p>
    <h1>Upload a report image</h1>
    <p className="intro">Choose a fictional report image for this development milestone. PNG and JPEG images up to 10 MB are accepted.</p>
    <form onSubmit={submit}>
      <label htmlFor="report">Report image</label>
      <input id="report" type="file" accept="image/png,image/jpeg" required onChange={event => { setFile(event.target.files?.[0] || null); setResult(null); setError(''); }} />
      <button type="submit" disabled={!file || pending}>{pending ? 'Uploading and waiting for n8n…' : 'Submit'}</button>
    </form>
    {error && <div role="alert" className="message error">{error}</div>}
    {result && <div role="status" className="message success">
      <strong>Submitted</strong><br />Case ID: {result.caseId}<br />Case status: {statusLabels[result.status] || result.status}
      {result.status === 'review_needed' && <p>Text extraction did not complete. Review the n8n execution before trying again.</p>}
      {result.demoDiscussion && <section className="transcription"><h2>Fictional learning discussion</h2><p>Model-generated educational example. It does not tell you which medicine to take.</p><pre>{result.demoDiscussion}</pre></section>}
      {result.transcription && <section className="transcription"><h2>Extracted text</h2><p>Unverified transcription. Compare it with the original image.</p><pre>{result.transcription}</pre></section>}
    </div>}
    <p className="privacy">Uploads are stored privately. This page does not provide medical interpretation.</p>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
