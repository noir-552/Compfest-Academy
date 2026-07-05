import { useEffect, useState } from 'react';

export interface ProductImageProps {
  imageUrl: string | null;
  name: string;
  className?: string;
}

/**
 * Renders a product's photo with `object-cover` + lazy loading, falling back
 * to the existing gray placeholder block (used across the app before real
 * photos existed) when `imageUrl` is null or the image fails to load.
 *
 * `className` controls sizing/aspect/radius (e.g. "aspect-square w-full
 * rounded-lg") and is applied to whichever of the two elements renders, so
 * callers get consistent layout regardless of image/placeholder state.
 */
export function ProductImage({ imageUrl, name, className = '' }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  // Table rows are keyed by product id, so a row's ProductImage instance is
  // reused across re-renders with a new imageUrl. Reset the fallback state
  // whenever the URL changes so a previous failure doesn't stick around.
  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  if (!imageUrl || failed) {
    return <div className={`bg-slate-100 ${className}`} aria-hidden="true" />;
  }

  return (
    <img
      src={imageUrl}
      alt={name}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
