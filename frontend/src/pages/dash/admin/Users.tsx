import { useEffect, useState } from 'react';
import * as adminApi from '../../../api/admin';
import { Badge } from '../../../ui/Badge';
import { Card } from '../../../ui/Card';
import { Table, type TableColumn } from '../../../ui/Table';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('id-ID', { dateStyle: 'medium' });
}

/** Admin monitoring: every registered user with roles (never shows passwordHash — the backend omits it). */
export function Users() {
  const [users, setUsers] = useState<adminApi.AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .listUsers()
      .then((res) => setUsers(res.users))
      .catch(() => setError('Gagal memuat pengguna.'))
      .finally(() => setLoading(false));
  }, []);

  const columns: TableColumn<adminApi.AdminUser>[] = [
    { key: 'username', header: 'Username', render: (u) => u.username },
    { key: 'email', header: 'Email', render: (u) => u.email },
    { key: 'phone', header: 'Telepon', render: (u) => u.phone },
    {
      key: 'roles',
      header: 'Peran',
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.roles.map((role) => (
            <Badge key={role} tone="info">
              {role}
            </Badge>
          ))}
        </div>
      ),
    },
    { key: 'createdAt', header: 'Terdaftar', render: (u) => formatDate(u.createdAt) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">Pengguna</h1>
      <Card>
        {loading && <p className="text-sm text-slate-500">Memuat pengguna...</p>}
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && (
          <Table columns={columns} rows={users} rowKey={(u) => u.id} emptyMessage="Belum ada pengguna." />
        )}
      </Card>
    </div>
  );
}
