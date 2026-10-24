import { useEffect, useState } from 'react';
import StatusBadge from '../components/StatusBadge';
import FileStatus, { expiryLabel } from '../components/FileStatus';
import { fetchFiles, fetchHistory, downloadFile, downloadReport, deleteFile, requestExtension } from '../api';
import '../components/StatusBadge.css';
import './Pages.css';
import './DashboardPage.css';
import './Admin.css';

const FILE_COLS = '1.4fr 0.6fr 1.1fr 0.9fr 0.9fr 2.1fr';
const HIST_COLS = '1.5fr 1.4fr 1fr 1fr';

export default function DashboardPage() {
  const [files, setFiles] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [f, h] = await Promise.all([fetchFiles(), fetchHistory()]);
      setFiles(f);
      setHistory(h);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const run = async (action) => {
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = (f) => run(async () => {
    if (!window.confirm(`Delete "${f.filename}"? Its verification history will be kept.`)) return;
    await deleteFile(f.id);
    setNotice(`"${f.filename}" was deleted.`);
    await load();
  });

  const handleRequestExtension = (f) => run(async () => {
    const reason = window.prompt(`Ask the admin to extend "${f.filename}".\nReason (optional):`, '');
    if (reason === null) return;
    await requestExtension(f.id, reason);
    setNotice(`Extension requested for "${f.filename}". The admin will review it.`);
    await load();
  });

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Dashboard & verification history</h1>
        <p className="page-desc">
          Your submitted files with their approval status, and every verification
          check you have performed, for a complete audit trail.
        </p>
      </div>

      <button className="btn-refresh" onClick={load} disabled={loading}>
        {loading ? 'Refreshing…' : '↻ Refresh'}
      </button>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="ad-notice">{notice}</div>}

      <section className="card">
        <h2 className="section-title">My Files ({files.length})</h2>
        {files.length === 0 ? (
          <p className="empty-state">No files yet. Go to the Register tab to submit one.</p>
        ) : (
          <div className="ad-table">
            <div className="ad-row ad-head" style={{ gridTemplateColumns: FILE_COLS }}>
              <span>Filename</span><span>Size</span><span>Submitted</span><span>Status</span><span>SHA-256</span><span>Actions</span>
            </div>
            {files.map((f) => (
              <div key={f.id}>
                <div className="ad-row" style={{ gridTemplateColumns: FILE_COLS }}>
                  <span className="mono ad-wrap">{f.filename}</span>
                  <span className="mono dim">{f.file_size} B</span>
                  <span className="mono dim">{new Date(f.upload_date).toLocaleString()}</span>
                  <span><FileStatus status={f.status} expired={f.is_expired} /></span>
                  <span className="mono dim">{f.sha256_hash.slice(0, 12)}…</span>
                  <span className="ad-actions">
                    <button className="ad-btn" onClick={() => run(() => downloadFile(f))}>Download</button>
                    {f.status === 'APPROVED' && f.is_expired && f.extension_status !== 'REQUESTED' && (
                      <button className="ad-btn ad-btn-warn" onClick={() => handleRequestExtension(f)}>
                        {f.extension_status === 'DECLINED' ? 'Request again' : 'Request extension'}
                      </button>
                    )}
                    <button className="ad-btn ad-btn-danger" onClick={() => handleDelete(f)}>Delete</button>
                  </span>
                </div>
                {f.status === 'REJECTED' && (
                  <div className="ad-note">Rejected by {f.approved_by_name || 'admin'}{f.review_note ? `: ${f.review_note}` : ''}</div>
                )}
                {f.status === 'APPROVED' && f.approved_by_name && (
                  <div className={`ad-note ${f.is_expired ? 'ad-note-warn' : 'ad-note-ok'}`}>
                    Approved by {f.approved_by_name} · signed · {expiryLabel(f)}
                    {f.is_expired && !f.extension_status ? ' · You can request an extension.' : ''}
                    {f.extension_status === 'REQUESTED' ? ' · Extension requested, waiting for the admin.' : ''}
                    {f.extension_status === 'DECLINED' ? ' · Extension declined by the admin.' : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="section-title">Verification History ({history.length})</h2>
        {history.length === 0 ? (
          <p className="empty-state">No verification attempts yet. Go to the Verify tab to check a file.</p>
        ) : (
          <div className="ad-table">
            <div className="ad-row ad-head" style={{ gridTemplateColumns: HIST_COLS }}>
              <span>Filename</span><span>Checked At</span><span>Result</span><span>Report</span>
            </div>
            {history.map((h) => (
              <div className="ad-row" key={h.id} style={{ gridTemplateColumns: HIST_COLS }}>
                <span className="mono ad-wrap">{h.filename}</span>
                <span className="mono dim">{new Date(h.checked_at).toLocaleString()}</span>
                <span><StatusBadge result={h.result} size="sm" /></span>
                <span className="ad-actions">
                  <button className="ad-btn" onClick={() => run(() => downloadReport(h.id))}>⬇ PDF report</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}