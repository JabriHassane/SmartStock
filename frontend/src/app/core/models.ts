// Types miroirs des DTO des microservices (voir services/*/dto).

export type RoleName = 'SUPERADMIN' | 'GESTIONNAIRE' | 'MAGASINIER';
export type StockStatus = 'IN_STOCK' | 'LOW' | 'OUT';
export type UnitOfMeasure = 'PIECE' | 'BOX' | 'PACK' | 'KG' | 'LITER' | 'METER';
export type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER_IN' | 'TRANSFER_OUT';
export type ReferenceType = 'MANUAL' | 'INVENTORY_COUNT' | 'TRANSFER' | 'PURCHASE_ORDER' | 'SALES_ORDER';
export type OrderType = 'PURCHASE' | 'SALE';
export type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ApiError {
  status: number;
  message: string;
}

// ---- auth-service ----
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  roles: RoleName[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  enabled: boolean;
  roles: RoleName[];
  createdAt: string;
}

// ---- inventory-service ----
export interface Category {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  parentId: number | null;
  parentName: string | null;
  productCount: number;
  createdAt: string;
}

export interface Product {
  id: number;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  categoryId: number | null;
  categoryName: string | null;
  categoryColor: string | null;
  unitPrice: number;
  costPrice: number;
  unitOfMeasure: UnitOfMeasure;
  reorderPoint: number;
  reorderQuantity: number;
  active: boolean;
  totalQuantity: number;
  stockStatus: StockStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProductOption {
  id: number;
  sku: string;
  name: string;
  unitPrice: number;
  costPrice: number;
  unitOfMeasure: UnitOfMeasure;
}

export interface WarehouseStock {
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  quantityOnHand: number;
  quantityReserved: number;
}

export interface ProductInsight {
  avgDailyOut: number;
  daysOfCover: number | null;
  suggestedReorder: number;
}

export interface ProductDetail {
  product: Product;
  stock: WarehouseStock[];
  insight: ProductInsight;
}

export interface Warehouse {
  id: number;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  active: boolean;
  productCount: number;
  totalUnits: number;
  stockValue: number;
  createdAt: string;
}

export interface StockLevel {
  id: number;
  productId: number;
  sku: string;
  productName: string;
  categoryName: string | null;
  unitOfMeasure: UnitOfMeasure;
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  quantityOnHand: number;
  quantityReserved: number;
  reorderPoint: number;
  stockValue: number;
  status: StockStatus;
  updatedAt: string;
}

export interface Movement {
  id: number;
  productId: number;
  sku: string;
  productName: string;
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  type: MovementType;
  quantity: number;
  quantityAfter: number;
  unitCost: number | null;
  referenceType: ReferenceType;
  referenceId: string | null;
  reason: string | null;
  createdBy: string;
  createdAt: string;
}

export interface StockAlert {
  productId: number;
  sku: string;
  productName: string;
  categoryName: string | null;
  totalQuantity: number;
  reorderPoint: number;
  reorderQuantity: number;
  status: StockStatus;
  avgDailyOut: number;
  daysOfCover: number | null;
  suggestedReorder: number;
}

export interface InventoryDashboard {
  summary: {
    activeProducts: number;
    categories: number;
    warehouses: number;
    totalUnits: number;
    stockValue: number;
    potentialRevenue: number;
    lowStock: number;
    outOfStock: number;
    movementsToday: number;
  };
  flows: { date: string; in: number; out: number }[];
  categories: { categoryId: number | null; name: string; color: string | null; value: number; units: number; productCount: number }[];
  topProducts: { productId: number; sku: string; name: string; outQuantity: number }[];
  recentMovements: Movement[];
  alerts: StockAlert[];
}

// ---- order-service ----
export interface Partner {
  id: number;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  taxId: string | null;
  notes: string | null;
  active: boolean;
  orderCount: number;
  createdAt: string;
}

export interface OrderLine {
  id: number;
  productId: number;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderSummary {
  id: number;
  orderNumber: string;
  type: OrderType;
  status: OrderStatus;
  partnerId: number;
  partnerName: string;
  warehouseId: number;
  warehouseName: string;
  orderDate: string;
  expectedDate: string | null;
  totalHt: number;
  totalTtc: number;
  createdBy: string;
  createdAt: string;
}

export interface Order extends OrderSummary {
  taxRate: number;
  totalTax: number;
  notes: string | null;
  completedBy: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  lines: OrderLine[];
}

export interface OrderDashboard {
  pendingPurchases: number;
  pendingSales: number;
  purchasesThisMonth: number;
  salesThisMonth: number;
  monthly: { month: string; purchases: number; sales: number }[];
  recent: OrderSummary[];
}
