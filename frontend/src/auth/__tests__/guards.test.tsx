import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { RequireRole } from '../RequireRole';
import { useAuth, type AuthContextValue } from '../AuthContext';
import type { RoleType } from '../../api/auth';

// RequireRole/RequireAuth only depend on the `useAuth()` hook's return value,
// so the guard can be exercised in isolation by mocking the hook instead of
// wiring a real AuthProvider (which would require a network round-trip).
vi.mock('../AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../AuthContext')>('../AuthContext');
  return { ...actual, useAuth: vi.fn() };
});

const mockUseAuth = vi.mocked(useAuth);

function authValue(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    user: { id: '1', username: 'budi', email: 'budi@example.com', phone: '081234567890' },
    roles: ['BUYER', 'SELLER'] as RoleType[],
    activeRole: null,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    setActiveRole: vi.fn(),
    ...overrides,
  };
}

function renderGuardedDashboard(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route element={<RequireRole role="BUYER" />}>
          <Route path="/dashboard/buyer" element={<div>Buyer Dashboard</div>} />
        </Route>
        <Route path="/select-role" element={<div>Role Picker Screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireRole', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it('redirects to /select-role when the active role does not match the required role', () => {
    mockUseAuth.mockReturnValue(authValue({ activeRole: 'SELLER' }));

    renderGuardedDashboard(['/dashboard/buyer']);

    expect(screen.getByText('Role Picker Screen')).toBeInTheDocument();
    expect(screen.queryByText('Buyer Dashboard')).not.toBeInTheDocument();
  });

  it('shows the role picker (redirects to /select-role) when activeRole is null', () => {
    mockUseAuth.mockReturnValue(authValue({ activeRole: null }));

    renderGuardedDashboard(['/dashboard/buyer']);

    expect(screen.getByText('Role Picker Screen')).toBeInTheDocument();
    expect(screen.queryByText('Buyer Dashboard')).not.toBeInTheDocument();
  });

  it('renders the protected route when the active role matches', () => {
    mockUseAuth.mockReturnValue(authValue({ activeRole: 'BUYER' }));

    renderGuardedDashboard(['/dashboard/buyer']);

    expect(screen.getByText('Buyer Dashboard')).toBeInTheDocument();
  });
});
