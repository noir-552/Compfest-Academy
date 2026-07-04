import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { register } from '../api/auth';
import type { RegisterableRole } from '../api/auth';
import { ApiClientError } from '../api/client';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';

const ROLE_OPTIONS: { value: RegisterableRole; label: string }[] = [
  { value: 'BUYER', label: 'Pembeli' },
  { value: 'SELLER', label: 'Penjual' },
  { value: 'DRIVER', label: 'Kurir' },
];

export function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<RegisterableRole[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  function toggleRole(role: RegisterableRole) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (roles.length === 0) {
      setError('Pilih minimal satu peran.');
      return;
    }
    setSubmitting(true);
    try {
      await register({ username, email, phone, password, roles });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal mendaftar. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-16 text-center">
        <Card>
          <h1 className="text-xl font-semibold text-slate-900">Pendaftaran berhasil</h1>
          <p className="mt-2 text-sm text-slate-500">Silakan masuk dengan akun barumu.</p>
          <Link to="/login">
            <Button className="mt-4">Ke halaman masuk</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">Daftar ke SEAPEDIA</h1>
        <p className="mt-1 text-sm text-slate-500">Satu akun, banyak peran: beli, jual, atau antar.</p>
      </div>
      <Card>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input label="Username" name="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
          <Input
            label="Email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Nomor HP"
            name="phone"
            inputMode="numeric"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-slate-700">Peran</legend>
            <div className="flex flex-wrap gap-3">
              {ROLE_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={roles.includes(opt.value)} onChange={() => toggleRole(opt.value)} />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Memproses...' : 'Daftar'}
          </Button>
        </form>
      </Card>
      <p className="text-center text-sm text-slate-500">
        Sudah punya akun?{' '}
        <Link to="/login" className="font-medium text-teal-700">
          Masuk
        </Link>
      </p>
    </div>
  );
}
