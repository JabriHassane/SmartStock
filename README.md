# SmartStock

Plateforme de gestion de stock — architecture microservices pilotée par
les événements (Kafka), Spring Boot + Angular, dans le même système
d'infrastructure que les autres projets du homelab (voir
[Infrastructure](#infrastructure) plus bas).

## Avancement

- [x] Infrastructure (`docker-compose.yml`, réseaux, bases, Kafka)
- [x] `auth-service` — JWT RS256, RBAC (SuperAdmin/Gestionnaire/Magasinier), refresh tokens, gestion complète des utilisateurs (création, modification, désactivation, réinitialisation/changement de mot de passe, profil)
- [x] `inventory-service` — catégories, produits, entrepôts, niveaux de stock, mouvements (entrée/sortie/inventaire/transfert), alertes et prévision de rupture, tableau de bord
- [x] `order-service` — fournisseurs, clients, bons d'achat/vente (brouillon → confirmé → réceptionné/expédié), mise à jour du stock via inventory-service
- [ ] `billing-service`
- [ ] `notification-service`
- [ ] `gateway`
- [x] Frontend Angular — landing page + espace d'administration (voir [Frontend](#frontend))

## Microservices

| Service | Rôle | Base |
|---|---|---|
| `auth-service` | Authentification (JWT RS256), utilisateurs, RBAC (SuperAdmin / Gestionnaire / Magasinier) | `auth-db` |
| `inventory-service` | Catalogue produits, catégories, niveaux de stock, mouvements, règles de réapprovisionnement (stock prédictif) | `inventory-db` |
| `order-service` | Bons de commande fournisseurs/clients | `order-db` |
| `billing-service` | Facturation, génération PDF | `billing-db` |
| `notification-service` | Consomme tous les topics Kafka : audit, alertes, diffusion WebSocket vers le dashboard | `notification-db` |
| `gateway` | Spring Cloud Gateway — point d'entrée unique de l'API, validation JWT, routage | — |

**Écart justifié par rapport à la demande initiale :** pas de Eureka/Consul.
Le nombre de services est fixe et connu à l'avance ; la gateway route vers
des noms DNS Docker statiques (`inventory-service:8080`, etc.), exactement
comme MyPortfolio/azwebsite résolvent déjà `backend`/`app` via le DNS
interne de Docker (`127.0.0.11`). Un registre de service ajouterait de la
complexité opérationnelle sans bénéfice réel à cette échelle.

Seule la `gateway` est atteignable depuis l'extérieur du réseau Docker (via
le frontend). Les 5 microservices métier et leurs bases ne sont joignables
que par les autres conteneurs du projet — même sans bug applicatif, ils ne
sont tout simplement pas exposés.

## Flux transactionnel complet : Commande → Facture → Stock

Style **chorégraphié** (chaque service réagit aux événements des autres,
pas d'orchestrateur central) :

1. **Commande** — Un Gestionnaire crée un bon de commande client dans
   `order-service` (`DRAFT` → `CONFIRMED`). À la confirmation,
   `order-service` publie `order.confirmed` sur le topic `order-events`
   (orderId, type, lignes).
2. **Facturation** — `billing-service` consomme `order.confirmed`, génère
   une facture (`PENDING`), produit le PDF. À la validation par le
   Gestionnaire, publie `invoice.validated` sur `invoice-events`
   (invoiceId, orderId, type, lignes).
3. **Mise à jour du stock** — `inventory-service` consomme
   `invoice.validated` : décrémente (vente client) ou incrémente (achat
   fournisseur) `stock_levels`, insère une ligne `stock_movements`, publie
   `stock.movement` sur `stock-events` (consommé par le dashboard temps
   réel). Recalcule la vélocité de vente du produit.
4. **Stock prédictif** — si `quantity_on_hand` passe sous
   `reorder_point`, `inventory-service` publie `alert.low-stock` sur
   `alert-events`. Si `auto_reorder_enabled`, publie aussi
   `reorder.suggested` (commande) ; `order-service` le consomme et crée
   automatiquement un bon de commande fournisseur en `DRAFT`, en attente
   de validation humaine — jamais d'envoi automatique sans validation.
5. **Audit & alertes temps réel** — `notification-service` consomme
   TOUS les topics ci-dessus, persiste chaque événement dans
   `audit_logs`, et pousse les alertes/mouvements sur le WebSocket du
   dashboard (`/ws/` via la gateway) pour un affichage live côté Angular.

> Piste d'amélioration pour la suite (pas implémentée à ce stade) :
> pattern **Transactional Outbox** dans chaque service producteur, pour
> garantir qu'une écriture DB et la publication Kafka correspondante ne
> divergent jamais (write DB + publish Kafka ne sont pas atomiques par
> défaut). On pourra l'ajouter au moment d'implémenter `order-service`
> et `billing-service`.

## Sécurité

- `auth-service` signe les JWT en **RS256** (clé privée), inclut les
  rôles dans les claims.
- `gateway` vérifie la signature avec la **clé publique** uniquement
  (jamais la clé privée) et rejette toute requête non authentifiée avant
  qu'elle n'atteigne un microservice.
- RBAC appliqué à deux niveaux : routes autorisées par rôle au niveau de
  la gateway, puis `@PreAuthorize` dans chaque service sur les
  opérations sensibles.
- Angular : `HttpInterceptor` pour le JWT + `Guard` sur les routes selon
  le rôle.
- **Sessions** : access token de 15 min (issuer vérifié par tous les
  services), refresh token opaque tourné à chaque usage ; réutiliser un
  refresh token déjà consommé révoque toutes les sessions de l'utilisateur
  (détection de vol). Désactivation, changement de rôle ou de mot de passe
  = sessions révoquées.
- **Anti brute-force** : 5 échecs → compte verrouillé 15 min
  (`MAX_FAILED_LOGINS`, `LOCKOUT_DURATION`), en plus de la limite nginx
  (5 tentatives/min/IP, réponse 429).
- **Mots de passe** : BCrypt coût 12 ; 10 à 72 caractères avec majuscule,
  minuscule et chiffre (`@StrongPassword`).
- **Appels internes** : `/api/stock/movements/batch` exige le secret
  `INTERNAL_API_TOKEN` (comparaison à temps constant) et est bloqué par
  nginx côté public.
- **Entrées** : tailles maximales sur tous les champs texte, listes et
  montants ; erreurs génériques côté client, détails journalisés côté
  serveur uniquement.
- **Journal de sécurité** : lignes `SECURITY` (connexions réussies/échouées,
  verrouillages, réutilisation de token, gestion des comptes, accès
  refusés) avec l'IP réelle du client (`docker logs smartstock-auth-service-1 | grep SECURITY`).
- **Conteneurs** : JRE non-root (uid 1000), système de fichiers en lecture
  seule (`/tmp` en tmpfs), aucune capacité Linux, `no-new-privileges`.

## Schéma de base de données (par microservice)

### `auth-db`
- `users(id, username, email, password_hash, first_name, last_name, enabled, created_at, updated_at)`
- `roles(id, name)` — SUPERADMIN, GESTIONNAIRE, MAGASINIER
- `user_roles(user_id, role_id)`
- `refresh_tokens(id, user_id, token_hash, expires_at, revoked)`

### `inventory-db`
- `categories(id, name, description, parent_id)`
- `products(id, sku, name, description, category_id, unit_price, unit_of_measure, reorder_point, reorder_quantity, created_at, updated_at)`
- `warehouses(id, name, address)`
- `stock_levels(id, product_id, warehouse_id, quantity_on_hand, quantity_reserved, updated_at)` — unique (`product_id`, `warehouse_id`)
- `stock_movements(id, product_id, warehouse_id, movement_type[IN|OUT], quantity, reference_type[ORDER|INVOICE|ADJUSTMENT], reference_id, created_at, created_by)`
- `replenishment_rules(id, product_id, warehouse_id, min_threshold, max_threshold, avg_daily_velocity, auto_reorder_enabled, last_computed_at)` — moteur du stock prédictif

### `order-db`
- `suppliers(id, name, contact_email, phone, address)`
- `customers(id, name, contact_email, phone, address)`
- `purchase_orders(id, type[SUPPLIER|CUSTOMER], partner_id, status[DRAFT|CONFIRMED|INVOICED|CANCELLED], order_date, expected_date, created_by, created_at)`
- `order_lines(id, order_id, product_id, quantity, unit_price)`

### `billing-db`
- `invoices(id, order_id, invoice_number, type[PURCHASE|SALE], status[PENDING|VALIDATED|PAID|CANCELLED], issue_date, due_date, total_ht, total_ttc, pdf_path)`
- `invoice_lines(id, invoice_id, product_id, description, quantity, unit_price, tax_rate)`

### `notification-db`
- `audit_logs(id, event_type, aggregate_type, aggregate_id, payload_json, occurred_at, processed_at)`
- `alerts(id, type[LOW_STOCK|REORDER_SUGGESTED], product_id, warehouse_id, message, severity, status[NEW|ACK|RESOLVED], created_at)`

## Infrastructure

Voir `docker-compose.yml` (dev) — respecte le système déjà utilisé pour
MyPortfolio/azwebsite :

- **Isolation réseau par projet** : Docker préfixe automatiquement les
  réseaux avec `smartstock_`, donc aucun conflit possible avec
  `myportfolio_*` / `azwebsite_*` / `homelab_*`, même en réutilisant des
  noms de service courants.
- **Aucun port jamais publié sur `0.0.0.0`** — uniquement `127.0.0.1`.
  Les 5 bases sont accessibles en loopback pour le dev (`5433`-`5437`,
  choisis pour ne pas entrer en collision avec le Postgres global du
  homelab sur `5432`, ni avec les autres projets). Kafka n'est pas
  exposé à l'hôte (pas de besoin identifié pour l'instant).
- **Un seul service public** : `frontend` (nginx + Angular), sur
  `FRONTEND_PORT` (8446 par défaut — libre, après 8443/azwebsite et
  8444/myportfolio).
- Le split réseau `internal`/`edge` + TLS auto-signé + publication sur
  l'IP Tailscale (pattern des `docker-compose.prod.yml` existants)
  arrivera dans un `docker-compose.prod.yml` une fois le système
  fonctionnel en dev — même logique que MyPortfolio/azwebsite.

### Démarrage

```bash
cp .env.example .env               # éditer les mots de passe
./scripts/generate-jwt-keys.sh     # génère ./secrets/jwt_{private,public}_key (RS256)
docker compose up -d               # au fur et à mesure que les services sont implémentés
```

Ce fichier n'est pas encore "up-able" en entier : chaque
`services/<service>/` sera créé au moment où on implémente le service
correspondant (Dockerfile, code, config), pas généré d'un bloc.

### `auth-service`

Premier service implémenté. Endpoints :

| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| POST | `/api/auth/login` | public | — |
| POST | `/api/auth/refresh` | public (refresh token en body) | — |
| POST | `/api/auth/logout` | public (refresh token en body) | — |
| POST | `/api/users` | JWT | SUPERADMIN |
| GET | `/api/users` | JWT | SUPERADMIN, GESTIONNAIRE |
| GET | `/api/users/me` | JWT | tout utilisateur authentifié |

Au premier démarrage (table `users` vide), un compte SuperAdmin est créé
automatiquement à partir de `ADMIN_USERNAME`/`ADMIN_EMAIL`/`ADMIN_PASSWORD`
(`.env`) — c'est la seule façon de créer les comptes Gestionnaire/Magasinier
suivants, `POST /api/users` étant réservé au SuperAdmin.

Le refresh token est opaque (aléatoire, jamais un JWT) : seul son hash
SHA-256 est stocké en base (`refresh_tokens.token_hash`), et il est tourné
(révoqué + réémis) à chaque `/api/auth/refresh`.

```bash
docker compose up -d auth-db kafka auth-service
curl -X POST http://localhost:8081/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"change-me"}'
```

(`8081` = port de la `gateway` une fois celle-ci implémentée ; en attendant,
publier temporairement le port 8080 d'`auth-service` pour tester en
isolation.)

### `inventory-service`

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/categories` | tous |
| POST/PUT/DELETE | `/api/categories[/{id}]` | SUPERADMIN, GESTIONNAIRE |
| GET | `/api/products` (filtres `search`, `categoryId`, `status`, `active`, pagination) | tous |
| GET | `/api/products/options`, `/api/products/{id}` (stock par entrepôt + prévision) | tous |
| POST/PUT/DELETE | `/api/products[/{id}]` | SUPERADMIN, GESTIONNAIRE |
| GET | `/api/warehouses` | tous |
| POST/PUT | `/api/warehouses[/{id}]` | SUPERADMIN, GESTIONNAIRE |
| DELETE | `/api/warehouses/{id}` | SUPERADMIN |
| GET | `/api/stock`, `/api/stock/movements`, `/api/stock/alerts` | tous |
| POST | `/api/stock/movements` (IN/OUT/ADJUSTMENT), `/api/stock/transfers` | tous (Magasinier inclus) |
| POST | `/api/stock/movements/batch` | appelé par order-service (idempotent par n° de commande) |
| GET | `/api/dashboard/inventory?days=30` | tous |

**Prévision de rupture** : vélocité = sorties (`OUT`) des 30 derniers jours / 30 ;
couverture = stock / vélocité. Un produit est en alerte s'il est en rupture,
sous son seuil, ou à moins de 7 jours de couverture ; la quantité suggérée
couvre 30 jours (ou la quantité de réappro. du produit si plus grande).

Chaque mouvement verrouille sa ligne `stock_levels` (`PESSIMISTIC_WRITE`) ;
un stock ne peut jamais devenir négatif (contrainte SQL + contrôle métier).

### `order-service`

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/suppliers`, `/api/customers` | tous |
| POST/PUT/DELETE | `/api/suppliers[/{id}]`, `/api/customers[/{id}]` | SUPERADMIN, GESTIONNAIRE |
| GET | `/api/orders` (filtres `type`, `status`, `search`), `/api/orders/{id}` | tous |
| POST/PUT | `/api/orders[/{id}]` (brouillon uniquement) | SUPERADMIN, GESTIONNAIRE |
| POST | `/api/orders/{id}/confirm`, `/cancel` ; DELETE `/api/orders/{id}` | SUPERADMIN, GESTIONNAIRE |
| POST | `/api/orders/{id}/complete` (réception/expédition) | tous (Magasinier inclus) |
| GET | `/api/dashboard/orders` | tous |

**Écart assumé par rapport au flux Kafka décrit plus haut** : en attendant
`billing-service` et `notification-service`, la réception/expédition d'une
commande appelle `inventory-service` en REST synchrone (JWT de l'utilisateur
relayé) et applique toutes les lignes en une transaction. Avantage : un
stock insuffisant est refusé immédiatement et la commande reste
`CONFIRMED`. L'appel est idempotent (référence = n° de commande), donc un
nouvel essai après une panne ne double jamais le stock. Kafka reviendra
avec la facturation.

## Frontend

Angular 18 (standalone, signals), sans librairie UI : design system maison
aux couleurs AzWebSolution (bleu `#2f73f2`, marine `#102d47`/`#081738`,
police DM Sans), graphiques SVG faits main, icônes embarquées — aucune
ressource externe hormis Google Fonts, compatible avec la CSP stricte de
nginx.

- **Landing page** (`/`) : hero avec aperçu animé du tableau de bord,
  fonctionnalités en bento, étapes, prévisions, rôles, FAQ.
- **Espace d'administration** (`/app`) : barre latérale repliable, barre
  du haut, recherche globale `Ctrl/⌘ + K`, thème clair/sombre, responsive.
  Tableau de bord (KPI, flux, valeur par catégorie, ventes/achats, alertes,
  derniers mouvements, top sorties), produits (+ fiche avec prévision),
  catégories, entrepôts, niveaux de stock, mouvements, alertes, commandes
  (formulaire + suivi + impression), fournisseurs, clients, utilisateurs,
  profil. Exports CSV (séparateur `;`, compatible Excel).
- **API** : toujours en chemin relatif `/api` (même origine que
  l'application) — jamais d'URL absolue, donc pas de CORS et une CSP
  `connect-src 'self'`.

Dev local : `cd frontend && npm install && npm start` (proxy `/api` vers
`https://localhost:8446`, voir `proxy.conf.json`).

## Déploiement (production)

Voir [`DEPLOY.md`](./DEPLOY.md) — même pattern que MyPortfolio/azwebsite/
video-dl-sass sur le serveur homelab (`docker-compose.prod.yml`, TLS
auto-signé, réseaux `internal`/`edge`, publication sur l'IP Tailscale,
tunnel Cloudflare existant). Portée actuelle : auth, inventory, order et
le frontend Angular ; billing, notification et gateway restent à faire.
