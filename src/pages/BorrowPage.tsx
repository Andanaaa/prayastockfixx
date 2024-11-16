import React, { useState, useEffect } from 'react';
import { Share2, Search, Check, X, ShoppingCart } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'react-hot-toast';
import ItemSelector from '../components/purchase/ItemSelector';
import { Item } from '../types/inventory';

interface BorrowedItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  borrower: string;
  purpose: string;
  borrowDate: string;
  status: 'borrowed' | 'returned' | 'sold';
}

export default function BorrowPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [borrower, setBorrower] = useState('');
  const [purpose, setPurpose] = useState('');
  const [borrowedItems, setBorrowedItems] = useState<BorrowedItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dateFilter, setDateFilter] = useState<'current_month' | 'custom'>('current_month');
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  });

  useEffect(() => {
    const q = query(collection(db, 'items'), orderBy('code'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Item[];
      setItems(itemsList);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let borrowedQuery;
    const borrowedRef = collection(db, 'borrowed');
    
    if (dateFilter === 'current_month') {
      const firstDay = new Date();
      firstDay.setDate(1);
      firstDay.setHours(0, 0, 0, 0);
      
      const lastDay = new Date();
      lastDay.setMonth(lastDay.getMonth() + 1);
      lastDay.setDate(0);
      lastDay.setHours(23, 59, 59, 999);
      
      borrowedQuery = query(
        borrowedRef,
        where('borrowDate', '>=', firstDay.toISOString()),
        where('borrowDate', '<=', lastDay.toISOString()),
        orderBy('borrowDate', 'desc')
      );
    } else {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      borrowedQuery = query(
        borrowedRef,
        where('borrowDate', '>=', start.toISOString()),
        where('borrowDate', '<=', end.toISOString()),
        orderBy('borrowDate', 'desc')
      );
    }

    const unsubscribe = onSnapshot(borrowedQuery, (snapshot) => {
      const borrowed = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BorrowedItem[];
      setBorrowedItems(borrowed);
    });

    return () => unsubscribe();
  }, [dateFilter, startDate, endDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) {
      toast.error('Pilih barang terlebih dahulu');
      return;
    }

    if (quantity > selectedItem.quantity) {
      toast.error('Jumlah melebihi stock yang tersedia');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'borrowed'), {
        itemId: selectedItem.id,
        itemCode: selectedItem.code,
        itemName: selectedItem.name,
        quantity,
        borrower,
        purpose,
        borrowDate: new Date().toISOString(),
        status: 'borrowed'
      });

      const itemRef = doc(db, 'items', selectedItem.id);
      const itemDoc = await getDoc(itemRef);
      if (itemDoc.exists()) {
        const currentQuantity = itemDoc.data().quantity || 0;
        await updateDoc(itemRef, {
          quantity: currentQuantity - quantity
        });
      }

      toast.success('Peminjaman berhasil dicatat');
      setSelectedItem(null);
      setQuantity(1);
      setBorrower('');
      setPurpose('');
      setShowDropdown(false);
    } catch (error) {
      console.error('Error recording borrow:', error);
      toast.error('Gagal mencatat peminjaman');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturn = async (item: BorrowedItem) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'borrowed', item.id), {
        status: 'returned'
      });

      const itemRef = doc(db, 'items', item.itemId);
      const itemDoc = await getDoc(itemRef);
      if (itemDoc.exists()) {
        const currentQuantity = itemDoc.data().quantity || 0;
        await updateDoc(itemRef, {
          quantity: currentQuantity + item.quantity
        });
      }

      toast.success('Barang berhasil dikembalikan');
    } catch (error) {
      console.error('Error processing return:', error);
      toast.error('Gagal memproses pengembalian');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkAsSold = async (item: BorrowedItem) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'borrowed', item.id), {
        status: 'sold'
      });
      toast.success('Status berhasil diubah menjadi terjual');
    } catch (error) {
      console.error('Error marking as sold:', error);
      toast.error('Gagal mengubah status');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDateTime = (timestamp: string) => {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(timestamp));
  };

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Share2 className="h-6 w-6 text-blue-500" />
            <h2 className="text-2xl font-semibold text-gray-800">Input Peminjaman Barang</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Item Selection */}
            <ItemSelector
              items={items}
              selectedItem={selectedItem}
              showDropdown={showDropdown}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onItemSelect={(item) => {
                setSelectedItem(item);
                setShowDropdown(false);
                setSearchTerm('');
              }}
              onDropdownToggle={() => setShowDropdown(!showDropdown)}
            />

            {/* Quantity */}
            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                Jumlah
              </label>
              <input
                type="number"
                id="quantity"
                min="1"
                max={selectedItem?.quantity || 1}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Borrower */}
            <div>
              <label htmlFor="borrower" className="block text-sm font-medium text-gray-700 mb-1">
                Peminjam
              </label>
              <input
                type="text"
                id="borrower"
                value={borrower}
                onChange={(e) => setBorrower(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Nama peminjam"
                required
              />
            </div>

            {/* Purpose */}
            <div>
              <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 mb-1">
                Tujuan Peminjaman
              </label>
              <input
                type="text"
                id="purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Tujuan peminjaman"
                required
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !selectedItem || !borrower || !purpose}
              className={`px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                (isSubmitting || !selectedItem || !borrower || !purpose) ? 'opacity-75 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>

      {/* Borrowed Items List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-gray-800">Daftar Barang Dipinjam</h2>
            
            <div className="flex flex-wrap items-center gap-4">
              {/* Date Filter Type */}
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as 'current_month' | 'custom')}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="current_month">Bulan Ini</option>
                <option value="custom">Pilih Tanggal</option>
              </select>

              {/* Custom Date Range */}
              {dateFilter === 'custom' && (
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
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tanggal Pinjam
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nama Barang
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Jumlah
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Peminjam
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tujuan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {borrowedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                    Belum ada data peminjaman
                  </td>
                </tr>
              ) : (
                borrowedItems.map((item) => (
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.purpose}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${item.status === 'returned' ? 'bg-green-100 text-green-800' : 
                          item.status === 'sold' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'}`}>
                        {item.status === 'returned' ? 'Dikembalikan' :
                         item.status === 'sold' ? 'Terjual' :
                         'Dipinjam'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      {item.status === 'borrowed' && (
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleReturn(item)}
                            disabled={isProcessing}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50"
                            title="Kembalikan barang"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            onClick={() => handleMarkAsSold(item)}
                            disabled={isProcessing}
                            className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                            title="Tandai sebagai terjual"
                          >
                            <ShoppingCart size={18} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}