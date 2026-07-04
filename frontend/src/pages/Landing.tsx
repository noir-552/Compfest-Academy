import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { listReviews, createReview, type Review } from '../api/reviews';
import { ApiClientError } from '../api/client';
import { DUMMY_PRODUCTS } from '../data/products';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';

function StarRatingInput({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Rating bintang" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} bintang`}
          onClick={() => onChange(n)}
          className={`text-2xl leading-none ${n <= value ? 'text-amber-400' : 'text-slate-300'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function Landing() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    listReviews()
      .then((res) => setReviews(res.reviews))
      .catch(() => setReviewsError('Gagal memuat ulasan.'))
      .finally(() => setLoadingReviews(false));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (rating < 1) {
      setFormError('Pilih rating bintang terlebih dahulu.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await createReview({ reviewerName: name, rating, comment });
      setReviews((prev) => [res.review, ...prev]);
      setName('');
      setRating(0);
      setComment('');
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : 'Gagal mengirim ulasan.');
    } finally {
      setSubmitting(false);
    }
  }

  const featured = DUMMY_PRODUCTS.slice(0, 4);

  return (
    <div className="flex flex-col gap-16 pb-16">
      <section className="bg-gradient-to-b from-teal-50 to-white px-4 py-16 text-center">
        <Badge tone="info" className="mx-auto mb-4 w-fit">
          Marketplace multi-toko
        </Badge>
        <h1 className="mx-auto max-w-2xl text-3xl font-bold text-slate-900 sm:text-4xl">
          SEAPEDIA — marketplace multi-toko untuk belanja dari banyak penjual sekaligus
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-500">
          Satu akun, ratusan toko independen. Temukan produk dari berbagai penjual, bandingkan pilihan, dan
          check-out dalam satu transaksi.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/catalog">
            <Button>Jelajahi katalog</Button>
          </Link>
          <Link to="/register">
            <Button variant="secondary">Buka toko / daftar</Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Produk unggulan</h2>
          <Link to="/catalog" className="text-sm font-medium text-teal-700">
            Lihat semua
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((product) => (
            <Link key={product.id} to={`/product/${product.id}`}>
              <Card className="h-full">
                <div className="mb-3 aspect-square w-full rounded-lg bg-slate-100" />
                <p className="text-xs font-medium text-teal-700">{product.storeName}</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-900">{product.name}</h3>
                <p className="mt-1 text-sm font-bold text-slate-900">Rp {product.price.toLocaleString('id-ID')}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4">
        <h2 className="mb-6 text-xl font-bold text-slate-900">Apa kata pengguna</h2>

        <div className="mb-8 flex flex-col gap-3">
          {loadingReviews && <p className="text-sm text-slate-500">Memuat ulasan...</p>}
          {reviewsError && <p className="text-sm text-red-600">{reviewsError}</p>}
          {!loadingReviews && !reviewsError && reviews.length === 0 && (
            <p className="text-sm text-slate-500">Belum ada ulasan. Jadilah yang pertama!</p>
          )}
          {reviews.map((review) => (
            <Card key={review.id}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">{review.reviewerName}</p>
                <span className="text-amber-400" aria-label={`${review.rating} dari 5 bintang`}>
                  {'★'.repeat(review.rating)}
                  {'☆'.repeat(5 - review.rating)}
                </span>
              </div>
              {/* Review text is rendered as a plain JSX text node — never dangerouslySetInnerHTML. */}
              <p className="mt-2 text-sm text-slate-600">{review.comment}</p>
            </Card>
          ))}
        </div>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Tulis ulasanmu</h3>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <Input
              label="Nama"
              name="reviewerName"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">Rating</span>
              <StarRatingInput value={rating} onChange={setRating} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="comment" className="text-sm font-medium text-slate-700">
                Komentar
              </label>
              <textarea
                id="comment"
                required
                rows={3}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            </div>
            {formError && (
              <p className="text-sm text-red-600" role="alert">
                {formError}
              </p>
            )}
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Mengirim...' : 'Kirim ulasan'}
            </Button>
          </form>
        </Card>
      </section>
    </div>
  );
}
