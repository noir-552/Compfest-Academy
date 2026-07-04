import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import type { RoleType } from '../api/auth';
import { Badge } from './Badge';
import { Button } from './Button';

const ROLE_LABEL: Record<RoleType, string> = {
  ADMIN: 'Admin',
  SELLER: 'Penjual',
  BUYER: 'Pembeli',
  DRIVER: 'Kurir',
};

const DASHBOARD_PATH: Record<RoleType, string> = {
  ADMIN: '/dashboard/admin',
  SELLER: '/dashboard/seller',
  BUYER: '/dashboard/buyer',
  DRIVER: '/dashboard/driver',
};

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return `text-sm font-medium ${isActive ? 'text-teal-700' : 'text-slate-600 hover:text-teal-700'}`;
}

export function Navbar() {
  const { user, roles, activeRole, logout, setActiveRole } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    setMobileOpen(false);
    navigate('/');
  }

  async function handleRoleSwitch(role: RoleType) {
    await setActiveRole(role);
    setMobileOpen(false);
    navigate(DASHBOARD_PATH[role]);
  }

  const roleSwitcher = roles.length > 1 && (
    <select
      aria-label="Ganti peran aktif"
      className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
      value={activeRole ?? ''}
      onChange={(event) => handleRoleSwitch(event.target.value as RoleType)}
    >
      <option value="" disabled>
        Ganti peran
      </option>
      {roles.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABEL[role]}
        </option>
      ))}
    </select>
  );

  const roleBadge = activeRole ? (
    <Badge tone="info">{ROLE_LABEL[activeRole]}</Badge>
  ) : (
    <Badge tone="warning">Pilih peran</Badge>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-xl font-bold text-teal-700">
          SEAPEDIA
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <NavLink to="/" className={navLinkClass} end>
            Beranda
          </NavLink>
          <NavLink to="/catalog" className={navLinkClass}>
            Katalog
          </NavLink>
          {user && activeRole && (
            <NavLink to={DASHBOARD_PATH[activeRole]} className={navLinkClass}>
              Dashboard
            </NavLink>
          )}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {!user && (
            <>
              <Link to="/login">
                <Button variant="ghost">Masuk</Button>
              </Link>
              <Link to="/register">
                <Button variant="primary">Daftar</Button>
              </Link>
            </>
          )}
          {user && (
            <>
              {roleBadge}
              {roleSwitcher}
              <Link to="/profile">
                <Button variant="secondary">Profil</Button>
              </Link>
              <Button variant="ghost" onClick={handleLogout}>
                Keluar
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg p-2 text-2xl text-slate-600 md:hidden"
          aria-label="Buka menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((value) => !value)}
        >
          ☰
        </button>
      </nav>

      {mobileOpen && (
        <div className="border-t border-slate-200 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-3">
            <NavLink to="/" className={navLinkClass} end onClick={() => setMobileOpen(false)}>
              Beranda
            </NavLink>
            <NavLink to="/catalog" className={navLinkClass} onClick={() => setMobileOpen(false)}>
              Katalog
            </NavLink>
            {user && activeRole && (
              <NavLink to={DASHBOARD_PATH[activeRole]} className={navLinkClass} onClick={() => setMobileOpen(false)}>
                Dashboard
              </NavLink>
            )}

            {!user && (
              <div className="flex flex-col gap-2 pt-2">
                <Link to="/login" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full">
                    Masuk
                  </Button>
                </Link>
                <Link to="/register" onClick={() => setMobileOpen(false)}>
                  <Button variant="primary" className="w-full">
                    Daftar
                  </Button>
                </Link>
              </div>
            )}

            {user && (
              <div className="flex flex-col gap-2 pt-2">
                <div>{roleBadge}</div>
                {roleSwitcher}
                <Link to="/profile" onClick={() => setMobileOpen(false)}>
                  <Button variant="secondary" className="w-full">
                    Profil
                  </Button>
                </Link>
                <Button variant="ghost" className="w-full" onClick={handleLogout}>
                  Keluar
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
