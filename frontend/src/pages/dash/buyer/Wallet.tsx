import { useEffect, useState, type FormEvent } from 'react';
import * as buyerApi from '../../../api/buyer';
import { ApiClientError } from '../../../api/client';
import { formatRupiah } from '../../../lib/format';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';
import { Input } from '../../../ui/Input';
import { Table, type TableColumn } from '../../../ui/Table';

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export function Wallet() {
  const [wallet, setWallet] = useState<buyerApi.Wallet | null>(null);
  const [transactions, setTransactions] = useState<buyerApi.WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [topupError, setTopupError] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    setError(null);
    buyerApi
      .getWallet()
      .then((res) => {
        setWallet(res.wallet);
        setTransactions(res.transactions);
      })
      .catch(() => setError('Gagal memuat dompet.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleTopup(event: FormEvent) {
    event.preventDefault();
    setTopupError(null);

    const value = Number(amount);
    if (!Number.isInteger(value) || value < 1 || value > 100_000_000) {
      setTopupError('Jumlah top-up harus bilangan bulat antara 1 dan 100.000.000.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await buyerApi.topupWallet(value);
      setWallet(res.wallet);
      setTransactions(res.transactions);
      setAmount('');
    } catch (err) {
      setTopupError(err instanceof ApiClientError ? err.message : 'Gagal melakukan top-up.');
    } finally {
      setSubmitting(false);
    }
  }

  const columns: TableColumn<buyerApi.WalletTransaction>[] = [
    { key: 'createdAt', header: 'Tanggal', render: (tx) => formatTimestamp(tx.createdAt) },
    { key: 'type', header: 'Jenis', render: (tx) => (tx.type === 'TOPUP' ? 'Top-up' : 'Pembayaran') },
    {
      key: 'amount',
      header: 'Jumlah',
      render: (tx) => {
        const isCharge = tx.type === 'CHECKOUT_CHARGE';
        return (
          <span className={isCharge ? 'font-medium text-red-600' : 'font-medium text-emerald-600'}>
            {isCharge ? '-' : '+'}
            {formatRupiah(tx.amount)}
          </span>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">Dompet</h1>

      {loading && (
        <Card>
          <p className="text-sm text-slate-500">Memuat dompet...</p>
        </Card>
      )}
      {error && (
        <Card>
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        </Card>
      )}

      {!loading && !error && wallet && (
        <>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Saldo</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{formatRupiah(wallet.balance)}</p>
          </Card>

          <Card>
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Top-up saldo</h2>
            <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={handleTopup}>
              <div className="flex-1">
                <Input
                  label="Jumlah (Rp)"
                  name="amount"
                  type="number"
                  min={1}
                  max={100_000_000}
                  step={1}
                  required
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Memproses...' : 'Top-up'}
              </Button>
            </form>
            {topupError && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {topupError}
              </p>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Riwayat transaksi</h2>
            <Table
              columns={columns}
              rows={transactions}
              rowKey={(tx) => tx.id}
              emptyMessage="Belum ada transaksi."
            />
          </Card>
        </>
      )}
    </div>
  );
}
