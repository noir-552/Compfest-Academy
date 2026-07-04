import { Navigate, Outlet } from 'react-router';
import { useAuth } from './AuthContext';
import type { RoleType } from '../api/auth';

/**
 * Blocks nested routes unless the signed-in user's active role matches
 * `role`. An absent (null) active role and a mismatched active role both
 * redirect to /select-role — a multi-role user must pick a role before
 * reaching any private dashboard.
 */
export function RequireRole({ role }: { role: RoleType }) {
  const { user, activeRole, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (activeRole !== role) {
    return <Navigate to="/select-role" replace />;
  }

  return <Outlet />;
}
