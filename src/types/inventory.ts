export interface Item {
  id: string;
  code: string;
  name: string;
  category: string;
  quantity: number;
  location?: string;
  createdAt?: string;
}

export interface OrderItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  receivedQuantity?: number;
  actualArrivalDate?: string;
  completed: boolean;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplier: string;
  orderDate: string;
  estimatedArrivalDate?: string;
  items: OrderItem[];
  completed: boolean;
}

export interface ReturnItem extends Item {
  trackingNumber?: string;
}

export interface ReportItem extends Item {
  totalSales: number;
  pendingStock: number;
  stockStatus: 'stock_sufficient' | 'buy_soon' | 'prepare_to_buy';
}