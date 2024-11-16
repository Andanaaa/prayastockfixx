import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Search, Package, Trash2, Edit2, X, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Item } from '../types/inventory';

interface EditingItem {
  id: string;
  code: string;
  name: string;
  location: string;
}

export default function StockPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [stockItems, setStockItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [sortZeroStock, setSortZeroStock] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'items'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Item[];
        setStockItems(items);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching items:', error);
        toast.error('Gagal memuat data stock');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus barang ini?')) {
      try {
        await deleteDoc(doc(db, 'items', id));
        toast.success('Barang berhasil dihapus');
      } catch (error) {
        console.error('Error deleting item:', error);
        toast.error('Gagal menghapus barang');
      }
    }
  };

  const startEditing = (item: Item) => {
    setEditingItem({
      id: item.id,
      code: item.code,
      name: item.name,
      location: item.location || '',
    });
  };

  const cancelEditing = () => {
    setEditingItem(null);
  };

  const handleEdit = async () => {
    if (!editingItem) return;

    try {
      await updateDoc(doc(db, 'items', editingItem.id), {
        code: editingItem.code,
        name: editingItem.name,
        location: editingItem.location,
      });
      toast.success('Barang berhasil diperbarui');
      setEditingItem(null);
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error('Gagal memperbarui barang');
    }
  };

  const filteredAndSortedItems = (() => {
    let filtered = stockItems.filter(item => {
      if (!item || typeof item.code !== 'string' || typeof item.name !== 'string' || 
          typeof item.category !== 'string') {
        return false;
      }
      const search = searchTerm.toLowerCase();
      return (
        item.code.toLowerCase().includes(search) ||
        item.name.toLowerCase().includes(search) ||
        item.category.toLowerCase().includes(search) ||
        (item.location?.toLowerCase() || '').includes(search)
      );
    });

    if (sortZeroStock) {
      filtered.sort((a, b) => {
        // If one item has zero stock and the other doesn't, sort accordingly
        if (a.quantity === 0 && b.quantity !== 0) return 1;
        if (a.quantity !== 0 && b.quantity === 0) return -1;
        // If both items have the same stock status (both zero or both non-zero),
        // maintain their original order based on createdAt
        return 0;
      });
    }

    return filtered;
  })();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6 text-blue-500" />
            <h2 className="text-2xl font-semibold text-gray-800">Daftar Stock</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Cari barang..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64"
              />
              <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="sortZeroStock"
                checked={sortZeroStock}
                onChange={(e) => setSortZeroStock(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="sortZeroStock" className="text-sm text-gray-600">
                Stock 0 di bawah
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kode Barang
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nama Barang
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kategori
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Letak Barang
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Jumlah Stock
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                  Memuat data...
                </td>
              </tr>
            ) : filteredAndSortedItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                  {searchTerm ? 'Tidak ada barang yang sesuai dengan pencarian' : 'Belum ada data barang'}
                </td>
              </tr>
            ) : (
              filteredAndSortedItems.map((item) => (
                <tr key={item.id} className={`hover:bg-gray-50 ${item.quantity === 0 ? 'bg-red-50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {editingItem?.id === item.id ? (
                      <input
                        type="text"
                        value={editingItem.code}
                        onChange={(e) => setEditingItem({ ...editingItem, code: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      item.code
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {editingItem?.id === item.id ? (
                      <input
                        type="text"
                        value={editingItem.name}
                        onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      item.name
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {editingItem?.id === item.id ? (
                      <input
                        type="text"
                        value={editingItem.location}
                        onChange={(e) => setEditingItem({ ...editingItem, location: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      item.location || '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`font-medium ${item.quantity === 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {item.quantity}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {editingItem?.id === item.id ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={handleEdit}
                          className="text-green-600 hover:text-green-900"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => startEditing(item)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 size={18} />
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
  );
}