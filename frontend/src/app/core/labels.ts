import { MovementType, OrderStatus, OrderType, RoleName, StockStatus, UnitOfMeasure } from './models';

/** Devise d'affichage des montants. */
export const CURRENCY = 'MAD';

export const ROLE_LABELS: Record<RoleName, string> = {
  SUPERADMIN: 'Super admin',
  GESTIONNAIRE: 'Gestionnaire',
  MAGASINIER: 'Magasinier',
};

export const ROLE_BADGE: Record<RoleName, string> = {
  SUPERADMIN: 'badge-violet',
  GESTIONNAIRE: 'badge-primary',
  MAGASINIER: 'badge-info',
};

export const STOCK_STATUS: Record<StockStatus, { label: string; badge: string }> = {
  IN_STOCK: { label: 'En stock', badge: 'badge-success' },
  LOW: { label: 'Stock bas', badge: 'badge-warning' },
  OUT: { label: 'Rupture', badge: 'badge-danger' },
};

export const UNIT_LABELS: Record<UnitOfMeasure, string> = {
  PIECE: 'Pièce',
  BOX: 'Carton',
  PACK: 'Paquet',
  KG: 'Kg',
  LITER: 'Litre',
  METER: 'Mètre',
};

export const MOVEMENT_LABELS: Record<MovementType, { label: string; badge: string }> = {
  IN: { label: 'Entrée', badge: 'badge-success' },
  OUT: { label: 'Sortie', badge: 'badge-danger' },
  ADJUSTMENT: { label: 'Ajustement', badge: 'badge-warning' },
  TRANSFER_IN: { label: 'Transfert entrant', badge: 'badge-info' },
  TRANSFER_OUT: { label: 'Transfert sortant', badge: 'badge-violet' },
};

export const ORDER_STATUS: Record<OrderStatus, { label: string; badge: string }> = {
  DRAFT: { label: 'Brouillon', badge: 'badge-muted' },
  CONFIRMED: { label: 'Confirmée', badge: 'badge-primary' },
  COMPLETED: { label: 'Terminée', badge: 'badge-success' },
  CANCELLED: { label: 'Annulée', badge: 'badge-danger' },
};

export const ORDER_TYPE: Record<OrderType, { label: string; short: string; partner: string; complete: string; completed: string }> = {
  PURCHASE: { label: 'Achat', short: 'BA', partner: 'Fournisseur', complete: 'Réceptionner', completed: 'Réceptionnée' },
  SALE: { label: 'Vente', short: 'BV', partner: 'Client', complete: 'Expédier', completed: 'Expédiée' },
};

export const CATEGORY_COLORS = ['#2f73f2', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9', '#ec4899', '#14b8a6', '#6366f1', '#84cc16'];
