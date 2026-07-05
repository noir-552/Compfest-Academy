import { apiFetch } from './client';

// Authenticated driver-only reads/writes. Mirrors
// backend/src/services/delivery.service.ts and backend/src/routes/driver.routes.ts.

export interface DriverOrderSummary {
  id: string;
  storeName: string;
  deliveryMethod: string;
  deliveryFee: number;
  fullAddressSnapshot: string;
  recipientNameSnapshot: string;
  itemCount: number;
}

export interface DriverJob {
  id: string;
  status: string;
  driverEarning: number;
  takenAt: string | null;
  completedAt: string | null;
  createdAt: string;
  order: DriverOrderSummary;
}

export interface DriverMine {
  active: DriverJob | null;
  history: DriverJob[];
}

export interface DriverEarningLine {
  id: string;
  orderId: string;
  driverEarning: number;
  completedAt: string | null;
}

export interface DriverEarnings {
  totalEarnings: number;
  completedCount: number;
  jobs: DriverEarningLine[];
}

export function listAvailableJobs(): Promise<{ jobs: DriverJob[] }> {
  return apiFetch<{ jobs: DriverJob[] }>('/driver/jobs/available');
}

export function getMyJobs(): Promise<DriverMine> {
  return apiFetch<DriverMine>('/driver/jobs/mine');
}

export function getJobDetail(id: string): Promise<{ job: DriverJob }> {
  return apiFetch<{ job: DriverJob }>(`/driver/jobs/${id}`);
}

export function takeJob(id: string): Promise<{ job: DriverJob }> {
  return apiFetch<{ job: DriverJob }>(`/driver/jobs/${id}/take`, { method: 'POST' });
}

export function completeJob(id: string): Promise<{ job: DriverJob }> {
  return apiFetch<{ job: DriverJob }>(`/driver/jobs/${id}/complete`, { method: 'POST' });
}

export function getEarnings(): Promise<DriverEarnings> {
  return apiFetch<DriverEarnings>('/driver/earnings');
}
