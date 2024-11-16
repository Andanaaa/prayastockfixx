import React, { useState, useEffect } from 'react';
import { FileText, Search, ArrowUpDown, Ship } from 'lucide-react';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'react-hot-toast';
import { Item, ReportItem, PurchaseOrder } from '../types/inventory';

const STOCK_STATUS = {
  stock_sufficient: { label: 'Stock Mencukupi', color: 'bg-green-100 text-green-800' },
  buy_soon: { label: 'Segera Beli', color: 'bg-red-100 text-red-800' },
  prepare_to_buy: { label: 'Persiapan Beli', color: 'bg-yellow-100 text-yellow-800' }
} as const;

export default function ReportsPage() {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<ReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<keyof typeof STOCK_STATUS | 'all'>('all');
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ReportItem;
    direction: 'asc' | 'desc';
  } | null>(null);

  const generateReport = async () => {
    setIsLoading(true);
    try {
      // Fetch all items
      const itemsSnapshot = await getDocs(collection(db, 'items'));
      const items = itemsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Item[];

      // Fetch sales within date range
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const salesQuery = query(
        collection(db, 'sales'),
        where('timestamp', '>=', start.toISOString()),
        where('timestamp', '<=', end.toISOString())
      );
      const salesSnapshot = await getDocs(salesQuery);
      const sales = salesSnapshot.docs.map(doc => ({
        itemId: doc.data().itemId,
        quantity: doc.data().quantity
      }));

      // Fetch pending purchase orders
      const purchaseOrdersQuery = query(collection(db, 'purchaseOrders'));
      const purchaseOrdersSnapshot = await getDocs(purchaseOrdersQuery);
      const purchaseOrders = purchaseOrdersSnapshot.docs.map(doc => ({
        ...doc.data()
      })) as PurchaseOrder[];

      // Calculate pending stock per item
      const pendingStockByItem = new Map<string, number>();
      purchaseOrders.forEach(order => {
        if (!order.completed) {
          order.items.forEach(item => {
            if (!item.completed) {
              const currentPending = pendingStockByItem.get(item.itemId) || 0;
              pendingStockByItem.set(item.itemId, currentPending + item.quantity);
            }
          });
        }
      });

      // Calculate total sales per item
      const salesByItem = sales.reduce((acc, sale) => {
        acc[sale.itemId] = (acc[sale.itemId] || 0) + sale.quantity;
        return acc;
      }, {} as Record<string, number>);

      // Generate report data
      const report = items.map(item => {
        const totalSales = salesByItem[item.id] || 0;
        const pendingStock = pendingStockByItem.get(item.id) || 0;
        let stockStatus: ReportItem['stockStatus'];

        // Calculate status based on current stock + pending stock
        const effectiveStock = item.quantity + pendingStock;
        
        if (effectiveStock > totalSales * 2.5) {
          stockStatus = 'stock_sufficient';
        } else if (effectiveStock < totalSales * 1.75) {
          stockStatus = 'buy_soon';
        } else {
          stockStatus = 'prepare_to_buy';
        }

        return {
          ...item,
          totalSales,
          pendingStock,
          stockStatus
        };
      });

      setReportData(report);
      toast.success('Laporan berhasil dibuat');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Gagal membuat laporan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (key: keyof ReportItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig?.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedData = (() => {
    let filtered = reportData.filter(item => {
      const search = searchTerm.toLowerCase();
      return (
        item.code.toLowerCase().includes(search) ||
        item.name.toLowerCase().includes(search) ||
        item.category.toLowerCase().includes(search)
      ) && (statusFilter === 'all' || item.stockStatus === statusFilter);
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  })();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-blue-500" />
            <h2 className="text-2xl font-semibold text-gray-800">Laporan Penjualan & Analisis Stock</h2>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Date Range Selection */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-gray-500">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={generateReport}
              disabled={isLoading}
              className={`px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isLoading ? 'opacity-75 cursor-not-allowed' : ''
              }`}
            >
              {isLoading ? 'Memuat...' : 'Buat Laporan'}
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 max-w-xs">
              <input
                type="text"
                placeholder="Cari barang..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as keyof typeof STOCK_STATUS | 'all')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Semua Status</option>
              {Object.entries(STOCK_STATUS).map(([value, { label }]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Report Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  {[
                    { key: 'code', label: 'Kode Barang' },
                    { key: 'name', label: 'Nama Barang' },
                    { key: 'quantity', label: 'Stock Saat Ini' },
                    { 
                      key: 'pendingStock', 
                      label: (
                        <div className="flex items-center gap-2">
                          <Ship className="h-4 w-4 text-blue-500" />
                          <span>Dalam Pengiriman</span>
                        </div>
                      )
                    },
                    { key: 'totalSales', label: 'Total Penjualan' },
                    { key: 'stockStatus', label: 'Status Stock' }
                  ].map(({ key, label }) => (
                    <th
                      key={key}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort(key as keyof ReportItem)}
                    >
                      <div className="flex items-center gap-2">
                        {label}
                        <ArrowUpDown size={14} className="text-gray-400" />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                      {reportData.length === 0 ? 'Pilih rentang tanggal dan klik "Buat Laporan"' : 'Tidak ada data yang sesuai dengan filter'}
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium bg-blue-50 text-blue-700">
                        {item.pendingStock || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.totalSales}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STOCK_STATUS[item.stockStatus].color}`}>
                          {STOCK_STATUS[item.stockStatus].label}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}