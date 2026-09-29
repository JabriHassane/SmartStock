# Déploiement sur le serveur homelab

Même schéma que MyPortfolio/azwebsite/video-dl-sass sur cette machine : le
stack n'est jamais exposé que sur `127.0.0.1` et l'IP Tailscale de l'hôte
(jamais `0.0.0.0`), et le `cloudflared` déjà en service (tunnel `azwebtech`,
routage configuré dans le dashboard Cloudflare Zero Trust, pas un fichier
local) sera pointé sur `localhost:8446`. Aucune nouvelle route firewall,
aucun nouveau tunnel à créer — juste une route "Public Hostname" de plus sur
le tunnel existant.

Le durcissement serveur (ufw, fail2ban, unattended-upgrades, SSH via
Tailscale uniquement) est déjà fait host-wide depuis le déploiement
d'azwebsite — rien à refaire ici.

## Portée actuelle

Ce déploiement met en ligne :

- `auth-db` + `auth-service` (JWT RS256, RBAC, utilisateurs — `/api/auth/*`, `/api/users/*`)
- `inventory-db` + `inventory-service` (catalogue, entrepôts, stock, mouvements, alertes —
  `/api/categories`, `/api/products`, `/api/warehouses`, `/api/stock/*`, `/api/dashboard/inventory`)
- `order-db` + `order-service` (fournisseurs, clients, commandes — `/api/suppliers`,
  `/api/customers`, `/api/orders/*`, `/api/dashboard/orders`)
- `frontend` (nginx) : sert l'application Angular (landing `/` + espace `/app`),
  termine le TLS et route chaque préfixe `/api/*` vers le bon service. Les bases
  ne sont que sur le réseau `internal`, sans port publié.

Pas encore de `gateway`, `billing-service`, `notification-service` ni Kafka :
order-service appelle inventory-service en REST sur le réseau `internal`
(voir README.md). Quand la gateway existera, les trois upstreams de
`frontend/nginx.conf` basculeront vers `gateway:8080`.

**Même origine, sans CORS** : l'application appelle toujours `/api` en chemin
relatif. nginx transmet `Host`/`X-Forwarded-Proto` et les services
(`server.forward-headers-strategy: framework`) reconstruisent l'URL publique,
donc les appels de l'application sont same-origin quel que soit le point
d'entrée (domaine Cloudflare, IP Tailscale ou localhost). `CORS_ALLOWED_ORIGINS`
ne concerne que les appels depuis un autre domaine.

## 1. Pointer le tunnel Cloudflare existant vers nginx

Dans le [dashboard Cloudflare Zero Trust](https://one.dash.cloudflare.com/)
→ **Networks → Tunnels → azwebtech → Public Hostname**, ajouter une
nouvelle route :

- Public hostname : `smart-stock.azwebtech.net`
- Path : **vide** (tout le domaine — pas `^/api`, sinon l'application
  Angular servie à `/` n'est pas joignable)
- Service type : `HTTPS`
- URL : `localhost:8446`
- Additional application settings → TLS → activer **"No TLS Verify"** —
  requis car le cert nginx est auto-signé, ne validera jamais contre une CA
  publique.

**C'est la seule étape que je ne peux pas faire moi-même** — accès au
dashboard Cloudflare requis. Tout le reste ci-dessous s'exécute sur ce
serveur.

## 2. Premier déploiement

Fichier `.env.production` dédié (pas `.env`) — Compose charge sinon
automatiquement `.env` quel que soit `-f`, ce qui mélangerait cette config
avec celle du `docker-compose.yml` de dev :

```bash
cd /home/hassane/homelab/projects/SmartStock
cp .env.production.example .env.production
# éditer .env.production : AUTH_DB_PASSWORD, INVENTORY_DB_PASSWORD,
# ORDER_DB_PASSWORD et ADMIN_PASSWORD (mots de passe forts, différents du
# .env de dev local — ex. `openssl rand -base64 32`)
chmod 600 .env.production

./scripts/generate-jwt-keys.sh   # si ./secrets/jwt_{private,public}_key n'existent pas déjà

docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Vérifier depuis le serveur lui-même :

```bash
curl -Ik https://localhost:8446/                                    # 200, application Angular
curl -sk -o /dev/null -w '%{http_code}\n' https://localhost:8446/api/products   # 401 sans token
curl -ks https://localhost:8446/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<ADMIN_PASSWORD du .env>"}'   # 200 + access/refresh token
```

Puis, une fois la route Cloudflare de l'étape 1 sauvegardée :
`https://smart-stock.azwebtech.net/` (landing) et `/login`.

## 3. Redéployer après un changement de code

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
# ou un seul service : ... up -d --build inventory-service
```

(`auth_db_data`, `inventory_db_data` et `order_db_data` ne sont jamais recréés
par ceci — volumes nommés persistants.)

## 4. Maintenance courante

- `docker compose -f docker-compose.prod.yml pull` périodiquement pour les
  patchs de sécurité de l'image Postgres, puis `up -d --build` (l'image
  nginx doit être rebuild aussi : le cert auto-signé est généré au build).
- Sauvegarder les trois bases régulièrement, par exemple :
  `docker compose -f docker-compose.prod.yml --env-file .env.production exec -T inventory-db pg_dump -U inventory inventory > inventory.sql`
  (idem `auth-db`/`auth`, `order-db`/`orders`).
- Roter `AUTH_DB_PASSWORD`/`ADMIN_PASSWORD`/les clés JWT si l'une est
  suspectée d'avoir fuité (roter les clés JWT invalide tous les tokens en
  cours).

## Pas encore fait — à prévoir

- Le watchdog `docker-restart-watchdog` (auto-recovery après un endpoint
  réseau cassé au reboot, voir `azwebsite/deploy/systemd/`) n'est pas
  installé sur ce serveur pour l'instant, alors qu'il est host-wide et
  couvrirait aussi SmartStock une fois activé.
- Pas de sauvegarde automatisée des bases (manuel pour l'instant).
