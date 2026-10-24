import { useState } from 'react';
import '../pages/Admin.css';

const todayISO = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Dialog used by the admin to approve a file (note + optional expiry) or to change the expiry of an approved file.
export default function ExpiryModal({ mode, file, onConfirm, onCancel }) {
  const [note, setNote] = useState('');
  // keep the saved date only while it is still in the future (an expired date cannot be picked again)
  const [date, setDate] = useState(file.expires_on && file.expires_on >= todayISO() ? file.expires_on : '');
  const approving = mode === 'approve';
  const extending = mode === 'extend';
  const title = approving ? 'Approve file' : extending ? 'Extend approval' : 'Set expiry date';

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-sub">{file.filename} · {file.owner_name}</p>

        {approving && (
          <>
            <label className="modal-label" htmlFor="ex-note">Note for the user (optional)</label>
            <input id="ex-note" className="modal-input" value={note} onChange={(e) => setNote(e.target.value)} />
          </>
        )}

        <label className="modal-label" htmlFor="ex-date">{extending ? 'New valid-until date' : 'Valid until (optional)'}</label>
        <input id="ex-date" type="date" className="modal-input" min={todayISO()} value={date}
          onChange={(e) => setDate(e.target.value)} />
        <div className="modal-hint">
          {extending ? 'Choose the new date until which the approval is valid.'
            : 'Leave empty for no expiry. After this date the file shows as Expired.'}
        </div>

        <div className="modal-actions">
          <button className="ad-btn" onClick={onCancel}>Cancel</button>
          <button className="ad-btn ad-btn-ok" disabled={extending && !date} onClick={() => onConfirm({ note, date })}>
            {approving ? 'Approve & sign' : extending ? 'Extend' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}