// Small fetch wrapper. The access token lives in memory only (never localStorage), and the
// refresh token is an httpOnly cookie that the browser sends automatically to /api/auth.
let accessToken = null;
let onSessionExpired = () => {};

export const setAccessToken = (token) => { accessToken = token; };
export const setSessionExpiredHandler = (fn) => { onSessionExpired = fn; };

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details || [];
  }
}

async function raw(path, { method = 'GET', body, auth = true, blob = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(`/api${path}`, {
    method, headers, credentials: 'include', body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.ok && blob) return { res, data: await res.blob() };
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { res, data };
}

let refreshing = null;
export function refreshSession() {
  // Parallel requests share one refresh call.
  if (!refreshing) {
    refreshing = raw('/auth/refresh', { method: 'POST', auth: false })
      .then(({ res, data }) => {
        if (!res.ok) { setAccessToken(null); return null; }
        setAccessToken(data.accessToken);
        return data;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

async function request(path, options) {
  let { res, data } = await raw(path, options);
  if (res.status === 401 && options.auth !== false && data?.error?.code === 'TOKEN_INVALID') {
    const session = await refreshSession();
    if (session) ({ res, data } = await raw(path, options));
    else onSessionExpired();
  }
  if (!res.ok) {
    const e = data?.error || {};
    throw new ApiError(res.status, e.code || 'ERROR', e.message || 'Something went wrong', e.details);
  }
  return data;
}

export const api = (path, options = {}) => request(path, options);

/** Downloads a file (PDF or CSV) from an endpoint that needs the sign-in token. */
export async function download(path, filename) {
  const blob = await request(path, { blob: true });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
