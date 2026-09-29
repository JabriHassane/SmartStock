# En-têtes communs à toutes les locations /api/* (voir nginx.conf).
# $http_host garde le port (ex. 100.103.213.104:8446) : avec
# X-Forwarded-Proto, les services (server.forward-headers-strategy:
# framework) reconstruisent l'URL publique exacte, donc une requête de
# l'application Angular est bien vue comme same-origin et n'est jamais
# soumise au filtre CORS de Spring.
proxy_set_header Host $http_host;
proxy_set_header X-Forwarded-Host $http_host;
proxy_set_header X-Forwarded-Proto $scheme;
# IP réelle du client pour le journal de sécurité des services :
# CF-Connecting-IP derrière Cloudflare, sinon l'IP de connexion (Tailscale).
# Valeur écrasée (pas ajoutée) : nginx est le seul point d'entrée, un
# X-Forwarded-For envoyé par le client n'est jamais relayé.
proxy_set_header X-Real-IP $rate_limit_key;
proxy_set_header X-Forwarded-For $rate_limit_key;
