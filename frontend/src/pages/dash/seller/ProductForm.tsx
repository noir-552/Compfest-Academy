import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import * as sellerApi from '../../../api/seller';
import { ApiClientError } from '../../../api/client';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { ProductImage } from '../../../components/ProductImage';

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
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const res = await sellerApi.uploadProductImage(file);
      setImageUrl(res.url);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal mengunggah foto.');
    } finally {
      setUploading(false);
      // Reset so selecting the same file again (e.g. after a failed upload) still fires onChange.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

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

    const trimmedImageUrl = imageUrl.trim();
    if (
      trimmedImageUrl &&
      !trimmedImageUrl.startsWith('https://') &&
      !trimmedImageUrl.startsWith('http://') &&
      !(trimmedImageUrl.startsWith('/') && !trimmedImageUrl.startsWith('//'))
    ) {
      setError('URL gambar harus diawali dengan https://, http://, atau /.');
      return;
    }

    setSubmitting(true);
    try {
      const input = {
        name,
        description: description || undefined,
        price: priceNum,
        stock: stockNum,
        imageUrl: trimmedImageUrl || null,
      };
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
      <div className="flex flex-col gap-2">
        <label htmlFor="productPhotoUpload" className="text-sm font-medium text-slate-700">
          Upload foto (opsional)
        </label>
        <div className="flex items-center gap-3">
          <ProductImage
            imageUrl={imageUrl || null}
            name={name || 'Produk'}
            className="h-16 w-16 shrink-0 rounded-lg"
          />
          <input
            ref={fileInputRef}
            id="productPhotoUpload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-teal-700 hover:file:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
          />
          {uploading && (
            <span className="text-sm text-slate-500" role="status">
              Mengunggah...
            </span>
          )}
        </div>
      </div>
      <Input
        label="URL Gambar (opsional)"
        name="imageUrl"
        placeholder="/product-images/nama-produk.jpg"
        maxLength={500}
        value={imageUrl}
        onChange={(event) => setImageUrl(event.target.value)}
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
