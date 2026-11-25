import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

/** Keeps signed-out users out and, optionally, requires a permission. This is for UX only: the API also checks. */
export default function ProtectedRoute({ permission, children }) {
  const { user, loading, can } = useAuth();
  const location = useLocation();

  if (loading) return <p className="center muted">Loading...</p>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user.mustChangePassword && location.pathname !== '/change-password') return <Navigate to="/change-password" replace />;
  if (permission && !can(permission)) return <Navigate to="/unauthorized" replace />;
  return children;
}
