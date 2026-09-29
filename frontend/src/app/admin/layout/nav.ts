import { RoleName } from '../../core/models';

export interface NavItem {
  label: string;
  icon: string;
  link: string;
  roles?: RoleName[];
  exact?: boolean;
  keywords?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    title: 'Pilotage',
    items: [
      { label: 'Tableau de bord', icon: 'dashboard', link: '/app', exact: true, keywords: 'accueil kpi statistiques' },
      { label: 'Alertes', icon: 'bell', link: '/app/alerts', keywords: 'rupture stock bas réapprovisionnement prévision' },
    ],
  },
  {
    title: 'Inventaire',
    items: [
      { label: 'Produits', icon: 'package', link: '/app/products', keywords: 'catalogue article sku' },
      { label: 'Catégories', icon: 'tag', link: '/app/categories', keywords: 'famille' },
      { label: 'Entrepôts', icon: 'warehouse', link: '/app/warehouses', keywords: 'dépôt site magasin' },
      { label: 'Niveaux de stock', icon: 'layers', link: '/app/stock', keywords: 'quantité inventaire entrée sortie transfert' },
      { label: 'Mouvements', icon: 'history', link: '/app/movements', keywords: 'historique traçabilité journal' },
    ],
  },
  {
    title: 'Commerce',
    items: [
      { label: 'Commandes', icon: 'file', link: '/app/orders', keywords: 'bon achat vente réception expédition' },
      { label: 'Fournisseurs', icon: 'truck', link: '/app/suppliers', keywords: 'partenaire achat' },
      { label: 'Clients', icon: 'building', link: '/app/customers', keywords: 'partenaire vente' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Utilisateurs', icon: 'users', link: '/app/users', roles: ['SUPERADMIN', 'GESTIONNAIRE'], keywords: 'compte rôle équipe' },
      { label: 'Mon profil', icon: 'user', link: '/app/profile', keywords: 'mot de passe compte' },
    ],
  },
];
