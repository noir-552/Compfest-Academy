import { NavLink, Outlet } from 'react-router';

const TABS = [
  { to: '/dashboard/seller/store', label: 'Toko & Produk' },
  { to: '/dashboard/seller/orders', label: 'Pesanan Masuk' },
  { to: '/dashboard/seller/report', label: 'Laporan' },
];

function tabClass({ isActive }: { isActive: boolean }): string {
  return `border-b-2 px-1 py-3 text-sm font-medium ${
    isActive ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-teal-700'
  }`;
}

export function SellerDash() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard Penjual</h1>

      <nav className="mt-6 flex gap-6 border-b border-slate-200">
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
