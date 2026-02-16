
export enum TransactionType {
  IN = 'IN',
  OUT = 'OUT'
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  minThreshold: number;
  purchasePrice: number;
  sellingPrice: number;
  boxNumber: string;
  description: string;
  lastUpdated: number;
}

export interface Transaction {
  id: string;
  productId: string;
  productName: string;
  type: TransactionType;
  quantity: number;
  reason: string;
  timestamp: number;
  userId: string;
}

export interface InventoryStats {
  totalItems: number;
  lowStockItems: number;
  totalValue: number;
  outOfStock: number;
}
