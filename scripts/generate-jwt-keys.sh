#!/usr/bin/env bash
# Génère la paire de clés RSA utilisée par auth-service pour signer les JWT
# (RS256) et par la gateway pour les vérifier. À lancer une fois avant le
# premier `docker compose up` (ou après avoir supprimé ./secrets).
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f secrets/jwt_private_key ]; then
  echo "secrets/jwt_private_key existe déjà — rien à faire." >&2
  exit 0
fi

mkdir -p secrets
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out secrets/jwt_private_key
openssl rsa -pubout -in secrets/jwt_private_key -out secrets/jwt_public_key
chmod 600 secrets/jwt_private_key

echo "Clés RSA générées dans ./secrets/ (jwt_private_key, jwt_public_key)."
