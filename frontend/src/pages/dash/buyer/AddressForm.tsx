import { useState, type FormEvent } from 'react';
import * as buyerApi from '../../../api/buyer';
import { ApiClientError } from '../../../api/client';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';

export interface AddressFormProps {
  address: buyerApi.Address | null;
  onSaved: (address: buyerApi.Address) => void;
  onCancel: () => void;
}

export function AddressForm({ address, onSaved, onCancel }: AddressFormProps) {
  const [label, setLabel] = useState(address?.label ?? '');
  const [recipientName, setRecipientName] = useState(address?.recipientName ?? '');
  const [phone, setPhone] = useState(address?.phone ?? '');
  const [fullAddress, setFullAddress] = useState(address?.fullAddress ?? '');
  const [isDefault, setIsDefault] = useState(address?.isDefault ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!/^\d{8,15}$/.test(phone)) {
      setError('Nomor telepon harus terdiri dari 8-15 digit angka.');
      return;
    }

    setSubmitting(true);
    try {
      const input = { label, recipientName, phone, fullAddress, isDefault };
      const res = address ? await buyerApi.updateAddress(address.id, input) : await buyerApi.createAddress(input);
      onSaved(res.address);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal menyimpan alamat.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <Input
        label="Label"
        name="label"
        required
        maxLength={50}
        placeholder="Rumah, Kantor, dll."
        value={label}
        onChange={(event) => setLabel(event.target.value)}
      />
      <Input
        label="Nama penerima"
        name="recipientName"
        required
        maxLength={100}
        value={recipientName}
        onChange={(event) => setRecipientName(event.target.value)}
      />
      <Input
        label="Nomor telepon"
        name="phone"
        required
        placeholder="081234567890"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="fullAddress" className="text-sm font-medium text-slate-700">
          Alamat lengkap
        </label>
        <textarea
          id="fullAddress"
          rows={3}
          maxLength={500}
          required
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          value={fullAddress}
          onChange={(event) => setFullAddress(event.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(event) => setIsDefault(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        Jadikan alamat utama
      </label>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Batal
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Menyimpan...' : 'Simpan'}
        </Button>
      </div>
    </form>
  );
}
