import { NavLink, Outlet } from 'react-router';

const TABS = [
  { to: '/dashboard/admin/overview', label: 'Ringkasan' },
  { to: '/dashboard/admin/users', label: 'Pengguna' },
  { to: '/dashboard/admin/stores', label: 'Toko' },
  { to: '/dashboard/admin/products', label: 'Produk' },
  { to: '/dashboard/admin/orders', label: 'Pesanan' },
  { to: '/dashboard/admin/jobs', label: 'Job Pengiriman' },
  { to: '/dashboard/admin/discounts', label: 'Voucher & Promo' },
  { to: '/dashboard/admin/overdue', label: 'Terlambat' },
  { to: '/dashboard/admin/simulate', label: 'Simulasi Waktu' },
];

function tabClass({ isActive }: { isActive: boolean }): string {
  return `border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap ${
    isActive ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-teal-700'
  }`;
}

export function AdminDash() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard Admin</h1>

      <nav className="mt-6 flex gap-6 overflow-x-auto border-b border-slate-200">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className={tabClass}>
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
