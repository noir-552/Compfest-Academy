import { createBrowserRouter, RouterProvider, Outlet, Navigate } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { CartProvider } from './cart/CartContext';
import { RequireAuth } from './auth/RequireAuth';
import { RequireRole } from './auth/RequireRole';
import { Navbar } from './ui/Navbar';
import { Footer } from './ui/Footer';
import { Landing } from './pages/Landing';
import { Catalog } from './pages/Catalog';
import { ProductDetail } from './pages/ProductDetail';
import { StorePage } from './pages/StorePage';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { RolePicker } from './pages/RolePicker';
import { Profile } from './pages/Profile';
import { BuyerDash } from './pages/dash/BuyerDash';
import { Wallet } from './pages/dash/buyer/Wallet';
import { Addresses } from './pages/dash/buyer/Addresses';
import { Cart } from './pages/dash/buyer/Cart';
import { Checkout } from './pages/dash/buyer/Checkout';
import { Orders } from './pages/dash/buyer/Orders';
import { OrderDetail } from './pages/dash/buyer/OrderDetail';
import { Report as BuyerReport } from './pages/dash/buyer/Report';
import { SellerDash } from './pages/dash/SellerDash';
import { StoreOverview } from './pages/dash/seller/StoreOverview';
import { IncomingOrders } from './pages/dash/seller/IncomingOrders';
import { Report as SellerReport } from './pages/dash/seller/Report';
import { DriverDash } from './pages/dash/DriverDash';
import { AvailableJobs } from './pages/dash/driver/AvailableJobs';
import { MyJob } from './pages/dash/driver/MyJob';
import { History as DriverHistory } from './pages/dash/driver/History';
import { Earnings as DriverEarnings } from './pages/dash/driver/Earnings';
import { AdminDash } from './pages/dash/AdminDash';

function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/catalog', element: <Catalog /> },
      { path: '/product/:id', element: <ProductDetail /> },
      { path: '/stores/:id', element: <StorePage /> },
      { path: '/login', element: <Login /> },
      { path: '/register', element: <Register /> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/select-role', element: <RolePicker /> },
          { path: '/profile', element: <Profile /> },
          {
            element: <RequireRole role="BUYER" />,
            children: [
              {
                path: '/dashboard/buyer',
                element: <BuyerDash />,
                children: [
                  { index: true, element: <Navigate to="wallet" replace /> },
                  { path: 'wallet', element: <Wallet /> },
                  { path: 'addresses', element: <Addresses /> },
                  { path: 'cart', element: <Cart /> },
                  { path: 'checkout', element: <Checkout /> },
                  { path: 'orders', element: <Orders /> },
                  { path: 'orders/:id', element: <OrderDetail /> },
                  { path: 'report', element: <BuyerReport /> },
                ],
              },
            ],
          },
          {
            element: <RequireRole role="SELLER" />,
            children: [
              {
                path: '/dashboard/seller',
                element: <SellerDash />,
                children: [
                  { index: true, element: <Navigate to="store" replace /> },
                  { path: 'store', element: <StoreOverview /> },
                  { path: 'orders', element: <IncomingOrders /> },
                  { path: 'report', element: <SellerReport /> },
                ],
              },
            ],
          },
          {
            element: <RequireRole role="DRIVER" />,
            children: [
              {
                path: '/dashboard/driver',
                element: <DriverDash />,
                children: [
                  { index: true, element: <Navigate to="available" replace /> },
                  { path: 'available', element: <AvailableJobs /> },
                  { path: 'mine', element: <MyJob /> },
                  { path: 'history', element: <DriverHistory /> },
                  { path: 'earnings', element: <DriverEarnings /> },
                ],
              },
            ],
          },
          {
            element: <RequireRole role="ADMIN" />,
            children: [{ path: '/dashboard/admin', element: <AdminDash /> }],
          },
        ],
      },
      {
        path: '*',
        element: (
          <div className="mx-auto max-w-md px-4 py-24 text-center">
            <h1 className="text-xl font-semibold text-slate-900">Halaman tidak ditemukan</h1>
          </div>
        ),
      },
    ],
  },
]);

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <RouterProvider router={router} />
      </CartProvider>
    </AuthProvider>
  );
}
