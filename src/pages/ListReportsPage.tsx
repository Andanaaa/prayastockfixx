import React, { useState, useEffect } from 'react';
import { FileText, Search, ArrowUpDown } from 'lucide-react';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'react-hot-toast';

type ReportType = 'returns' | 'borrowed';

interface ReturnItem {
  id: string;
  itemName: string;
  quantity: number;
  storeName: string;
  notes: string;
  timestamp: string;
  status: 'rejected' | 'approved';
  source: 'cod_failed' | 'damaged';
}

interface BorrowItem {
  id: string;
  itemName: string;
  quantity: number;
  borrower: string;
  purpose: string;
  borrowDate: string;
  status: 'returned' | 'sold';
}

const RETURN_SOURCES = {
  cod_failed: 'COD Gagal',
  damaged: 'Barang Rusak'
} as const;

export default function ListReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>('returns');
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [borrowItems, setBorrowItems] = useState<BorrowItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      if (activeReport === 'returns') {
        // Fetch returns with status
        const returnsQuery = query(
          collection(db, 'returns'),
          where('timestamp', '>=', start.toISOString()),
          where('timestamp', '<=', end.toISOString()),
          orderBy('timestamp', 'desc')
        );
        const snapshot = await getDocs(returnsQuery);
        const items = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter(item => item.status === 'approved' || item.status === 'rejected') as ReturnItem[];
        setReturnItems(items);
      } else {
        // Fetch borrows with completed status
        const borrowsQuery = query(
          collection(db, 'borrowed'),
          where('borrowDate', '>=', start.toISOString()),
          where('borrowDate', '<=', end.toISOString()),
          orderBy('borrowDate', 'desc')
        );
        const snapshot = await getDocs(borrowsQuery);
        const items = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter(item => item.status === 'returned' || item.status === 'sold') as BorrowItem[];
        setBorrowItems(items);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeReport, startDate, endDate]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig?.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const formatDateTime = (timestamp: string) => {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(timestamp));
  };

  const filterAndSortData = (data: any[], searchTerm: string) => {
    let filtered = data.filter(item => 
      Object.values(item).some(value => 
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );

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
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-blue-500" />
              <h2 className="text-2xl font-semibold text-gray-800">List Laporan</h2>
            </div>
            
            <div className="flex items-center gap-4">
              <button
                onClick={() => setActiveReport('returns')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  activeReport === 'returns'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pengembalian Barang
              </button>
              <button
                onClick={() => setActiveReport('borrowed')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  activeReport === 'borrowed'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Barang Pinjam
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 max-w-xs">
              <input
                type="text"
                placeholder="Cari..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-gray-500">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Tables */}
          <div className="overflow-x-auto">
            {activeReport === 'returns' ? (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    {[
                      { key: 'timestamp', label: 'Tanggal & Waktu' },
                      { key: 'itemName', label: 'Nama Barang' },
                      { key: 'quantity', label: 'Jumlah' },
                      { key: 'source', label: 'Asal Pengembalian' },
                      { key: 'storeName', label: 'Nama Toko' },
                      { key: 'notes', label: 'Keterangan' },
                      { key: 'status', label: 'Status' }
                    ].map((column) => (
                      <th
                        key={column.key}
                        onClick={() => handleSort(column.key)}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      >
                        <div className="flex items-center gap-2">
                          {column.label}
                          <ArrowUpDown size={14} className="text-gray-400" />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                        Memuat data...
                      </td>
                    </tr>
                  ) : filterAndSortData(returnItems, searchTerm).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                        Tidak ada data
                      </td>
                    </tr>
                  ) : (
                    filterAndSortData(returnItems, searchTerm).map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDateTime(item.timestamp)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.itemName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {RETURN_SOURCES[item.source]}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.storeName}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {item.notes}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                            ${item.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {item.status === 'approved' ? 'Kembali ke Stock' : 'Tidak Layak'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    {[
                      { key: 'borrowDate', label: 'Tanggal Pinjam' },
                      { key: 'itemName', label: 'Nama Barang' },
                      { key: 'quantity', label: 'Jumlah' },
                      { key: 'borrower', label: 'Peminjam' },
                      { key: 'purpose', label: 'Tujuan' },
                      { key: 'status', label: 'Status' }
                    ].map((column) => (
                      <th
                        key={column.key}
                        onClick={() => handleSort(column.key)}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      >
                        <div className="flex items-center gap-2">
                          {column.label}
                          <ArrowUpDown size={14} className="text-gray-400" />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                        Memuat data...
                      </td>
                    </tr>
                  ) : filterAndSortData(borrowItems, searchTerm).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                        Tidak ada data
                      </td>
                    </tr>
                  ) : (
                    filterAndSortData(borrowItems, searchTerm).map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDateTime(item.borrowDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.itemName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.borrower}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {item.purpose}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                            ${item.status === 'returned' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                            {item.status === 'returned' ? 'Dikembalikan' : 'Terjual'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}