import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AvailableJobs } from '../AvailableJobs';
import { ApiClientError } from '../../../../api/client';

// AvailableJobs depends only on the driver API. Mocking it lets this test
// drive the "take" flow (including the 409 JOB_ALREADY_TAKEN refresh) without
// a real backend.
vi.mock('../../../../api/driver', async () => {
  const actual = await vi.importActual<typeof import('../../../../api/driver')>('../../../../api/driver');
  return {
    ...actual,
    listAvailableJobs: vi.fn(),
    takeJob: vi.fn(),
  };
});

import * as driverApi from '../../../../api/driver';

const mockListAvailableJobs = vi.mocked(driverApi.listAvailableJobs);
const mockTakeJob = vi.mocked(driverApi.takeJob);

const JOB: driverApi.DriverJob = {
  id: 'job-1',
  status: 'AVAILABLE',
  driverEarning: 0,
  takenAt: null,
  completedAt: null,
  createdAt: '2026-07-04T10:00:00.000Z',
  order: {
    id: 'order-1',
    storeName: 'Toko Kopi',
    deliveryMethod: 'REGULAR',
    deliveryFee: 10000,
    fullAddressSnapshot: 'Jl. Contoh No 1',
    recipientNameSnapshot: 'Budi',
    itemCount: 3,
  },
};

function renderAvailableJobs() {
  return render(
    <MemoryRouter>
      <AvailableJobs />
    </MemoryRouter>,
  );
}

describe('AvailableJobs', () => {
  beforeEach(() => {
    mockListAvailableJobs.mockReset();
    mockTakeJob.mockReset();
  });

  it('renders jobs from the API', async () => {
    mockListAvailableJobs.mockResolvedValue({ jobs: [JOB] });

    renderAvailableJobs();

    expect(await screen.findByText('Toko Kopi')).toBeInTheDocument();
    expect(screen.getByText('Jl. Contoh No 1')).toBeInTheDocument();
    expect(screen.getByText('Budi')).toBeInTheDocument();
    expect(screen.getByText('Rp10.000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ambil Job' })).toBeInTheDocument();
  });

  it('on 409 JOB_ALREADY_TAKEN, refreshes the list and the job disappears', async () => {
    mockListAvailableJobs.mockResolvedValueOnce({ jobs: [JOB] }).mockResolvedValueOnce({ jobs: [] });
    mockTakeJob.mockRejectedValue(new ApiClientError(409, 'JOB_ALREADY_TAKEN', 'This job has already been taken'));

    renderAvailableJobs();
    const user = userEvent.setup();

    await screen.findByText('Toko Kopi');
    await user.click(screen.getByRole('button', { name: 'Ambil Job' }));

    await waitFor(() => {
      expect(screen.getByText('This job has already been taken')).toBeInTheDocument();
    });
    expect(mockTakeJob).toHaveBeenCalledWith('job-1');
    expect(mockListAvailableJobs).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Toko Kopi')).not.toBeInTheDocument();
  });
});
