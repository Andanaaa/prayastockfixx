import React, { useState } from 'react';
import { collection, addDoc, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'react-hot-toast';
import { PackagePlus, Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface FormData {
  code: string;
  name: string;
  category: string;
  location: string;
  quantity: number;
}

interface ExcelItem {
  'Kode Barang': string;
  'Nama Barang': string;
  'Kategori': string;
  'Letak Barang': string;
  'Stock Awal': number;
}

export default function AddItemPage() {
  const [formData, setFormData] = useState<FormData>({
    code: '',
    name: '',
    category: '',
    location: '',
    quantity: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' ? parseInt(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await addDoc(collection(db, 'items'), {
        ...formData,
        createdAt: new Date().toISOString()
      });

      toast.success('Barang berhasil ditambahkan!');
      setFormData({ code: '', name: '', category: '', location: '', quantity: 0 });
    } catch (error) {
      toast.error('Gagal menambahkan barang. Silakan coba lagi.');
      console.error('Error adding document: ', error);
    } finally {
      setIsLoading(false);
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
        const jsonData = XLSX.utils.sheet_to_json<ExcelItem>(worksheet);

        if (jsonData.length === 0) {
          toast.error('File Excel kosong atau format tidak sesuai');
          return;
        }

        const batch = writeBatch(db);
        const itemsRef = collection(db, 'items');

        let successCount = 0;
        let errorCount = 0;

        for (const item of jsonData) {
          if (!item['Kode Barang'] || !item['Nama Barang'] || !item['Kategori']) {
            errorCount++;
            continue;
          }

          const newDocRef = doc(itemsRef);
          batch.set(newDocRef, {
            code: item['Kode Barang'],
            name: item['Nama Barang'],
            category: item['Kategori'],
            location: item['Letak Barang'] || '',
            quantity: item['Stock Awal'] || 0,
            createdAt: new Date().toISOString()
          });
          successCount++;
        }

        if (successCount > 0) {
          await batch.commit();
          toast.success(`${successCount} barang berhasil diimpor!`);
        }
        
        if (errorCount > 0) {
          toast.error(`${errorCount} barang gagal diimpor karena format tidak sesuai`);
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
        'Nama Barang': 'Contoh Barang',
        'Kategori': 'Contoh Kategori',
        'Letak Barang': 'Rak A-1',
        'Stock Awal': 10
      }
    ];
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    XLSX.utils.book_append_sheet(template, ws, 'Template');
    XLSX.writeFile(template, 'template_import_barang.xlsx');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Import Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Upload className="h-6 w-6 text-blue-500" />
            <h2 className="text-2xl font-semibold text-gray-800">Import dari Excel</h2>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Import data barang secara massal menggunakan file Excel. 
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

      {/* Manual Input Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <PackagePlus className="h-6 w-6 text-blue-500" />
            <h2 className="text-2xl font-semibold text-gray-800">Input Manual</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
                Kode Barang
              </label>
              <input
                type="text"
                id="code"
                name="code"
                required
                value={formData.code}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Contoh: BRG001"
              />
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Nama Barang
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Masukkan nama barang"
              />
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                Kategori
              </label>
              <input
                type="text"
                id="category"
                name="category"
                required
                value={formData.category}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Masukkan kategori barang"
              />
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                Letak Barang
              </label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Contoh: Rak A-1"
              />
            </div>

            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                Stock Awal
              </label>
              <input
                type="number"
                id="quantity"
                name="quantity"
                min="0"
                value={formData.quantity}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Masukkan jumlah stock awal"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setFormData({ code: '', name: '', category: '', location: '', quantity: 0 })}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={`px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isLoading ? 'opacity-75 cursor-not-allowed' : ''
              }`}
            >
              {isLoading ? 'Menyimpan...' : 'Simpan Barang'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}