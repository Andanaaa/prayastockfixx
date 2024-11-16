import React from 'react';
import { OrderItem } from '../../types/inventory';

interface OrderListProps {
  items: OrderItem[];
  onRemoveItem: (itemId: string) => void;
}

export default function OrderList({ items, onRemoveItem }: OrderListProps) {
  if (items.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Daftar Barang</h3>
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
                Jumlah
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item) => (
              <tr key={item.itemId}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.itemCode}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.itemName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.quantity}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.itemId)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}