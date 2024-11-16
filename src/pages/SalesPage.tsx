import React, { useState, useEffect } from 'react';
import { ShoppingCart, Search, Calendar, Upload, Download } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import ItemSelector from '../components/purchase/ItemSelector';
import { Item } from '../types/inventory';

interface SaleItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  timestamp: string;
}

interface ExcelSale {
  'Kode Barang': string;
  'Jumlah': number;
}

export default function SalesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [dateFilter, setDateFilter] = useState<'today' | 'custom'>('today');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

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
    let salesQuery;
    const salesRef = collection(db, 'sales');
    
    if (dateFilter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      salesQuery = query(
        salesRef,
        where('timestamp', '>=', today.toISOString()),
        where('timestamp', '<', tomorrow.toISOString()),
        orderBy('timestamp', 'desc')
      );
    } else {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      salesQuery = query(
        salesRef,
        where('timestamp', '>=', start.toISOString()),
        where('timestamp', '<=', end.toISOString()),
        orderBy('timestamp', 'desc')
      );
    }

    const unsubscribe = onSnapshot(salesQuery, (snapshot) => {
      const salesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SaleItem[];
      setSales(salesList);
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
      await addDoc(collection(db, 'sales'), {
        itemId: selectedItem.id,
        itemCode: selectedItem.code,
        itemName: selectedItem.name,
        quantity,
        timestamp: new Date().toISOString()
      });

      const itemRef = doc(db, 'items', selectedItem.id);
      const itemDoc = await getDoc(itemRef);
      if (itemDoc.exists()) {
        const currentQuantity = itemDoc.data().quantity || 0;
        await updateDoc(itemRef, {
          quantity: currentQuantity - quantity
        });
      }

      toast.success('Penjualan berhasil dicatat');
      setSelectedItem(null);
      setQuantity(1);
      setShowDropdown(false);
    } catch (error) {
      console.error('Error recording sale:', error);
      toast.error('Gagal mencatat penjualan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<ExcelSale>(worksheet);

        if (jsonData.length === 0) {
          toast.error('File Excel kosong atau format tidak sesuai');
          return;
        }

        const batch = writeBatch(db);
        const itemsMap = new Map(items.map(item => [item.code, item]));
        
        let successCount = 0;
        let errorCount = 0;
        const timestamp = new Date().toISOString();

        for (const sale of jsonData) {
          const item = itemsMap.get(sale['Kode Barang']);
          
          if (!item) {
            errorCount++;
            continue;
          }

          if (!sale['Jumlah'] || sale['Jumlah'] <= 0) {
            errorCount++;
            continue;
          }

          if (sale['Jumlah'] > item.quantity) {
            errorCount++;
            continue;
          }

          const saleRef = doc(collection(db, 'sales'));
          batch.set(saleRef, {
            itemId: item.id,
            itemCode: item.code,
            itemName: item.name,
            quantity: sale['Jumlah'],
            timestamp
          });

          const itemRef = doc(db, 'items', item.id);
          batch.update(itemRef, {
            quantity: item.quantity - sale['Jumlah']
          });

          successCount++;
        }

        if (successCount > 0) {
          await batch.commit();
          toast.success(`${successCount} penjualan berhasil diimpor!`);
        }
        
        if (errorCount > 0) {
          toast.error(`${errorCount} penjualan gagal diimpor karena data tidak valid`);
        }
      } catch (error) {
        console.error('Error importing Excel:', error);
        toast.error('Gagal mengimpor data. Pastikan format Excel sesuai');
      } finally {
        setIsImporting(false);
        if (e.target) {
          e.target.value = '';
        }
      }
    };

    reader.onerror = () => {
      toast.error('Gagal membaca file');
      setIsImporting(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const template = XLSX.utils.book_new();
    const templateData = [
      {
        'Kode Barang': 'BRG001',
        'Jumlah': 1
      }
    ];
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    XLSX.utils.book_append_sheet(template, ws, 'Template');
    XLSX.writeFile(template, 'template_import_penjualan.xlsx');
  };

  const formatDateTime = (timestamp: string) => {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(timestamp));
  };

  return (
    <div className="space-y-6">
      {/* Import Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Upload className="h-6 w-6 text-blue-500" />
            <h2 className="text-2xl font-semibold text-gray-800">Import Penjualan dari Excel</h2>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Import data penjualan secara massal menggunakan file Excel. 
              Pastikan format sesuai dengan template yang disediakan.
            </p>
            
            <div className="flex items-center gap-4">
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
              >
                <Download size={16} />
                Download Template
              </button>
              
              <div className="relative">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  disabled={isImporting}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <button
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 ${
                    isImporting ? 'opacity-75 cursor-not-allowed' : ''
                  }`}
                >
                  <Upload size={16} />
                  {isImporting ? 'Mengimpor...' : 'Upload Excel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Input Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-6 w-6 text-blue-500" />
            <h2 className="text-2xl font-semibold text-gray-800">Input Penjualan Manual</h2>
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
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !selectedItem || quantity > (selectedItem?.quantity || 0)}
              className={`px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                (isSubmitting || !selectedItem || quantity > (selectedItem?.quantity || 0)) ? 'opacity-75 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>

      {/* Sales History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-gray-800">Riwayat Penjualan</h2>
            
            <div className="flex flex-wrap items-center gap-4">
              {/* Date Filter Type */}
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as 'today' | 'custom')}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="today">Hari Ini</option>
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
                  Tanggal & Waktu
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kode Barang
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nama Barang
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Jumlah
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                    Belum ada data penjualan
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDateTime(sale.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sale.itemCode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sale.itemName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sale.quantity}
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