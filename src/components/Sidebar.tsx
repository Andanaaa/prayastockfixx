import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Package, 
  PackagePlus, 
  PackageCheck, 
  PackageX, 
  ShoppingCart,
  FileText,
  Share2,
  ShoppingBag,
  X
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const menuItems = [
    { icon: <Package size={20} />, title: 'Daftar Stock', description: 'Lihat dan kelola semua stock barang', path: '/stock' },
    { icon: <PackagePlus size={20} />, title: 'Tambah Barang', description: 'Tambah barang baru ke inventory', path: '/add' },
    { icon: <ShoppingBag size={20} />, title: 'Order Pembelian', description: 'Kelola pembelian barang', path: '/purchase' },
    { icon: <PackageCheck size={20} />, title: 'Barang Masuk', description: 'Catat barang yang baru masuk', path: '/in' },
    { icon: <PackageX size={20} />, title: 'Barang Kembali', description: 'Kelola pengembalian barang', path: '/return' },
    { icon: <ShoppingCart size={20} />, title: 'Penjualan', description: 'Catat barang keluar dan penjualan', path: '/sales' },
    { icon: <Share2 size={20} />, title: 'Barang Pinjam', description: 'Kelola peminjaman barang', path: '/borrow' },
    { icon: <FileText size={20} />, title: 'Laporan', description: 'Lihat laporan dan analisis', path: '/reports' },
  ];

  return (
    <div className={`${isOpen ? 'translate-x-0' : '-translate-x-full'} fixed lg:relative lg:translate-x-0 z-30 transition-transform duration-300 ease-in-out bg-white border-r border-gray-200 w-72 min-h-screen`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Inventory Praya</h1>
          <button 
            onClick={onClose}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>
        <nav className="space-y-2">
          {menuItems.map((item, index) => (
            <NavLink
              key={index}
              to={item.path}
              className={({ isActive }) => 
                `flex items-center gap-4 px-4 py-3 rounded-lg transition-colors duration-200 ${
                  isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={isActive ? 'text-blue-500' : 'text-gray-500'}>
                    {item.icon}
                  </div>
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-sm text-gray-500">{item.description}</div>
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}