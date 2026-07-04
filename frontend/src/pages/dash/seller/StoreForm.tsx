import { useState, type FormEvent } from 'react';
import * as sellerApi from '../../../api/seller';
import { ApiClientError } from '../../../api/client';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';
import { Input } from '../../../ui/Input';

export interface StoreFormProps {
  store: sellerApi.SellerStore | null;
  onSaved: (store: sellerApi.SellerStore) => void;
}

export function StoreForm({ store, onSaved }: StoreFormProps) {
  const [storeName, setStoreName] = useState(store?.storeName ?? '');
  const [description, setDescription] = useState(store?.description ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNameError(null);
    setSubmitting(true);
    try {
      const input = { storeName, description: description || undefined };
      const res = store ? await sellerApi.updateStore(input) : await sellerApi.createStore(input);
      onSaved(res.store);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'STORE_NAME_TAKEN') {
        setNameError('Nama toko sudah digunakan penjual lain.');
      } else if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Gagal menyimpan toko.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{store ? 'Profil toko' : 'Buat toko'}</h2>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input
          label="Nama toko"
          name="storeName"
          required
          minLength={3}
          maxLength={50}
          value={storeName}
          onChange={(event) => setStoreName(event.target.value)}
          error={nameError ?? undefined}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="storeDescription" className="text-sm font-medium text-slate-700">
            Deskripsi
          </label>
          <textarea
            id="storeDescription"
            rows={3}
            maxLength={2000}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={submitting} className="w-fit">
          {submitting ? 'Menyimpan...' : store ? 'Simpan perubahan' : 'Buat toko'}
        </Button>
      </form>
    </Card>
  );
}
