import { useEffect, useState } from 'react';
import * as sellerApi from '../../../api/seller';
import { ApiClientError } from '../../../api/client';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';
import { Modal } from '../../../ui/Modal';
import { Table, type TableColumn } from '../../../ui/Table';
import { ProductForm } from './ProductForm';

type ModalState =
  | { mode: 'create' }
  | { mode: 'edit'; product: sellerApi.SellerProduct }
  | { mode: 'delete'; product: sellerApi.SellerProduct }
  | null;

export function ProductList() {
  const [products, setProducts] = useState<sellerApi.SellerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    setError(null);
    sellerApi
      .listOwnProducts()
      .then((res) => setProducts(res.products))
      .catch(() => setError('Gagal memuat produk.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  function handleSaved(product: sellerApi.SellerProduct) {
    setModal(null);
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      return exists ? prev.map((p) => (p.id === product.id ? product : p)) : [product, ...prev];
    });
  }

  async function handleDelete() {
    if (!modal || modal.mode !== 'delete') return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await sellerApi.deleteProduct(modal.product.id);
      setProducts((prev) => prev.filter((p) => p.id !== modal.product.id));
      setModal(null);
    } catch (err) {
      setDeleteError(err instanceof ApiClientError ? err.message : 'Gagal menghapus produk.');
    } finally {
      setDeleting(false);
    }
  }

  const columns: TableColumn<sellerApi.SellerProduct>[] = [
    { key: 'name', header: 'Nama', render: (p) => p.name },
    { key: 'price', header: 'Harga', render: (p) => `Rp ${p.price.toLocaleString('id-ID')}` },
    { key: 'stock', header: 'Stok', render: (p) => p.stock },
    {
      key: 'actions',
      header: '',
      render: (p) => (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModal({ mode: 'edit', product: p })}>
            Ubah
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setDeleteError(null);
              setModal({ mode: 'delete', product: p });
            }}
          >
            Hapus
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Produk</h2>
        <Button onClick={() => setModal({ mode: 'create' })}>Tambah produk</Button>
      </div>

      {loading && <p className="text-sm text-slate-500">Memuat produk...</p>}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && (
        <Table columns={columns} rows={products} rowKey={(p) => p.id} emptyMessage="Belum ada produk." />
      )}

      <Modal
        open={modal?.mode === 'create' || modal?.mode === 'edit'}
        onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Ubah produk' : 'Tambah produk'}
      >
        {(modal?.mode === 'create' || modal?.mode === 'edit') && (
          <ProductForm
            product={modal.mode === 'edit' ? modal.product : null}
            onSaved={handleSaved}
            onCancel={() => setModal(null)}
          />
        )}
      </Modal>

      <Modal open={modal?.mode === 'delete'} onClose={() => setModal(null)} title="Hapus produk">
        {modal?.mode === 'delete' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-600">
              Yakin ingin menghapus <span className="font-semibold">{modal.product.name}</span>? Tindakan ini
              tidak dapat dibatalkan.
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
    </Card>
  );
}
