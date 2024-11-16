import React, { useState, useEffect } from 'react';
import { ShoppingBag, Search, Edit2, Trash2, X, Check } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'react-hot-toast';
import ItemSelector from '../components/purchase/ItemSelector';
import OrderList from '../components/purchase/OrderList';
import { Item, OrderItem, PurchaseOrder } from '../types/inventory';

export default function PurchaseOrderPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [supplier, setSupplier] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentOrderItems, setCurrentOrderItems] = useState<OrderItem[]>([]);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
    const q = query(collection(db, 'purchaseOrders'), orderBy('orderDate', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PurchaseOrder[];
      setOrders(ordersList);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (orderId: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus order ini?')) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'purchaseOrders', orderId));
      toast.success('Order berhasil dihapus');
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('Gagal menghapus order');
    } finally {
      setIsDeleting(false);
    }
  };

  const startEditing = (order: PurchaseOrder) => {
    setEditingOrder(order);
    setSupplier(order.supplier);
    setOrderDate(order.orderDate);
    setCurrentOrderItems([...order.items]);
  };

  const cancelEditing = () => {
    setEditingOrder(null);
    setSupplier('');
    setOrderDate(new Date().toISOString().split('T')[0]);
    setCurrentOrderItems([]);
  };

  const addItemToOrder = () => {
    if (!selectedItem) {
      toast.error('Pilih barang terlebih dahulu');
      return;
    }

    const existingItem = currentOrderItems.find(item => item.itemId === selectedItem.id);
    if (existingItem) {
      toast.error('Barang sudah ada dalam order');
      return;
    }

    setCurrentOrderItems([
      ...currentOrderItems,
      {
        itemId: selectedItem.id,
        itemCode: selectedItem.code,
        itemName: selectedItem.name,
        quantity,
        receivedQuantity: 0,
        completed: false
      }
    ]);

    setSelectedItem(null);
    setQuantity(1);
    setShowDropdown(false);
  };

  const removeItemFromOrder = (itemId: string) => {
    setCurrentOrderItems(currentOrderItems.filter(item => item.itemId !== itemId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentOrderItems.length === 0) {
      toast.error('Tambahkan barang terlebih dahulu');
      return;
    }

    if (!supplier) {
      toast.error('Masukkan nama supplier');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingOrder) {
        await updateDoc(doc(db, 'purchaseOrders', editingOrder.id), {
          supplier,
          orderDate,
          items: currentOrderItems
        });
        toast.success('Order pembelian berhasil diperbarui');
        setEditingOrder(null);
      } else {
        const orderNumber = `PO${Date.now()}`;
        await addDoc(collection(db, 'purchaseOrders'), {
          orderNumber,
          supplier,
          orderDate,
          items: currentOrderItems,
          completed: false
        });
        toast.success('Order pembelian berhasil dibuat');
      }

      setCurrentOrderItems([]);
      setSupplier('');
      setOrderDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      console.error('Error saving order:', error);
      toast.error(editingOrder ? 'Gagal memperbarui order' : 'Gagal membuat order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateEstimatedDate = async (orderId: string, date: string) => {
    try {
      await updateDoc(doc(db, 'purchaseOrders', orderId), {
        estimatedArrivalDate: date
      });
      toast.success('Estimasi tanggal datang berhasil diperbarui');
    } catch (error) {
      console.error('Error updating estimated date:', error);
      toast.error('Gagal memperbarui estimasi tanggal datang');
    }
  };

  const updateReceivedQuantity = async (orderId: string, itemId: string, quantity: number) => {
    try {
      const orderRef = doc(db, 'purchaseOrders', orderId);
      const orderDoc = await getDoc(orderRef);
      
      if (orderDoc.exists()) {
        const order = orderDoc.data() as PurchaseOrder;
        const updatedItems = order.items.map(item => 
          item.itemId === itemId ? { ...item, receivedQuantity: quantity } : item
        );
        
        await updateDoc(orderRef, { items: updatedItems });
        toast.success('Jumlah diterima berhasil diperbarui');
      }
    } catch (error) {
      console.error('Error updating received quantity:', error);
      toast.error('Gagal memperbarui jumlah diterima');
    }
  };

  const updateActualDate = async (orderId: string, itemId: string, date: string) => {
    try {
      const orderRef = doc(db, 'purchaseOrders', orderId);
      const orderDoc = await getDoc(orderRef);
      
      if (orderDoc.exists()) {
        const order = orderDoc.data() as PurchaseOrder;
        const updatedItems = order.items.map(item => 
          item.itemId === itemId ? { ...item, actualArrivalDate: date } : item
        );
        
        await updateDoc(orderRef, { items: updatedItems });
        toast.success('Tanggal kedatangan berhasil diperbarui');
      }
    } catch (error) {
      console.error('Error updating actual date:', error);
      toast.error('Gagal memperbarui tanggal kedatangan');
    }
  };

  const updateStockAndCompleteItem = async (orderId: string, itemId: string) => {
    try {
      const orderRef = doc(db, 'purchaseOrders', orderId);
      const orderDoc = await getDoc(orderRef);
      
      if (!orderDoc.exists()) return;
      
      const order = orderDoc.data() as PurchaseOrder;
      const item = order.items.find(i => i.itemId === itemId);
      
      if (!item || !item.receivedQuantity || !item.actualArrivalDate) {
        toast.error('Jumlah diterima dan tanggal kedatangan harus diisi');
        return;
      }

      if (item.receivedQuantity !== item.quantity) {
        toast.error('Jumlah diterima harus sama dengan jumlah order');
        return;
      }

      const batch = writeBatch(db);

      // Update item stock
      const itemRef = doc(db, 'items', itemId);
      const itemDoc = await getDoc(itemRef);
      
      if (itemDoc.exists()) {
        const currentQuantity = itemDoc.data().quantity || 0;
        batch.update(itemRef, {
          quantity: currentQuantity + item.receivedQuantity
        });
      }

      // Mark item as completed in the order
      const updatedItems = order.items.map(i => 
        i.itemId === itemId ? { ...i, completed: true } : i
      );

      // Check if all items are completed
      const allItemsCompleted = updatedItems.every(i => i.completed);
      
      batch.update(orderRef, { 
        items: updatedItems,
        completed: allItemsCompleted
      });

      await batch.commit();
      toast.success('Barang berhasil diterima dan stock diperbarui');
    } catch (error) {
      console.error('Error completing item:', error);
      toast.error('Gagal menyelesaikan penerimaan barang');
    }
  };

  const filteredOrders = orders.filter(order => {
    const searchLower = orderSearchTerm.toLowerCase();
    return (
      order.orderNumber.toLowerCase().includes(searchLower) ||
      order.supplier.toLowerCase().includes(searchLower) ||
      order.items.some(item => 
        item.itemCode.toLowerCase().includes(searchLower) ||
        item.itemName.toLowerCase().includes(searchLower)
      )
    );
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingBag className="h-6 w-6 text-blue-500" />
              <h2 className="text-2xl font-semibold text-gray-800">
                {editingOrder ? 'Edit Order Pembelian' : 'Buat Order Pembelian'}
              </h2>
            </div>
            {editingOrder && (
              <button
                onClick={cancelEditing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
              >
                <X size={20} />
                Batal Edit
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Supplier */}
            <div>
              <label htmlFor="supplier" className="block text-sm font-medium text-gray-700 mb-1">
                Supplier
              </label>
              <input
                type="text"
                id="supplier"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Nama supplier"
                required
              />
            </div>

            {/* Order Date */}
            <div>
              <label htmlFor="orderDate" className="block text-sm font-medium text-gray-700 mb-1">
                Tanggal Order
              </label>
              <input
                type="date"
                id="orderDate"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

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
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  id="quantity"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={addItemToOrder}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600"
                >
                  Tambah
                </button>
              </div>
            </div>
          </div>

          <OrderList items={currentOrderItems} onRemoveItem={removeItemFromOrder} />

          <div className="flex justify-end gap-3">
            {editingOrder && (
              <button
                type="button"
                onClick={cancelEditing}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Batal
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting || currentOrderItems.length === 0}
              className={`px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                (isSubmitting || currentOrderItems.length === 0) ? 'opacity-75 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? 'Menyimpan...' : editingOrder ? 'Perbarui Order' : 'Simpan Order'}
            </button>
          </div>
        </form>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Daftar Order</h2>
          <div className="relative">
            <input
              type="text"
              placeholder="Cari order..."
              value={orderSearchTerm}
              onChange={(e) => setOrderSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
          </div>
        </div>

        <div className="space-y-6">
          {filteredOrders.map((order) => (
            <div 
              key={order.id} 
              className={`rounded-lg shadow-sm border mb-6 ${
                order.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
              }`}
            >
              <div className="p-4 border-b border-gray-200">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {order.orderNumber}
                    </h3>
                    <div className="mt-1 text-sm text-gray-500">
                      <p>Supplier: {order.supplier}</p>
                      <p>Tanggal Order: {formatDate(order.orderDate)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Estimasi Tanggal Datang
                      </label>
                      <input
                        type="date"
                        value={order.estimatedArrivalDate || ''}
                        onChange={(e) => updateEstimatedDate(order.id, e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                        disabled={order.completed}
                      />
                    </div>

                    {!order.completed && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEditing(order)}
                          className="p-2 text-blue-600 hover:text-blue-800 rounded-lg hover:bg-blue-50"
                          title="Edit order"
                        >
                          <Edit2 size={20} />
                        </button>
                        <button
                          onClick={() => handleDelete(order.id)}
                          disabled={isDeleting}
                          className="p-2 text-red-600 hover:text-red-800 rounded-lg hover:bg-red-50"
                          title="Hapus order"
                        >
                          <Trash2 size={20} />
                        </button>
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
                        Kode Barang
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nama Barang
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Jumlah Order
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Jumlah Diterima
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tanggal Datang
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
                    {order.items.map((item) => (
                      <tr key={item.itemId} className={item.completed ? 'bg-green-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.itemCode}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.itemName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <input
                            type="number"
                            min="0"
                            max={item.quantity}
                            value={item.receivedQuantity || 0}
                            onChange={(e) => updateReceivedQuantity(order.id, item.itemId, parseInt(e.target.value) || 0)}
                            className={`w-20 px-2 py-1 border rounded-md ${
                              !item.completed && !item.actualArrivalDate && item.receivedQuantity === item.quantity
                                ? 'border-yellow-500 focus:ring-yellow-500 focus:border-yellow-500'
                                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                            }`}
                            disabled={item.completed}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <input
                            type="date"
                            value={item.actualArrivalDate || ''}
                            onChange={(e) => updateActualDate(order.id, item.itemId, e.target.value)}
                            className={`px-2 py-1 border rounded-md ${
                              !item.completed && !item.actualArrivalDate && item.receivedQuantity === item.quantity
                                ? 'border-yellow-500 focus:ring-yellow-500 focus:border-yellow-500'
                                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                            }`}
                            disabled={item.completed}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                            ${item.completed ? 'bg-green-100 text-green-800' : 
                              item.receivedQuantity === item.quantity && item.actualArrivalDate ? 'bg-blue-100 text-blue-800' : 
                              item.receivedQuantity ? 'bg-yellow-100 text-yellow-800' : 
                              'bg-gray-100 text-gray-800'}`}>
                            {item.completed ? 'Selesai' :
                             item.receivedQuantity === item.quantity && item.actualArrivalDate ? 'Siap Diselesaikan' : 
                             item.receivedQuantity ? 'Diterima Sebagian' : 
                             'Belum Diterima'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          {!item.completed && item.receivedQuantity === item.quantity && item.actualArrivalDate && (
                            <button
                              onClick={() => updateStockAndCompleteItem(order.id, item.itemId)}
                              className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600"
                            >
                              <Check size={16} />
                              Selesai
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}