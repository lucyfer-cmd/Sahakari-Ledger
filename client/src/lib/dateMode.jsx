import { createContext, useContext, useMemo, useState } from 'react';

const Ctx = createContext({ mode: 'both', setMode: () => {} });
export const useDateMode = () => useContext(Ctx);

// Remembers only a display preference (not sensitive) in this browser.
export function DateModeProvider({ children }) {
  const [mode, setModeState] = useState(() => { try { return localStorage.getItem('dateMode') || 'both'; } catch { return 'both'; } });
  const value = useMemo(() => ({ mode, setMode: (m) => { setModeState(m); try { localStorage.setItem('dateMode', m); } catch { /* ignore */ } } }), [mode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
