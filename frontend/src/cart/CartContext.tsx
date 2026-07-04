import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import * as buyerApi from '../api/buyer';

export interface CartContextValue {
  /** Total quantity across all cart items; 0 when signed out or not acting as BUYER. */
  itemCount: number;
  /** Re-fetches the cart to refresh `itemCount`. Call after any cart mutation. */
  refreshCart: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

/**
 * Tracks the buyer's cart item count so the Navbar badge stays in sync
 * across pages without every page needing to know about the Navbar.
 * Fetches only when signed in with an active BUYER role.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { user, activeRole } = useAuth();
  const [itemCount, setItemCount] = useState(0);

  const refreshCart = useCallback(() => {
    if (!user || activeRole !== 'BUYER') {
      setItemCount(0);
      return;
    }
    buyerApi
      .getCart()
      .then((res) => setItemCount(res.cart.items.reduce((sum, item) => sum + item.quantity, 0)))
      .catch(() => setItemCount(0));
  }, [user, activeRole]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  return <CartContext.Provider value={{ itemCount, refreshCart }}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
