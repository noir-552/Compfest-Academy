import { useEffect, useState } from 'react';
import * as buyerApi from '../../../api/buyer';
import { ApiClientError } from '../../../api/client';
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';
import { Modal } from '../../../ui/Modal';
import { AddressForm } from './AddressForm';

type ModalState =
  | { mode: 'create' }
  | { mode: 'edit'; address: buyerApi.Address }
  | { mode: 'delete'; address: buyerApi.Address }
  | null;

export function Addresses() {
  const [addresses, setAddresses] = useState<buyerApi.Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    setError(null);
    buyerApi
      .listAddresses()
      .then((res) => setAddresses(res.addresses))
      .catch(() => setError('Gagal memuat alamat.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  function handleSaved(address: buyerApi.Address) {
    setModal(null);
    setAddresses((prev) => {
      const exists = prev.some((a) => a.id === address.id);
      const next = exists ? prev.map((a) => (a.id === address.id ? address : a)) : [address, ...prev];
      // If the saved address became default, un-default the others locally
      // so the UI reflects the single-default invariant immediately.
      return address.isDefault ? next.map((a) => (a.id === address.id ? a : { ...a, isDefault: false })) : next;
    });
  }

  async function handleDelete() {
    if (!modal || modal.mode !== 'delete') return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await buyerApi.deleteAddress(modal.address.id);
      setAddresses((prev) => prev.filter((a) => a.id !== modal.address.id));
      setModal(null);
    } catch (err) {
      setDeleteError(err instanceof ApiClientError ? err.message : 'Gagal menghapus alamat.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Alamat</h1>
        <Button onClick={() => setModal({ mode: 'create' })}>Tambah alamat</Button>
      </div>

      {loading && (
        <Card>
          <p className="text-sm text-slate-500">Memuat alamat...</p>
        </Card>
      )}
      {error && (
        <Card>
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        </Card>
      )}

      {!loading && !error && addresses.length === 0 && (
        <Card>
          <p className="text-sm text-slate-500">Belum ada alamat tersimpan.</p>
        </Card>
      )}

      {!loading && !error && addresses.length > 0 && (
        <div className="flex flex-col gap-3">
          {addresses.map((address) => (
            <Card key={address.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{address.label}</p>
                    {address.isDefault && <Badge tone="info">Utama</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-slate-700">
                    {address.recipientName} · {address.phone}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{address.fullAddress}</p>
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  <Button variant="secondary" onClick={() => setModal({ mode: 'edit', address })}>
                    Ubah
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setDeleteError(null);
                      setModal({ mode: 'delete', address });
                    }}
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modal?.mode === 'create' || modal?.mode === 'edit'}
        onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Ubah alamat' : 'Tambah alamat'}
      >
        {(modal?.mode === 'create' || modal?.mode === 'edit') && (
          <AddressForm
            address={modal.mode === 'edit' ? modal.address : null}
            onSaved={handleSaved}
            onCancel={() => setModal(null)}
          />
        )}
      </Modal>

      <Modal open={modal?.mode === 'delete'} onClose={() => setModal(null)} title="Hapus alamat">
        {modal?.mode === 'delete' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-600">
              Yakin ingin menghapus alamat <span className="font-semibold">{modal.address.label}</span>? Tindakan
              ini tidak dapat dibatalkan.
            </p>
            {deleteError && (
              <p className="text-sm text-red-600" role="alert">
                {deleteError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setModal(null)}>
                Batal
              </Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Menghapus...' : 'Hapus'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
