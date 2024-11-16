import React from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Item } from '../../types/inventory';

interface ItemSelectorProps {
  items: Item[];
  selectedItem: Item | null;
  showDropdown: boolean;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onItemSelect: (item: Item) => void;
  onDropdownToggle: () => void;
}

export default function ItemSelector({
  items,
  selectedItem,
  showDropdown,
  searchTerm,
  onSearchChange,
  onItemSelect,
  onDropdownToggle
}: ItemSelectorProps) {
  const filteredItems = items.filter(item => {
    if (!item || typeof item.code !== 'string' || typeof item.name !== 'string') {
      return false;
    }
    const search = searchTerm.toLowerCase();
    return item.code.toLowerCase().includes(search) || 
           item.name.toLowerCase().includes(search);
  });

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Pilih Barang
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={onDropdownToggle}
          className="w-full px-4 py-2 text-left border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between"
        >
          <span className={selectedItem ? 'text-gray-900' : 'text-gray-500'}>
            {selectedItem ? `${selectedItem.code} - ${selectedItem.name}` : 'Pilih barang...'}
          </span>
          <ChevronDown size={20} className="text-gray-500" />
        </button>

        {showDropdown && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
            <div className="p-2">
              <input
                type="text"
                placeholder="Cari barang..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <ul className="max-h-60 overflow-auto">
              {filteredItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onItemSelect(item)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:bg-gray-100"
                  >
                    {item.code} - {item.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}