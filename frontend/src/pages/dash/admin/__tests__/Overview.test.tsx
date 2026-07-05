import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { Overview } from '../Overview';

// Overview depends only on the admin API. Mocking it lets this test assert
// that the stat cards and status breakdowns render the counts returned by
// the backend, without a real server.
vi.mock('../../../../api/admin', async () => {
  const actual = await vi.importActual<typeof import('../../../../api/admin')>('../../../../api/admin');
  return {
    ...actual,
    getOverview: vi.fn(),
  };
});

import * as adminApi from '../../../../api/admin';

const mockGetOverview = vi.mocked(adminApi.getOverview);

const OVERVIEW: adminApi.AdminOverview = {
  virtualDate: '2026-07-05T00:00:00.000Z',
  counts: {
    users: 7,
    stores: 3,
    products: 12,
    ordersByStatus: {
      SEDANG_DIKEMAS: 2,
      MENUNGGU_PENGIRIM: 1,
      SEDANG_DIKIRIM: 0,
      PESANAN_SELESAI: 4,
      DIKEMBALIKAN: 1,
    },
    vouchers: 5,
    promos: 2,
    jobsByStatus: { AVAILABLE: 1, TAKEN: 1, COMPLETED: 4, CANCELLED: 1 },
    overduePending: 1,
  },
};

function renderOverview() {
  return render(
    <MemoryRouter>
      <Overview />
    </MemoryRouter>,
  );
}

describe('Overview', () => {
  beforeEach(() => {
    mockGetOverview.mockReset();
  });

  it('renders entity counts from the API', async () => {
    mockGetOverview.mockResolvedValue(OVERVIEW);

    renderOverview();

    expect(await screen.findByText('7')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders order and job status breakdowns from the API', async () => {
    mockGetOverview.mockResolvedValue(OVERVIEW);

    renderOverview();

    expect(await screen.findByText('Sedang Dikemas')).toBeInTheDocument();
    expect(screen.getByText('Pesanan Selesai')).toBeInTheDocument();
    expect(screen.getByText('Tersedia')).toBeInTheDocument();
    expect(screen.getByText('Selesai')).toBeInTheDocument();
  });

  it('shows an error message when the load fails', async () => {
    mockGetOverview.mockRejectedValue(new Error('boom'));

    renderOverview();

    expect(await screen.findByText('Gagal memuat ringkasan.')).toBeInTheDocument();
  });
});
