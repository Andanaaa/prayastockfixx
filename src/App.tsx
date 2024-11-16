import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import StockPage from './pages/StockPage';
import AddItemPage from './pages/AddItemPage';
import IncomingPage from './pages/IncomingPage';
import ReturnPage from './pages/ReturnPage';
import SalesPage from './pages/SalesPage';
import ReportsPage from './pages/ReportsPage';
import BorrowPage from './pages/BorrowPage';
import PurchaseOrderPage from './pages/PurchaseOrderPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Navigate to="/stock" replace />} />
                    <Route path="/stock" element={<StockPage />} />
                    <Route path="/add" element={<AddItemPage />} />
                    <Route path="/purchase" element={<PurchaseOrderPage />} />
                    <Route path="/in" element={<IncomingPage />} />
                    <Route path="/return" element={<ReturnPage />} />
                    <Route path="/sales" element={<SalesPage />} />
                    <Route path="/borrow" element={<BorrowPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;