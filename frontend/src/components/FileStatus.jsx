const LABELS = { PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected' };

// Small coloured pill showing a file's approval status.
// An approved file whose validity period has ended is shown as "Expired".
export default function FileStatus({ status, expired }) {
  if (status === 'APPROVED' && expired) {
    return <span className="fs-pill fs-expired">Expired</span>;
  }
  return <span className={`fs-pill fs-${(status || '').toLowerCase()}`}>{LABELS[status] || status}</span>;
}

// "2026-12-31" -> "31 Dec 2026" (parsed as a local date so it never shifts by a day)
export function formatDay(iso) {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

// One-line validity text for an approved file.
export function expiryLabel(file) {
  if (!file.expires_on) return 'No expiry';
  return file.is_expired ? `Expired on ${formatDay(file.expires_on)}` : `Valid until ${formatDay(file.expires_on)}`;
}