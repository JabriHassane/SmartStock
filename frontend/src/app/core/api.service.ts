import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Category, InventoryDashboard, Movement, MovementType, Order, OrderDashboard, OrderStatus, OrderSummary, OrderType,
  Page, Partner, Product, ProductDetail, ProductOption, RoleName, StockAlert, StockLevel, StockStatus, User, Warehouse,
} from './models';

type Params = Record<string, string | number | boolean | null | undefined>;

function toParams(params: Params = {}): HttpParams {
  let p = new HttpParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') p = p.set(key, String(value));
  }
  return p;
}

/** Message lisible pour l'utilisateur à partir d'une erreur HTTP des services. */
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Serveur injoignable. Vérifiez votre connexion.';
    if (err.status === 429) return 'Trop de tentatives, réessayez dans une minute.';
    const message = err.error?.message;
    if (typeof message === 'string' && message) return message;
    if (err.status === 403) return 'Vous n\'avez pas les droits pour cette action.';
    if (err.status >= 500) return 'Erreur serveur, réessayez plus tard.';
  }
  return 'Une erreur est survenue.';
}

export interface ProductPayload {
  sku: string; barcode: string | null; name: string; description: string | null; categoryId: number | null;
  unitPrice: number; costPrice: number; unitOfMeasure: string; reorderPoint: number; reorderQuantity: number; active: boolean;
}

export interface OrderPayload {
  type: OrderType; partnerId: number; warehouseId: number; orderDate: string | null; expectedDate: string | null;
  taxRate: number; notes: string | null; lines: { productId: number; quantity: number; unitPrice: number }[];
}

export type PartnerKind = 'suppliers' | 'customers';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // ---- Utilisateurs ----
  users(): Observable<User[]> { return this.http.get<User[]>('/api/users'); }
  createUser(body: { username: string; email: string; password: string; firstName: string | null; lastName: string | null; roles: RoleName[] }): Observable<User> {
    return this.http.post<User>('/api/users', body);
  }
  updateUser(id: number, body: { email: string; firstName: string | null; lastName: string | null; roles: RoleName[]; enabled: boolean }): Observable<User> {
    return this.http.put<User>(`/api/users/${id}`, body);
  }
  resetPassword(id: number, password: string): Observable<void> { return this.http.put<void>(`/api/users/${id}/password`, { password }); }
  deleteUser(id: number): Observable<void> { return this.http.delete<void>(`/api/users/${id}`); }
  updateProfile(body: { email: string; firstName: string | null; lastName: string | null }): Observable<User> {
    return this.http.put<User>('/api/users/me', body);
  }
  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.put<void>('/api/users/me/password', { currentPassword, newPassword });
  }

  // ---- Catégories ----
  categories(): Observable<Category[]> { return this.http.get<Category[]>('/api/categories'); }
  saveCategory(id: number | null, body: { name: string; description: string | null; color: string | null; parentId: number | null }): Observable<Category> {
    return id ? this.http.put<Category>(`/api/categories/${id}`, body) : this.http.post<Category>('/api/categories', body);
  }
  deleteCategory(id: number): Observable<void> { return this.http.delete<void>(`/api/categories/${id}`); }

  // ---- Produits ----
  products(params: { search?: string; categoryId?: number | null; status?: StockStatus | null; active?: boolean | null; page?: number; size?: number; sort?: string; direction?: string }): Observable<Page<Product>> {
    return this.http.get<Page<Product>>('/api/products', { params: toParams(params) });
  }
  productOptions(): Observable<ProductOption[]> { return this.http.get<ProductOption[]>('/api/products/options'); }
  product(id: number): Observable<ProductDetail> { return this.http.get<ProductDetail>(`/api/products/${id}`); }
  saveProduct(id: number | null, body: ProductPayload): Observable<Product> {
    return id ? this.http.put<Product>(`/api/products/${id}`, body) : this.http.post<Product>('/api/products', body);
  }
  deleteProduct(id: number): Observable<void> { return this.http.delete<void>(`/api/products/${id}`); }

  // ---- Entrepôts ----
  warehouses(): Observable<Warehouse[]> { return this.http.get<Warehouse[]>('/api/warehouses'); }
  saveWarehouse(id: number | null, body: { code: string; name: string; address: string | null; city: string | null; active: boolean }): Observable<Warehouse> {
    return id ? this.http.put<Warehouse>(`/api/warehouses/${id}`, body) : this.http.post<Warehouse>('/api/warehouses', body);
  }
  deleteWarehouse(id: number): Observable<void> { return this.http.delete<void>(`/api/warehouses/${id}`); }

  // ---- Stock ----
  stock(params: { search?: string; warehouseId?: number | null; status?: StockStatus | null; page?: number; size?: number }): Observable<Page<StockLevel>> {
    return this.http.get<Page<StockLevel>>('/api/stock', { params: toParams(params) });
  }
  movements(params: { productId?: number | null; warehouseId?: number | null; type?: MovementType | null; from?: string | null; to?: string | null; search?: string; page?: number; size?: number }): Observable<Page<Movement>> {
    return this.http.get<Page<Movement>>('/api/stock/movements', { params: toParams(params) });
  }
  recordMovement(body: { productId: number; warehouseId: number; type: MovementType; quantity: number; unitCost: number | null; reason: string | null; reference: string | null }): Observable<Movement> {
    return this.http.post<Movement>('/api/stock/movements', body);
  }
  transfer(body: { productId: number; fromWarehouseId: number; toWarehouseId: number; quantity: number; reason: string | null }): Observable<Movement[]> {
    return this.http.post<Movement[]>('/api/stock/transfers', body);
  }
  alerts(): Observable<StockAlert[]> { return this.http.get<StockAlert[]>('/api/stock/alerts'); }
  inventoryDashboard(days = 30): Observable<InventoryDashboard> {
    return this.http.get<InventoryDashboard>('/api/dashboard/inventory', { params: toParams({ days }) });
  }

  // ---- Partenaires ----
  partners(kind: PartnerKind): Observable<Partner[]> { return this.http.get<Partner[]>(`/api/${kind}`); }
  savePartner(kind: PartnerKind, id: number | null, body: Omit<Partner, 'id' | 'orderCount' | 'createdAt'>): Observable<Partner> {
    return id ? this.http.put<Partner>(`/api/${kind}/${id}`, body) : this.http.post<Partner>(`/api/${kind}`, body);
  }
  deletePartner(kind: PartnerKind, id: number): Observable<void> { return this.http.delete<void>(`/api/${kind}/${id}`); }

  // ---- Commandes ----
  orders(params: { type?: OrderType | null; status?: OrderStatus | null; search?: string; page?: number; size?: number }): Observable<Page<OrderSummary>> {
    return this.http.get<Page<OrderSummary>>('/api/orders', { params: toParams(params) });
  }
  order(id: number): Observable<Order> { return this.http.get<Order>(`/api/orders/${id}`); }
  saveOrder(id: number | null, body: OrderPayload): Observable<Order> {
    return id ? this.http.put<Order>(`/api/orders/${id}`, body) : this.http.post<Order>('/api/orders', body);
  }
  orderAction(id: number, action: 'confirm' | 'complete' | 'cancel'): Observable<Order> {
    return this.http.post<Order>(`/api/orders/${id}/${action}`, {});
  }
  deleteOrder(id: number): Observable<void> { return this.http.delete<void>(`/api/orders/${id}`); }
  orderDashboard(): Observable<OrderDashboard> { return this.http.get<OrderDashboard>('/api/dashboard/orders'); }
}
