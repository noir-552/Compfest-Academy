import { Card } from '../../ui/Card';

export function AdminDash() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard Admin</h1>
      <Card className="mt-4">
        <p className="text-sm text-slate-500">
          Ini adalah placeholder dashboard admin untuk Level 1. Fitur moderasi pengguna, toko, dan laporan akan
          ditambahkan pada level berikutnya.
        </p>
      </Card>
    </div>
  );
}
