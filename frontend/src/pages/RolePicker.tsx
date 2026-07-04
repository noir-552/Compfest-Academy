import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import type { RoleType } from '../api/auth';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { DASHBOARD_PATH, ROLE_LABEL } from '../constants/roles';

export function RolePicker() {
  const { roles, setActiveRole } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState<RoleType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(role: RoleType) {
    setPending(role);
    setError(null);
    try {
      await setActiveRole(role);
      navigate(DASHBOARD_PATH[role], { replace: true });
    } catch {
      setError('Gagal memilih peran. Coba lagi.');
      setPending(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">Pilih peran aktif</h1>
        <p className="mt-1 text-sm text-slate-500">
          Akunmu punya lebih dari satu peran. Pilih salah satu untuk melanjutkan.
        </p>
      </div>
      <Card className="flex flex-col gap-3">
        {roles.map((role) => (
          <Button key={role} variant="secondary" disabled={pending !== null} onClick={() => choose(role)}>
            {pending === role ? 'Memproses...' : ROLE_LABEL[role]}
          </Button>
        ))}
      </Card>
      {error && (
        <p className="text-center text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
