import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProductImage } from '../ProductImage';

describe('ProductImage', () => {
  it('falls back to the placeholder when the image fails to load, then recovers when the imageUrl prop changes', () => {
    const { rerender } = render(
      <ProductImage imageUrl="/broken.jpg" name="Kopi Susu" className="aspect-square" />,
    );

    const img = screen.getByAltText('Kopi Susu');
    fireEvent.error(img);

    // After the error, the placeholder renders instead of the <img>.
    expect(screen.queryByAltText('Kopi Susu')).not.toBeInTheDocument();

    // Reusing the same component instance (as Table rows keyed by product id
    // do) with a new imageUrl must clear the stale `failed` state instead of
    // sticking on the placeholder forever.
    rerender(<ProductImage imageUrl="/new-photo.jpg" name="Kopi Susu" className="aspect-square" />);

    expect(screen.getByAltText('Kopi Susu')).toBeInTheDocument();
  });
});
