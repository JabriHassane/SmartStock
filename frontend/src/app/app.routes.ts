import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./landing/landing.component').then(m => m.LandingComponent), title: 'SmartStock — Gestion de stock intelligente' },
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./auth/login.component').then(m => m.LoginComponent), title: 'Connexion — SmartStock' },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./admin/layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      { path: '', loadComponent: () => import('./admin/dashboard/dashboard.component').then(m => m.DashboardComponent), title: 'Tableau de bord — SmartStock' },
      { path: 'products', loadComponent: () => import('./admin/products/products.component').then(m => m.ProductsComponent), title: 'Produits — SmartStock' },
      { path: 'products/:id', loadComponent: () => import('./admin/products/product-detail.component').then(m => m.ProductDetailComponent), title: 'Produit — SmartStock' },
      { path: 'categories', loadComponent: () => import('./admin/categories/categories.component').then(m => m.CategoriesComponent), title: 'Catégories — SmartStock' },
      { path: 'warehouses', loadComponent: () => import('./admin/warehouses/warehouses.component').then(m => m.WarehousesComponent), title: 'Entrepôts — SmartStock' },
      { path: 'stock', loadComponent: () => import('./admin/stock/stock.component').then(m => m.StockComponent), title: 'Niveaux de stock — SmartStock' },
      { path: 'movements', loadComponent: () => import('./admin/movements/movements.component').then(m => m.MovementsComponent), title: 'Mouvements — SmartStock' },
      { path: 'alerts', loadComponent: () => import('./admin/alerts/alerts.component').then(m => m.AlertsComponent), title: 'Alertes — SmartStock' },
      { path: 'orders', loadComponent: () => import('./admin/orders/orders.component').then(m => m.OrdersComponent), title: 'Commandes — SmartStock' },
      { path: 'orders/new', canActivate: [roleGuard], data: { roles: ['SUPERADMIN', 'GESTIONNAIRE'] }, loadComponent: () => import('./admin/orders/order-form.component').then(m => m.OrderFormComponent), title: 'Nouvelle commande — SmartStock' },
      { path: 'orders/:id/edit', canActivate: [roleGuard], data: { roles: ['SUPERADMIN', 'GESTIONNAIRE'] }, loadComponent: () => import('./admin/orders/order-form.component').then(m => m.OrderFormComponent), title: 'Modifier la commande — SmartStock' },
      { path: 'orders/:id', loadComponent: () => import('./admin/orders/order-detail.component').then(m => m.OrderDetailComponent), title: 'Commande — SmartStock' },
      { path: 'suppliers', data: { kind: 'suppliers' }, loadComponent: () => import('./admin/partners/partners.component').then(m => m.PartnersComponent), title: 'Fournisseurs — SmartStock' },
      { path: 'customers', data: { kind: 'customers' }, loadComponent: () => import('./admin/partners/partners.component').then(m => m.PartnersComponent), title: 'Clients — SmartStock' },
      { path: 'users', canActivate: [roleGuard], data: { roles: ['SUPERADMIN', 'GESTIONNAIRE'] }, loadComponent: () => import('./admin/users/users.component').then(m => m.UsersComponent), title: 'Utilisateurs — SmartStock' },
      { path: 'profile', loadComponent: () => import('./admin/profile/profile.component').then(m => m.ProfileComponent), title: 'Mon profil — SmartStock' },
    ],
  },
  { path: '**', redirectTo: '' },
];
