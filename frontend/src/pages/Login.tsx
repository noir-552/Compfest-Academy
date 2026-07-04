import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { ApiClientError } from '../api/client';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { DASHBOARD_PATH } from '../constants/roles';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await login(username, password);
      if (res.activeRole) {
        navigate(DASHBOARD_PATH[res.activeRole], { replace: true });
      } else {
        navigate('/select-role', { replace: true });
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal masuk. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">Masuk ke SEAPEDIA</h1>
        <p className="mt-1 text-sm text-slate-500">Belanja dari banyak toko dalam satu akun.</p>
      </div>
      <Card>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input
            label="Username"
            name="username"
            autoComplete="username"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Memproses...' : 'Masuk'}
          </Button>
        </form>
      </Card>
      <p className="text-center text-sm text-slate-500">
        Belum punya akun?{' '}
        <Link to="/register" className="font-medium text-teal-700">
          Daftar
        </Link>
      </p>
    </div>
  );
}
