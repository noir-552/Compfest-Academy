import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../cart/CartContext';
import type { RoleType } from '../api/auth';
import { Button } from './Button';
import { DASHBOARD_PATH, ROLE_LABEL, ROLE_CHIP_CLASS } from '../constants/roles';

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return `text-sm font-medium transition-colors duration-150 ${
    isActive ? 'text-teal-700' : 'text-slate-600 hover:text-teal-700'
  }`;
}

function LogoMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-teal-600" fill="none" aria-hidden="true">
      <path
        d="M3 16c2.5 2 5.5 2 8 0s5.5-2 8 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 11c2.5 2 5.5 2 8 0s5.5-2 8 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />
      <circle cx="17.5" cy="6" r="1.75" fill="currentColor" />
    </svg>
  );
}

export function Navbar() {
  const { user, roles, activeRole, logout, setActiveRole } = useAuth();
  const { itemCount } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
    } finally {
      setMobileOpen(false);
      navigate('/');
    }
  }

  async function handleRoleSwitch(role: RoleType) {
    await setActiveRole(role);
    setMobileOpen(false);
    navigate(DASHBOARD_PATH[role]);
  }

  const roleSwitcher = roles.length > 1 && (
    <select
      aria-label="Ganti peran aktif"
      className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
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
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_CHIP_CLASS[activeRole]}`}
    >
      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current" aria-hidden="true" />
      {ROLE_LABEL[activeRole]}
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
      Pilih peran
    </span>
  );

  const cartLink = user && activeRole === 'BUYER' && (
    <NavLink to="/dashboard/buyer/cart" className={navLinkClass}>
      <span className="relative">
        Keranjang
        {itemCount > 0 && (
          <span
            aria-label={`${itemCount} item di keranjang`}
            className="tabular absolute -right-4 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-semibold text-white"
          >
            {itemCount}
          </span>
        )}
      </span>
    </NavLink>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900">
          <LogoMark />
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
          {cartLink}
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
          aria-label={mobileOpen ? 'Tutup menu' : 'Buka menu'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((value) => !value)}
        >
          ☰
        </button>
      </nav>

      {mobileOpen && (
        <div className="border-t border-slate-200 px-4 py-3 motion-safe:animate-[fade-in_150ms_ease-out] md:hidden">
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
            {user && activeRole === 'BUYER' && (
              <NavLink
                to="/dashboard/buyer/cart"
                className={navLinkClass}
                onClick={() => setMobileOpen(false)}
              >
                Keranjang{itemCount > 0 ? ` (${itemCount})` : ''}
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
