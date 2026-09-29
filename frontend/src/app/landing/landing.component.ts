import { ChangeDetectionStrategy, Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { UiService } from '../core/ui.service';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
})
export class LandingComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly ui = inject(UiService);

  protected readonly scrolled = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly year = new Date().getFullYear();

  protected readonly features = [
    { icon: 'package', title: 'Catalogue produits', text: 'SKU, codes-barres, prix d\'achat et de vente, unités, seuils de réapprovisionnement — tout votre catalogue au même endroit.', tone: 'blue' },
    { icon: 'warehouse', title: 'Multi-entrepôts', text: 'Suivez chaque produit dans chaque dépôt et transférez du stock entre sites en deux clics, avec traçabilité complète.', tone: 'green' },
    { icon: 'cart', title: 'Achats & ventes', text: 'Bons de commande fournisseurs et clients, du brouillon à la réception : le stock se met à jour automatiquement.', tone: 'amber' },
    { icon: 'history', title: 'Traçabilité totale', text: 'Chaque entrée, sortie, ajustement ou transfert est horodaté et attribué à un utilisateur. Rien ne se perd.', tone: 'violet' },
    { icon: 'shield', title: 'Rôles & sécurité', text: 'Super admin, gestionnaire, magasinier : chacun voit et fait uniquement ce qui le concerne. Authentification JWT RS256.', tone: 'blue' },
    { icon: 'download', title: 'Exports & impression', text: 'Exportez produits, stocks et mouvements en CSV, imprimez vos bons de commande en un clic.', tone: 'green' },
  ];

  protected readonly steps = [
    { icon: 'settings', title: 'Configurez', text: 'Créez vos entrepôts, catégories et produits avec leurs seuils d\'alerte.' },
    { icon: 'transfer', title: 'Opérez', text: 'Enregistrez entrées, sorties, inventaires et transferts, ou laissez vos commandes le faire.' },
    { icon: 'sparkles', title: 'Anticipez', text: 'SmartStock calcule la vélocité de vos ventes et prédit les ruptures avant qu\'elles n\'arrivent.' },
    { icon: 'send', title: 'Réapprovisionnez', text: 'Suivez la quantité suggérée et créez le bon de commande fournisseur en un instant.' },
  ];

  protected readonly roles = [
    { name: 'Super admin', icon: 'shield', badge: 'badge-violet', perms: ['Gestion des utilisateurs et des rôles', 'Accès complet au catalogue et aux commandes', 'Configuration des entrepôts'] },
    { name: 'Gestionnaire', icon: 'chart', badge: 'badge-primary', perms: ['Catalogue, catégories et partenaires', 'Création et validation des commandes', 'Tableaux de bord et alertes'] },
    { name: 'Magasinier', icon: 'package', badge: 'badge-info', perms: ['Entrées, sorties et transferts', 'Inventaires physiques (ajustements)', 'Réception et expédition des commandes'] },
  ];

  protected readonly faqs = [
    { q: 'Comment SmartStock prédit-il les ruptures ?', a: 'Pour chaque produit, SmartStock calcule la vitesse moyenne de sortie sur les 30 derniers jours et en déduit le nombre de jours de stock restants. Dès qu\'un produit passe sous son seuil ou risque la rupture sous 7 jours, il apparaît dans les alertes avec une quantité de réapprovisionnement suggérée.' },
    { q: 'Puis-je gérer plusieurs entrepôts ?', a: 'Oui. Chaque produit a un niveau de stock par entrepôt, et les transferts entre sites génèrent automatiquement un mouvement sortant et un mouvement entrant liés.' },
    { q: 'Que se passe-t-il quand je réceptionne une commande ?', a: 'La réception d\'un bon d\'achat fait entrer les quantités dans l\'entrepôt choisi ; l\'expédition d\'une vente les fait sortir. L\'opération est tout ou rien : si le stock est insuffisant pour une ligne, rien n\'est modifié.' },
    { q: 'Mes données sont-elles sécurisées ?', a: 'Les mots de passe sont hachés (BCrypt), les sessions reposent sur des jetons JWT signés RS256 à durée courte, chaque service vérifie les droits de l\'utilisateur, et l\'application n\'est servie qu\'en HTTPS.' },
  ];

  ngOnInit(): void {
    this.ui.applyTheme('light', false);
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled.set(window.scrollY > 12);
  }
}
