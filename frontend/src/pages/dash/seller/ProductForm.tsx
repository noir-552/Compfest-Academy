import { useState, type FormEvent } from 'react';
import * as sellerApi from '../../../api/seller';
import { ApiClientError } from '../../../api/client';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';

export interface ProductFormProps {
  product: sellerApi.SellerProduct | null;
  onSaved: (product: sellerApi.SellerProduct) => void;
  onCancel: () => void;
}

export function ProductForm({ product, onSaved, onCancel }: ProductFormProps) {
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [stock, setStock] = useState(product ? String(product.stock) : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const priceNum = Number(price);
    const stockNum = Number(stock);
    if (!Number.isInteger(priceNum) || priceNum < 0) {
      setError('Harga harus berupa bilangan bulat 0 atau lebih.');
      return;
    }
    if (!Number.isInteger(stockNum) || stockNum < 0) {
      setError('Stok harus berupa bilangan bulat 0 atau lebih.');
      return;
    }

    setSubmitting(true);
    try {
      const input = { name, description: description || undefined, price: priceNum, stock: stockNum };
      const res = product
        ? await sellerApi.updateProduct(product.id, input)
        : await sellerApi.createProduct(input);
      onSaved(res.product);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal menyimpan produk.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <Input
        label="Nama produk"
        name="name"
        required
        maxLength={100}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="productDescription" className="text-sm font-medium text-slate-700">
          Deskripsi
        </label>
        <textarea
          id="productDescription"
          rows={3}
          maxLength={2000}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <Input
        label="Harga (Rp)"
        name="price"
        type="number"
        min={0}
        step={1}
        required
        value={price}
        onChange={(event) => setPrice(event.target.value)}
      />
      <Input
        label="Stok"
        name="stock"
        type="number"
        min={0}
        step={1}
        required
        value={stock}
        onChange={(event) => setStock(event.target.value)}
      />
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
