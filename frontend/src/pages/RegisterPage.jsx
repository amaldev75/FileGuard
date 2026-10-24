import { useState } from 'react';
import FileDrop from '../components/FileDrop';
import FileStatus from '../components/FileStatus';
import { registerFile } from '../api';
import '../components/FileDrop.css';
import './Pages.css';
import './Admin.css';

export default function RegisterPage() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleRegister = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await registerFile(file);
      setResult(data);
      setFile(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Submit a file for registration</h1>
        <p className="page-desc">
          Upload the original file. FileGuard records its SHA-256 hash and sends
          the file to an admin. Once the admin approves it, the hash is signed
          and the file becomes the trusted original for future verification.
        </p>
      </div>

      <div className="card">
        <FileDrop file={file} onFile={setFile} accentLabel="Any file type — an admin must approve it before it is trusted" />

        <button className="btn btn-primary" disabled={!file || loading} onClick={handleRegister}>
          {loading ? 'Submitting…' : 'Submit for Approval'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {result && (
        <div className="card result-card">
          <div className="result-head">
            <span className="result-check">✓</span>
            <span>File submitted — waiting for admin approval</span>
          </div>
          <dl className="kv">
            <dt>Filename</dt>
            <dd className="mono">{result.file.filename}</dd>
            <dt>Size</dt>
            <dd className="mono">{result.file.file_size} bytes</dd>
            <dt>Status</dt>
            <dd><FileStatus status={result.file.status} /></dd>
            <dt>SHA-256 Hash</dt>
            <dd className="mono hash-value">{result.file.sha256_hash}</dd>
          </dl>
        </div>
      )}

      <div className="hint-strip">
        <strong>How it works:</strong> you submit the file → an admin reviews it →
        on approval FileGuard re-checks the hash and signs it with the RSA
        private key → the file becomes the trusted original. Track the status
        on the Dashboard.
      </div>
    </div>
  );
}