import React, { useState, useEffect } from 'react';
import { PackageX, Search, Check, X, Upload, Download } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import ItemSelector from '../components/purchase/ItemSelector';
import { Item } from '../types/inventory';

interface ReturnItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  source: 'cod_failed' | 'damaged';
  storeName: string;
  notes: string;
  timestamp: string;
  status?: 'pending' | 'approved' | 'rejected';
  trackingNumber?: string;
}

interface ExcelReturn {
  'Kode Barang': string;
  'Jumlah': number;
  'Nama Toko': string;
  'Nomor Resi': string;
}

const RETURN_SOURCES = [
  { id: 'cod_failed', label: 'COD Gagal' },
  { id: 'damaged', label: 'Barang Rusak' },
] as const;

export default function ReturnPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [source, setSource] = useState<'cod_failed' | 'damaged'>('cod_failed');
  const [storeName, setStoreName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dateFilter, setDateFilter] = useState<'current_month' | 'custom'>('current_month');
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [tableSearchTerm, setTableSearchTerm] = useState('');

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
    let returnsQuery;
    const returnsRef = collection(db, 'returns');
    
    if (dateFilter === 'current_month') {
      const firstDay = new Date();
      firstDay.setDate(1);
      firstDay.setHours(0, 0, 0, 0);
      
      const lastDay = new Date();
      lastDay.setMonth(lastDay.getMonth() + 1);
      lastDay.setDate(0);
      lastDay.setHours(23, 59, 59, 999);
      
      returnsQuery = query(
        returnsRef,
        where('timestamp', '>=', firstDay.toISOString()),
        where('timestamp', '<=', lastDay.toISOString()),
        orderBy('timestamp', 'desc')
      );
    } else {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      returnsQuery = query(
        returnsRef,
        where('timestamp', '>=', start.toISOString()),
        where('timestamp', '<=', end.toISOString()),
        orderBy('timestamp', 'desc')
      );
    }

    const unsubscribe = onSnapshot(returnsQuery, (snapshot) => {
      const returns = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ReturnItem[];
      setReturnItems(returns);
    });

    return () => unsubscribe();
  }, [dateFilter, startDate, endDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) {
      toast.error('Pilih barang terlebih dahulu');
      return;
    }

    if (source === 'cod_failed' && !trackingNumber) {
      toast.error('Nomor resi wajib diisi untuk pengembalian COD');
      return;
    }

    if (!storeName) {
      toast.error('Nama toko wajib diisi');
      return;
    }

    setIsSubmitting(true);
    try {
      const returnData = {
        itemId: selectedItem.id,
        itemCode: selectedItem.code,
        itemName: selectedItem.name,
        quantity: Number(quantity),
        source,
        storeName: storeName.trim(),
        notes: notes.trim(),
        timestamp: new Date().toISOString(),
        status: 'pending',
        ...(source === 'cod_failed' ? { trackingNumber: trackingNumber.trim() } : {})
      };

      await addDoc(collection(db, 'returns'), returnData);

      toast.success('Pengembalian barang berhasil dicatat');
      setSelectedItem(null);
      setQuantity(1);
      setStoreName('');
      setTrackingNumber('');
      setNotes('');
      setSearchTerm('');
    } catch (error) {
      console.error('Error adding return:', error);
      toast.error('Gagal mencatat pengembalian barang');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnAction = async (returnItem: ReturnItem, isApproved: boolean) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      if (isApproved) {
        const itemRef = doc(db, 'items', returnItem.itemId);
        const itemDoc = await getDoc(itemRef);
        
        if (itemDoc.exists()) {
          const currentQuantity = itemDoc.data().quantity || 0;
          await updateDoc(itemRef, {
            quantity: currentQuantity + returnItem.quantity
          });
          
          await updateDoc(doc(db, 'returns', returnItem.id), {
            status: 'approved'
          });
          toast.success('Barang berhasil dikembalikan ke stock');
        } else {
          toast.error('Data barang tidak ditemukan');
        }
      } else {
        await updateDoc(doc(db, 'returns', returnItem.id), {
          status: 'rejected'
        });
        toast.success('Barang ditandai tidak layak untuk stock');
      }
    } catch (error) {
      console.error('Error processing return:', error);
      toast.error('Gagal memproses pengembalian barang');
    } finally {
      setIsProcessing(false);
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
        const jsonData = XLSX.utils.sheet_to_json<ExcelReturn>(worksheet);

        if (jsonData.length === 0) {
          toast.error('File Excel kosong atau format tidak sesuai');
          return;
        }

        const batch = writeBatch(db);
        const itemsMap = new Map(items.map(item => [item.code, item]));
        
        let successCount = 0;
        let errorCount = 0;
        const timestamp = new Date().toISOString();

        for (const returnItem of jsonData) {
          const item = itemsMap.get(returnItem['Kode Barang']);
          
          if (!item) {
            errorCount++;
            continue;
          }

          if (!returnItem['Nomor Resi'] || !returnItem['Jumlah'] || !returnItem['Nama Toko']) {
            errorCount++;
            continue;
          }

          const returnRef = doc(collection(db, 'returns'));
          const returnData = {
            itemId: item.id,
            itemCode: item.code,
            itemName: item.name,
            quantity: Number(returnItem['Jumlah']),
            source: 'cod_failed' as const,
            storeName: String(returnItem['Nama Toko']).trim(),
            trackingNumber: String(returnItem['Nomor Resi']).trim(),
            notes: '',
            timestamp,
            status: 'pending'
          };

          batch.set(returnRef, returnData);
          successCount++;
        }

        if (successCount > 0) {
          await batch.commit();
          toast.success(`${successCount} pengembalian berhasil diimpor!`);
        }
        
        if (errorCount > 0) {
          toast.error(`${errorCount} pengembalian gagal diimpor karena data tidak valid`);
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
        'Jumlah': 1,
        'Nama Toko': 'Nama Toko',
        'Nomor Resi': 'RESI123'
      }
    ];
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    XLSX.utils.book_append_sheet(template, ws, 'Template');
    XLSX.writeFile(template, 'template_import_pengembalian_cod.xlsx');
  };

  const formatDateTime = (timestamp: string) => {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(timestamp));
  };

  const groupedReturns = returnItems.reduce((acc, item) => {
    if (!acc[item.source]) {
      acc[item.source] = [];
    }
    acc[item.source].push(item);
    return acc;
  }, {} as Record<string, ReturnItem[]>);

  return (
    <div className="space-y-6">
      {/* Import Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Upload className="h-6 w-6 text-blue-500" />
            <h2 className="text-2xl font-semibold text-gray-800">Import Pengembalian COD</h2>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Import data pengembalian COD secara massal menggunakan file Excel. 
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

      {/* Input Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <PackageX className="h-6 w-6 text-blue-500" />
            <h2 className="text-2xl font-semibold text-gray-800">Input Barang Kembali</h2>
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
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Return Source */}
            <div>
              <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-1">
                Asal Pengembalian
              </label>
              <select
                id="source"
                value={source}
                onChange={(e) => setSource(e.target.value as 'cod_failed' | 'damaged')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {RETURN_SOURCES.map((src) => (
                  <option key={src.id} value={src.id}>
                    {src.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Store Name */}
            <div>
              <label htmlFor="storeName" className="block text-sm font-medium text-gray-700 mb-1">
                Nama Toko
              </label>
              <input
                type="text"
                id="storeName"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Masukkan nama toko"
              />
            </div>

            {/* Tracking Number (for COD returns) */}
            {source === 'cod_failed' && (
              <div>
                <label htmlFor="trackingNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Nomor Resi
                </label>
                <input
                  type="text"
                  id="trackingNumber"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Masukkan nomor resi"
                />
              </div>
            )}

            {/* Notes */}
            <div className="md:col-span-2">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Keterangan
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Tambahkan keterangan..."
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !selectedItem}
              className={`px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                (isSubmitting || !selectedItem) ? 'opacity-75 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>

      {/* Return Tables */}
      {RETURN_SOURCES.map((returnSource) => (
        <div key={returnSource.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Daftar Pengembalian - {returnSource.label}
              </h2>

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

                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Cari..."
                    value={tableSearchTerm}
                    onChange={(e) => setTableSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                </div>
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
                    Nama Barang
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Jumlah
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nama Toko
                  </th>
                  {returnSource.id === 'cod_failed' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nomor Resi
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Keterangan
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
                {!groupedReturns[returnSource.id] || groupedReturns[returnSource.id].length === 0 ? (
                  <tr>
                    <td colSpan={returnSource.id === 'cod_failed' ? 8 : 7} className="px-6 py-4 text-center text-sm text-gray-500">
                      Belum ada data pengembalian
                    </td>
                  </tr>
                ) : (
                  groupedReturns[returnSource.id].map((item) => (
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
                        {item.storeName}
                      </td>
                      {returnSource.id === 'cod_failed' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.trackingNumber || '-'}
                        </td>
                      )}
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {item.notes}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                          ${item.status === 'rejected' ? 'bg-red-100 text-red-800' : 
                            item.status === 'approved' ? 'bg-green-100 text-green-800' : 
                            'bg-yellow-100 text-yellow-800'}`}>
                          {item.status === 'rejected' ? 'Tidak Layak' :
                           item.status === 'approved' ? 'Kembali ke Stock' :
                           'Menunggu'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {item.status === 'pending' && (
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => handleReturnAction(item, true)}
                              disabled={isProcessing}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50"
                              title="Kembalikan ke stock"
                            >
                              <Check size={18} />
                            </button>
                            <button
                              onClick={() => handleReturnAction(item, false)}
                              disabled={isProcessing}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                              title="Tandai tidak layak"
                            >
                              <X size={18} />
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
      ))}
    </div>
  );
}