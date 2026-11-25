import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, refreshSession, setAccessToken, setSessionExpiredHandler } from '../api/http.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null); // { user, permissions }
  const [loading, setLoading] = useState(true);

  const apply = useCallback((data) => {
    setAccessToken(data.accessToken);
    setSession({ user: data.user, permissions: data.permissions });
  }, []);

  // On page load, try to restore the session from the refresh cookie.
  useEffect(() => {
    setSessionExpiredHandler(() => setSession(null));
    refreshSession().then((data) => data && setSession({ user: data.user, permissions: data.permissions }))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password }, auth: false });
    apply(data);
    return data.user;
  }, [apply]);

  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignore: we clear local state anyway */ }
    setAccessToken(null);
    setSession(null);
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    apply(await api('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }));
  }, [apply]);

  const value = useMemo(() => ({
    user: session?.user || null,
    permissions: session?.permissions || [],
    loading,
    can: (permission) => (session?.permissions || []).includes(permission), // UI hint only: the API enforces access
    login, logout, changePassword,
  }), [session, loading, login, logout, changePassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
