import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/http.js';

/** Loads data from the API and re-loads when the path changes. */
export function useFetch(path, { skip = false } = {}) {
  const [state, setState] = useState({ data: null, loading: !skip, error: null });
  const load = useCallback(async () => {
    if (skip || !path) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try { setState({ data: await api(path), loading: false, error: null }); }
    catch (error) { setState({ data: null, loading: false, error }); }
  }, [path, skip]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
