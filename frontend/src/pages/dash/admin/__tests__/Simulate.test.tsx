import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { Simulate } from '../Simulate';

// Simulate depends only on the admin API. Mocking it lets this test drive the
// "advance a day + run the sweep" flow (including the rendered action log)
// without a real backend.
vi.mock('../../../../api/admin', async () => {
  const actual = await vi.importActual<typeof import('../../../../api/admin')>('../../../../api/admin');
  return {
    ...actual,
    getOverview: vi.fn(),
    simulateNextDay: vi.fn(),
  };
});

import * as adminApi from '../../../../api/admin';

const mockGetOverview = vi.mocked(adminApi.getOverview);
const mockSimulateNextDay = vi.mocked(adminApi.simulateNextDay);

const BASE_OVERVIEW: adminApi.AdminOverview = {
  virtualDate: '2026-07-05T00:00:00.000Z',
  counts: {
    users: 1,
    stores: 1,
    products: 1,
    ordersByStatus: {},
    vouchers: 0,
    promos: 0,
    jobsByStatus: {},
    overduePending: 0,
  },
};

function renderSimulate() {
  return render(
    <MemoryRouter>
      <Simulate />
    </MemoryRouter>,
  );
}

describe('Simulate', () => {
  beforeEach(() => {
    mockGetOverview.mockReset();
    mockSimulateNextDay.mockReset();
  });

  it('shows the current virtual date from the overview on load', async () => {
    mockGetOverview.mockResolvedValue(BASE_OVERVIEW);

    renderSimulate();

    expect(await screen.findByRole('button', { name: 'Simulasikan Hari Berikutnya' })).toBeInTheDocument();
    await waitFor(() => {
      expect(mockGetOverview).toHaveBeenCalledTimes(1);
    });
  });

  it('clicking the button calls simulateNextDay and renders the returned actions', async () => {
    mockGetOverview.mockResolvedValue(BASE_OVERVIEW);
    mockSimulateNextDay.mockResolvedValue({
      virtualDate: '2026-07-06T00:00:00.000Z',
      processed: [{ orderId: 'order-123abcde', actions: ['status → DIKEMBALIKAN', 'refund 50000'] }],
    });

    renderSimulate();
    const user = userEvent.setup();

    const button = await screen.findByRole('button', { name: 'Simulasikan Hari Berikutnya' });
    await user.click(button);

    expect(await screen.findByText('Pesanan #order-12')).toBeInTheDocument();
    expect(screen.getByText('status → DIKEMBALIKAN')).toBeInTheDocument();
    expect(screen.getByText('refund 50000')).toBeInTheDocument();
    expect(mockSimulateNextDay).toHaveBeenCalledTimes(1);
  });

  it('renders an empty-result message when the sweep processed nothing', async () => {
    mockGetOverview.mockResolvedValue(BASE_OVERVIEW);
    mockSimulateNextDay.mockResolvedValue({ virtualDate: '2026-07-06T00:00:00.000Z', processed: [] });

    renderSimulate();
    const user = userEvent.setup();

    const button = await screen.findByRole('button', { name: 'Simulasikan Hari Berikutnya' });
    await user.click(button);

    expect(await screen.findByText('Tidak ada pesanan yang diproses pada sweep ini.')).toBeInTheDocument();
  });
});
