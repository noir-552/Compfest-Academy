import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductForm } from '../ProductForm';
import { ApiClientError } from '../../../../api/client';

// ProductForm's file-upload flow depends only on sellerApi.uploadProductImage.
// Mocking it lets this test drive "select a file -> imageUrl field fills in"
// (and the inline-error path) without a real backend.
vi.mock('../../../../api/seller', async () => {
  const actual = await vi.importActual<typeof import('../../../../api/seller')>('../../../../api/seller');
  return {
    ...actual,
    uploadProductImage: vi.fn(),
  };
});

import * as sellerApi from '../../../../api/seller';

const mockUploadProductImage = vi.mocked(sellerApi.uploadProductImage);

function makeFile(name = 'photo.png', type = 'image/png') {
  return new File(['fake-image-bytes'], name, { type });
}

describe('ProductForm photo upload', () => {
  beforeEach(() => {
    mockUploadProductImage.mockReset();
  });

  it('uploads the selected file and fills the imageUrl field with the returned url', async () => {
    mockUploadProductImage.mockResolvedValue({ url: '/api/uploads/abc-123.png' });

    render(<ProductForm product={null} onSaved={vi.fn()} onCancel={vi.fn()} />);
    const user = userEvent.setup();

    const fileInput = screen.getByLabelText('Upload foto (opsional)') as HTMLInputElement;
    await user.upload(fileInput, makeFile());

    await waitFor(() => {
      expect(screen.getByDisplayValue('/api/uploads/abc-123.png')).toBeInTheDocument();
    });
    expect(mockUploadProductImage).toHaveBeenCalledTimes(1);
  });

  it('shows the envelope error message inline when the upload is rejected (e.g. too large / invalid type)', async () => {
    mockUploadProductImage.mockRejectedValue(new ApiClientError(400, 'INVALID_IMAGE', 'File must be a JPEG, PNG, or WebP image'));

    render(<ProductForm product={null} onSaved={vi.fn()} onCancel={vi.fn()} />);
    const user = userEvent.setup();

    const fileInput = screen.getByLabelText('Upload foto (opsional)') as HTMLInputElement;
    await user.upload(fileInput, makeFile());

    expect(await screen.findByRole('alert')).toHaveTextContent('File must be a JPEG, PNG, or WebP image');
  });
});
