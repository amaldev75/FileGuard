const CONFIG = {
  VERIFIED: { label: 'Verified', symbol: '✓' },
  TAMPERED: { label: 'Tampered', symbol: '✕' },
  NOT_REGISTERED: { label: 'Not Registered', symbol: '?' },
  EXPIRED: { label: 'Expired', symbol: '!' },
};

export default function StatusBadge({ result, size = 'md' }) {
  const cfg = CONFIG[result] || CONFIG.NOT_REGISTERED;
  return (
    <span className={`badge badge-${result?.toLowerCase()} badge-${size}`}>
      <span className="badge-symbol">{cfg.symbol}</span>
      {cfg.label}
    </span>
  );
}