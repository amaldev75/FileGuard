// Thin wrapper around fetch() so every component talks to the backend
// in a consistent way. Change API_BASE here if the backend URL changes.

const API_BASE = 'http://127.0.0.1:8000/api';

// ---------- login token kept in the browser ----------
export const getToken = () => { try { return localStorage.getItem('fileguard_token'); } catch { return null; } };
export const setToken = (t) => { try { localStorage.setItem('fileguard_token', t); } catch { /* ignore */ } };
export const getUsername = () => { try { return localStorage.getItem('fileguard_username'); } catch { return null; } };
export const setUsername = (u) => { try { localStorage.setItem('fileguard_username', u); } catch { /* ignore */ } };
export const clearToken = () => {
  try { localStorage.removeItem('fileguard_token'); localStorage.removeItem('fileguard_username'); } catch { /* ignore */ }
};

const authHeaders = () => ({ Authorization: `Token ${getToken()}` });

async function readJson(res) {
  try { return await res.json(); } catch { return {}; }
}

async function postJson(endpoint, body) {
  const res = await fetch(`${API_BASE}/${endpoint}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ---------- authentication ----------
export const signup = (username, password) => postJson('signup', { username, password });
export const login = (username, password) => postJson('login', { username, password });

// Asks the server who the saved token belongs to.
// Returns { username, is_admin }, or null when there is no valid login.
export async function checkAuth() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/me/`, { headers: authHeaders() });
    if (!res.ok) { clearToken(); return null; }
    const data = await res.json();
    return { username: data.username, is_admin: !!data.is_admin };
  } catch { return null; }
}

// ---------- generic helpers for logged-in calls ----------
async function authedGet(path) {
  const res = await fetch(`${API_BASE}/${path}`, { headers: authHeaders() });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || data.detail || 'Request failed');
  return data;
}

async function authedPost(path, body = {}) {
  const res = await fetch(`${API_BASE}/${path}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || data.detail || 'Request failed');
  return data;
}

async function postFile(endpoint, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/${endpoint}/`, { method: 'POST', headers: authHeaders(), body: formData });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || data.detail || 'Request failed');
  return data;
}

// Downloads need the token header, so we fetch the bytes and save them ourselves.
async function downloadBlob(path, saveAs) {
  const res = await fetch(`${API_BASE}/${path}`, { headers: authHeaders() });
  if (!res.ok) {
    const data = await readJson(res);
    throw new Error(data.error || data.detail || 'Download failed');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = saveAs;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- user features ----------
export const registerFile = (file) => postFile('register', file);
export const verifyFile = (file) => postFile('verify', file);
export const fetchFiles = () => authedGet('files/');
export const fetchHistory = () => authedGet('history/');
export const requestExtension = (id, reason = '') => authedPost(`files/${id}/request-extension/`, { reason });

export const downloadFile = (record) => downloadBlob(`files/${record.id}/download/`, record.filename);
export const downloadReport = (logId) =>
  downloadBlob(`history/${logId}/report/`, `FileGuard_Report_${String(logId).padStart(5, '0')}.pdf`);

export async function deleteFile(id) {
  const res = await fetch(`${API_BASE}/files/${id}/`, { method: 'DELETE', headers: authHeaders() });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || data.detail || 'Delete failed');
  return data;
}

// ---------- admin features ----------
export const fetchAdminStats = () => authedGet('admin/stats/');
export const fetchAdminRequests = () => authedGet('admin/requests/');
export const fetchAdminUsers = () => authedGet('admin/users/');
export const fetchAdminTampered = () => authedGet('admin/tampered/');
export const approveRequest = (id, note = '', expiresAt = '') =>
  authedPost(`admin/requests/${id}/approve/`, { note, expires_at: expiresAt });
// body: { expires_at: 'YYYY-MM-DD' | '' } to set / remove the expiry, or { expire_now: true } to end the approval
export const setExpiry = (id, body) => authedPost(`admin/requests/${id}/expiry/`, body);
export const declineExtension = (id) => authedPost(`admin/requests/${id}/extension/decline/`);
export const rejectRequest = (id, note = '') => authedPost(`admin/requests/${id}/reject/`, { note });
export const toggleUser = (id) => authedPost(`admin/users/${id}/toggle/`);