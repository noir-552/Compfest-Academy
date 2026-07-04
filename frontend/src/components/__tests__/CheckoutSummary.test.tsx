import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CheckoutSummary } from '../CheckoutSummary';

describe('CheckoutSummary', () => {
  it('renders exact rupiah strings for each row given the totals breakdown', () => {
    render(
      <CheckoutSummary subtotal={100000} discountAmount={0} deliveryFee={10000} ppnAmount={12000} finalTotal={122000} />,
    );

    expect(screen.getByText('Rp100.000')).toBeInTheDocument();
    expect(screen.getByText('Rp0')).toBeInTheDocument();
    expect(screen.getByText('Rp10.000')).toBeInTheDocument();
    expect(screen.getByText('Rp12.000')).toBeInTheDocument();
    expect(screen.getByText('Rp122.000')).toBeInTheDocument();
  });

  it('labels each row with the expected Indonesian text', () => {
    render(
      <CheckoutSummary subtotal={100000} discountAmount={5000} deliveryFee={10000} ppnAmount={11400} finalTotal={116400} />,
    );

    expect(screen.getByText('Subtotal')).toBeInTheDocument();
    expect(screen.getByText('Diskon')).toBeInTheDocument();
    expect(screen.getByText('Ongkir')).toBeInTheDocument();
    expect(screen.getByText('PPN 12%')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Rp5.000')).toBeInTheDocument();
    expect(screen.getByText('Rp11.400')).toBeInTheDocument();
    expect(screen.getByText('Rp116.400')).toBeInTheDocument();
  });
});
