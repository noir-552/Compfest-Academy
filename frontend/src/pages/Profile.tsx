import { useAuth } from '../auth/AuthContext';
import type { RoleType } from '../api/auth';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

const ROLE_LABEL: Record<RoleType, string> = {
  ADMIN: 'Admin',
  SELLER: 'Penjual',
  BUYER: 'Pembeli',
  DRIVER: 'Kurir',
};

export function Profile() {
  const { user, roles, activeRole } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900">Profil saya</h1>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Data akun</h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase text-slate-400">Username</dt>
            <dd className="text-sm text-slate-800">{user.username}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Email</dt>
            <dd className="text-sm text-slate-800">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Nomor HP</dt>
            <dd className="text-sm text-slate-800">{user.phone}</dd>
          </div>
        </dl>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Peran</h2>
        <div className="flex flex-wrap gap-2">
          {roles.map((role) => (
            <Badge key={role} tone={role === activeRole ? 'info' : 'neutral'}>
              {ROLE_LABEL[role]}
              {role === activeRole ? ' (aktif)' : ''}
            </Badge>
          ))}
        </div>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Ringkasan keuangan</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {roles.map((role) => (
            <Card key={role} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">{ROLE_LABEL[role]}</h3>
                <Badge tone="warning">Placeholder Level 1</Badge>
              </div>
              <p className="text-sm text-slate-500">
                Ringkasan keuangan untuk peran {ROLE_LABEL[role]} belum tersedia di Level 1 — data akan tampil pada
                level berikutnya.
              </p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
