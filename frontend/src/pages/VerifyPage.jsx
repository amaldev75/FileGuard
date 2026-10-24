import { useState } from 'react';
import FileDrop from '../components/FileDrop';
import StatusBadge from '../components/StatusBadge';
import { verifyFile, downloadReport } from '../api';
import '../components/FileDrop.css';
import '../components/StatusBadge.css';
import './Pages.css';
import './VerifyPage.css';
import './Admin.css';

export default function VerifyPage() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [reportBusy, setReportBusy] = useState(false);

  const handleVerify = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await verifyFile(file);
      setResult(data);
      setFile(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReport = async () => {
    setReportBusy(true);
    setError(null);
    try {
      await downloadReport(result.log.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setReportBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Verify integrity & authenticity</h1>
        <p className="page-desc">
          Upload a file to check it against its admin-approved original. FileGuard
          recomputes the SHA-256 hash and validates the RSA signature to
          confirm the file is unchanged and genuinely trusted.
        </p>
      </div>

      <div className="card">
        <FileDrop file={file} onFile={setFile} accentLabel="Upload the same filename as the approved original" />
        <button className="btn btn-primary" disabled={!file || loading} onClick={handleVerify}>
          {loading ? 'Verifying…' : 'Verify File'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {result && (
        <div className={`card result-card result-${result.result?.toLowerCase()}`}>
          <div className="result-head">
            <StatusBadge result={result.result} />
          </div>

          {result.result === 'NOT_REGISTERED' ? (
            <p className="verify-msg">{result.message}</p>
          ) : (
            <>
              {result.result === 'EXPIRED' && <p className="verify-msg">{result.message}</p>}
              <div className="check-rows">
                <div className="check-row">
                  <span>Integrity (SHA-256 hash match)</span>
                  <StatusOk ok={result.integrity_passed} />
                </div>
                <div className="check-row">
                  <span>Authenticity (RSA signature valid)</span>
                  <StatusOk ok={result.authenticity_passed} />
                </div>
              </div>
              <dl className="kv" style={{ marginTop: 18 }}>
                <dt>Stored Hash</dt>
                <dd className="mono hash-value">{result.stored_hash}</dd>
                <dt>Current Hash</dt>
                <dd className="mono hash-value">{result.current_hash}</dd>
              </dl>
            </>
          )}

          <button className="btn-report" disabled={reportBusy} onClick={handleReport}>
            {reportBusy ? 'Preparing…' : '⬇ Download verification report (PDF)'}
          </button>
        </div>
      )}

      <div className="hint-strip">
        <strong>How it works:</strong> the file is re-hashed with SHA-256, compared
        with the stored hash, and the stored signature is checked with the RSA
        public key. Both checks must pass for a file to be Verified, and the
        approval must not have expired.
      </div>
    </div>
  );
}

function StatusOk({ ok }) {
  return (
    <span className={`check-pill ${ok ? 'check-pill-ok' : 'check-pill-bad'}`}>
      {ok ? 'Passed' : 'Failed'}
    </span>
  );
}