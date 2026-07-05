import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { listReviews, createReview, type Review } from '../api/reviews';
import { listProducts, type PublicProduct } from '../api/catalog';
import { ApiClientError } from '../api/client';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';

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
          className={`text-2xl leading-none transition-colors duration-150 ${n <= value ? 'text-amber-400' : 'text-slate-300'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

const ROLE_STEPS = [
  {
    role: 'Penjual',
    title: 'Buka toko, kelola produk',
    body: 'Buat toko, unggah produk, dan pantau setiap pesanan masuk sampai siap dikirim.',
    icon: (
      <path
        d="M4 10l1-5h14l1 5M4 10v9a1 1 0 001 1h4v-6h6v6h4a1 1 0 001-1v-9M4 10h16"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    role: 'Pembeli',
    title: 'Belanja, bayar, lacak',
    body: 'Jelajahi katalog lintas toko, checkout dari satu toko sekaligus, bayar dari wallet, lalu lacak status pesanan.',
    icon: (
      <path
        d="M6 6h15l-1.5 9h-12L6 6zm0 0L5 3H2m4 3l1.5 9M9 20a1 1 0 100-2 1 1 0 000 2zm9 0a1 1 0 100-2 1 1 0 000 2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    role: 'Kurir',
    title: 'Ambil job, antar, selesai',
    body: 'Pilih job pengiriman yang tersedia, antarkan pesanan, dan konfirmasi selesai untuk mencatat pendapatan.',
    icon: (
      <path
        d="M3 7h11v8H3V7zm11 3h4l3 3v2h-7v-5zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm11 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

export function Landing() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  const [featured, setFeatured] = useState<PublicProduct[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [featuredError, setFeaturedError] = useState<string | null>(null);

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

  useEffect(() => {
    listProducts()
      .then((res) => setFeatured(res.products.slice(0, 4)))
      .catch(() => setFeaturedError('Gagal memuat produk unggulan.'))
      .finally(() => setLoadingFeatured(false));
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

  return (
    <div className="flex flex-col gap-20 pb-20">
      <section className="bg-slate-50 px-4 py-16 sm:py-20">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center motion-safe:animate-[fade-in_500ms_ease-out]">
          <h1 className="max-w-3xl text-[clamp(2rem,5vw,3.5rem)] leading-[1.1] font-extrabold text-slate-900">
            Satu marketplace yang menghubungkan penjual, pembeli, dan kurir
          </h1>
          <p className="max-w-xl text-lg text-slate-600">
            SEAPEDIA menyatukan ratusan toko independen, pembeli yang berbelanja lintas toko, dan kurir yang
            mengantarkannya — dalam satu alur yang jelas dari keranjang sampai tujuan.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/catalog">
              <Button>Jelajahi katalog</Button>
            </Link>
            <Link to="/register">
              <Button variant="secondary">Buka toko / daftar</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-slate-900">Produk unggulan</h2>
          <Link to="/catalog" className="text-sm font-medium text-teal-700 hover:text-teal-800">
            Lihat semua →
          </Link>
        </div>

        {loadingFeatured && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <Skeleton className="mb-3 aspect-square w-full" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-2 h-4 w-32" />
                <Skeleton className="mt-2 h-4 w-20" />
              </Card>
            ))}
          </div>
        )}
        {featuredError && (
          <p className="text-sm text-red-600" role="alert">
            {featuredError}
          </p>
        )}
        {!loadingFeatured && !featuredError && featured.length === 0 && (
          <Card>
            <EmptyState heading="Belum ada produk" teachLine="Jadilah penjual pertama di SEAPEDIA." />
          </Card>
        )}
        {!loadingFeatured && !featuredError && featured.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
            {featured.map((product) => (
              <Link key={product.id} to={`/product/${product.id}`}>
                <Card className="h-full transition-shadow duration-150 hover:shadow-md">
                  <div className="mb-3 aspect-square w-full rounded-lg bg-slate-100" />
                  <p className="text-xs font-medium text-teal-700">{product.store.storeName}</p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900">{product.name}</h3>
                  <p className="tabular mt-1 text-sm font-bold text-slate-900">Rp{product.price.toLocaleString('id-ID')}</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="bg-slate-50 py-16">
        <div className="mx-auto w-full max-w-6xl px-4">
          <h2 className="mb-10 text-center text-2xl font-bold text-slate-900">Tiga peran, satu alur</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {ROLE_STEPS.map((step, index) => (
              <div key={step.role} className="flex flex-col items-center gap-3 text-center">
                <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
                    {step.icon}
                  </svg>
                  <span className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white ring-2 ring-slate-50">
                    {index + 1}
                  </span>
                </span>
                <p className="text-sm font-semibold text-teal-700">{step.role}</p>
                <h3 className="text-base font-semibold text-slate-900">{step.title}</h3>
                <p className="max-w-xs text-sm text-slate-500">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4">
        <h2 className="mb-6 text-2xl font-bold text-slate-900">Apa kata pengguna</h2>

        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {loadingReviews &&
            Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-3 h-3 w-full" />
                <Skeleton className="mt-2 h-3 w-3/4" />
              </Card>
            ))}
          {reviewsError && <p className="text-sm text-red-600">{reviewsError}</p>}
          {!loadingReviews && !reviewsError && reviews.length === 0 && (
            <Card className="sm:col-span-2">
              <EmptyState heading="Belum ada ulasan" teachLine="Jadilah yang pertama membagikan pengalamanmu." />
            </Card>
          )}
          {reviews.map((review) => (
            <Card key={review.id}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{review.reviewerName}</p>
                <span className="flex-shrink-0 text-amber-400" aria-label={`${review.rating} dari 5 bintang`}>
                  {'★'.repeat(review.rating)}
                  {'☆'.repeat(5 - review.rating)}
                </span>
              </div>
              {/* Review text is rendered as a plain JSX text node — never dangerouslySetInnerHTML. */}
              <p className="mt-2 text-sm text-slate-600">{review.comment}</p>
            </Card>
          ))}
        </div>

        <Card title="Tulis ulasanmu">
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
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition duration-150 ease-out placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            </div>
            {formError && (
              <p className="text-sm text-red-600" role="alert">
                {formError}
              </p>
            )}
            <Button type="submit" loading={submitting} className="self-start">
              {submitting ? 'Mengirim...' : 'Kirim ulasan'}
            </Button>
          </form>
        </Card>
      </section>
    </div>
  );
}
