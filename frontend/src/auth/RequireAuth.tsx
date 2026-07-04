import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthContext';

/** Blocks unauthenticated visitors from nested routes, sending them to /login. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
