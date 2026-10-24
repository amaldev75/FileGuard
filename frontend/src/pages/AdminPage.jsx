import { useEffect, useState } from 'react';
import FileStatus, { expiryLabel, formatDay } from '../components/FileStatus';
import StatusBadge from '../components/StatusBadge';
import ExpiryModal from '../components/ExpiryModal';
import '../components/StatusBadge.css';
import {
  fetchAdminStats, fetchAdminRequests, fetchAdminUsers, fetchAdminTampered,
  approveRequest, rejectRequest, setExpiry, declineExtension, toggleUser, downloadFile,
} from '../api';
import './Pages.css';
import './DashboardPage.css';
import './Admin.css';

const REQ_COLS = '1fr 1.4fr 0.6fr 1.2fr 0.9fr 1.9fr';
const USER_COLS = '1.3fr 1.3fr 0.6fr 0.6fr 0.9fr 1fr';
const EXT_COLS = '1fr 1.4fr 1fr 1.6fr 1.4fr';
const TAMP_COLS = '1fr 1.5fr 1.4fr';

const STAT_CARDS = [
  ['users', 'Users', ''],
  ['pending', 'Pending', 'warn'],
  ['approved', 'Approved', 'ok'],
  ['expired', 'Expired approvals', 'warn'],
  ['extension_requests', 'Extension requests', 'warn'],
  ['rejected', 'Rejected', 'bad'],
  ['verified', 'Verified checks', 'ok'],
  ['tampered', 'Tampered checks', 'bad'],
  ['not_registered', 'Not registered', 'warn'],
];

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [tampered, setTampered] = useState([]);
  const [filter, setFilter] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [modal, setModal] = useState(null); // { mode: 'approve' | 'expiry' | 'extend', file }

  const load = async () => {
    setLoading(true);
    try {
      const [s, r, u, t] = await Promise.all([
        fetchAdminStats(), fetchAdminRequests(), fetchAdminUsers(), fetchAdminTampered(),
      ]);
      setStats(s); setRequests(r); setUsers(u); setTampered(t);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const act = async (id, action, okMessage) => {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(okMessage);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleModalConfirm = ({ note, date }) => {
    const { mode, file } = modal;
    setModal(null);
    if (mode === 'approve') {
      act(file.id, () => approveRequest(file.id, note, date), `"${file.filename}" approved and digitally signed.`);
    } else {
      act(file.id, () => setExpiry(file.id, { expires_at: date }),
        date ? `Expiry for "${file.filename}" saved.` : `Expiry removed from "${file.filename}".`);
    }
  };

  const handleExpireNow = (r) => {
    if (!window.confirm(`End the approval of "${r.filename}" now? It will show as Expired when verified.`)) return;
    act(r.id, () => setExpiry(r.id, { expire_now: true }), `Approval of "${r.filename}" ended.`);
  };

  const handleDecline = (r) => {
    if (!window.confirm(`Decline the extension request for "${r.filename}"? The approval stays expired.`)) return;
    act(r.id, () => declineExtension(r.id), `Extension request for "${r.filename}" declined.`);
  };

  const handleReject = (r) => {
    const note = window.prompt(`Reject "${r.filename}" from ${r.owner_name}?\nReason (shown to the user):`, '');
    if (note === null) return;
    act(r.id, () => rejectRequest(r.id, note), `"${r.filename}" was rejected.`);
  };

  const shown = requests.filter((r) => filter === 'ALL' || r.status === filter);
  const extReqs = requests.filter((r) => r.status === 'APPROVED' && r.extension_status === 'REQUESTED');
  const count = (s) => requests.filter((r) => r.status === s).length;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Control panel</h1>
        <p className="page-desc">
          Review file submissions. Approving a file re-checks its SHA-256 hash and signs it,
          which makes it the trusted original. Monitor users and tamper alerts across the system.
        </p>
      </div>

      <button className="btn-refresh" onClick={load} disabled={loading}>
        {loading ? 'Refreshing…' : '↻ Refresh'}
      </button>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="ad-notice">{notice}</div>}

      {stats && (
        <div className="ad-stats">
          {STAT_CARDS.map(([key, label, tone]) => (
            <div key={key} className={`ad-stat ${tone ? `ad-stat-${tone}` : ''}`}>
              <div className="ad-stat-num">{stats[key]}</div>
              <div className="ad-stat-label">{label}</div>
            </div>
          ))}
        </div>
      )}

      <section className="card">
        <h2 className="section-title">Extension Requests ({extReqs.length})</h2>
        {extReqs.length === 0 ? (
          <p className="empty-state">No extension requests.</p>
        ) : (
          <div className="ad-table">
            <div className="ad-row ad-head" style={{ gridTemplateColumns: EXT_COLS }}>
              <span>User</span><span>File</span><span>Expired on</span><span>Reason</span><span>Actions</span>
            </div>
            {extReqs.map((r) => (
              <div className="ad-row" key={r.id} style={{ gridTemplateColumns: EXT_COLS }}>
                <span className="mono">{r.owner_name}</span>
                <span className="mono ad-wrap">{r.filename}</span>
                <span className="mono dim">{r.expires_on ? formatDay(r.expires_on) : '-'}</span>
                <span className="mono dim ad-wrap">{r.extension_reason || 'No reason given'}</span>
                <span className="ad-actions">
                  <button className="ad-btn ad-btn-ok" disabled={busyId === r.id} onClick={() => setModal({ mode: 'extend', file: r })}>Extend</button>
                  <button className="ad-btn ad-btn-danger" disabled={busyId === r.id} onClick={() => handleDecline(r)}>Decline</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="section-title">Registration Requests</h2>
        <div className="ad-filters">
          {[['PENDING', `Pending (${count('PENDING')})`], ['APPROVED', `Approved (${count('APPROVED')})`],
            ['REJECTED', `Rejected (${count('REJECTED')})`], ['ALL', `All (${requests.length})`]].map(([id, label]) => (
            <button key={id} className={`ad-filter ${filter === id ? 'on' : ''}`} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="empty-state">{filter === 'PENDING' ? 'No pending requests. All caught up.' : 'Nothing to show here.'}</p>
        ) : (
          <div className="ad-table">
            <div className="ad-row ad-head" style={{ gridTemplateColumns: REQ_COLS }}>
              <span>User</span><span>File</span><span>Size</span><span>Submitted</span><span>Status</span><span>Actions</span>
            </div>
            {shown.map((r) => (
              <div key={r.id}>
                <div className="ad-row" style={{ gridTemplateColumns: REQ_COLS }}>
                  <span className="mono">{r.owner_name}</span>
                  <span className="mono ad-wrap">{r.filename}</span>
                  <span className="mono dim">{r.file_size} B</span>
                  <span className="mono dim">{new Date(r.upload_date).toLocaleString()}</span>
                  <span><FileStatus status={r.status} expired={r.is_expired} /></span>
                  <span className="ad-actions">
                    <button className="ad-btn" onClick={() => act(r.id, () => downloadFile(r), `Downloaded "${r.filename}" for review.`)}>Download</button>
                    {r.status === 'PENDING' && (
                      <>
                        <button className="ad-btn ad-btn-ok" disabled={busyId === r.id} onClick={() => setModal({ mode: 'approve', file: r })}>Approve</button>
                        <button className="ad-btn ad-btn-danger" disabled={busyId === r.id} onClick={() => handleReject(r)}>Reject</button>
                      </>
                    )}
                    {r.status === 'APPROVED' && (
                      <>
                        <button className="ad-btn" disabled={busyId === r.id} onClick={() => setModal({ mode: 'expiry', file: r })}>Set expiry</button>
                        {!r.is_expired && (
                          <button className="ad-btn ad-btn-warn" disabled={busyId === r.id} onClick={() => handleExpireNow(r)}>Expire now</button>
                        )}
                      </>
                    )}
                  </span>
                </div>
                {r.status !== 'PENDING' && (
                  <div className={`ad-note ${r.status === 'APPROVED' ? (r.is_expired ? 'ad-note-warn' : 'ad-note-ok') : ''}`}>
                    {r.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {r.approved_by_name || 'admin'}
                    {r.review_note ? `: ${r.review_note}` : ''}
                    {r.status === 'APPROVED' ? ` · ${expiryLabel(r)}` : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="section-title">Tamper Alerts ({tampered.length})</h2>
        {tampered.length === 0 ? (
          <p className="empty-state">No tampered files detected so far.</p>
        ) : (
          <div className="ad-table">
            <div className="ad-row ad-head" style={{ gridTemplateColumns: TAMP_COLS }}>
              <span>User</span><span>File</span><span>Detected</span>
            </div>
            {tampered.map((t) => (
              <div className="ad-row" key={t.id} style={{ gridTemplateColumns: TAMP_COLS }}>
                <span className="mono">{t.owner_name}</span>
                <span className="mono ad-wrap">{t.filename}</span>
                <span className="mono dim">{new Date(t.checked_at).toLocaleString()} <StatusBadge result="TAMPERED" size="sm" /></span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="section-title">Users ({users.length})</h2>
        {users.length === 0 ? (
          <p className="empty-state">No users have signed up yet.</p>
        ) : (
          <div className="ad-table">
            <div className="ad-row ad-head" style={{ gridTemplateColumns: USER_COLS }}>
              <span>Username</span><span>Joined</span><span>Files</span><span>Checks</span><span>Status</span><span>Action</span>
            </div>
            {users.map((u) => (
              <div className="ad-row" key={u.id} style={{ gridTemplateColumns: USER_COLS }}>
                <span className="mono">{u.username}</span>
                <span className="mono dim">{new Date(u.joined).toLocaleDateString()}</span>
                <span className="mono dim">{u.files}</span>
                <span className="mono dim">{u.checks}</span>
                <span><span className={`fs-pill ${u.is_active ? 'fs-approved' : 'fs-rejected'}`}>{u.is_active ? 'Active' : 'Deactivated'}</span></span>
                <span className="ad-actions">
                  <button
                    className={`ad-btn ${u.is_active ? 'ad-btn-danger' : 'ad-btn-ok'}`}
                    disabled={busyId === `u${u.id}`}
                    onClick={() => act(`u${u.id}`, () => toggleUser(u.id), `${u.username} was ${u.is_active ? 'deactivated' : 'activated'}.`)}
                  >
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
      {modal && (
        <ExpiryModal mode={modal.mode} file={modal.file} onConfirm={handleModalConfirm} onCancel={() => setModal(null)} />
      )}
    </div>
  );
}