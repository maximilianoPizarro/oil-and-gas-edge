#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
out=$(helm template oilgas-gateway "$root/charts/hub/oilgas-gateway" \
  --set gateway.hostname=ignition.apps.example.com \
  --set oidc.issuerURL=https://rhbk.apps.example.com/realms/oilgas \
  --set oidc.clientID=ignition-hmi)
printf '%s\n' "$out" | grep -q 'kind: OIDCPolicy'
printf '%s\n' "$out" | grep -q 'name: oilgas-login'
printf '%s\n' "$out" | grep -q 'kind: Gateway'
printf '%s\n' "$out" | grep -q '/protocol/openid-connect/auth'
printf '%s\n' "$out" | grep -q 'https://ignition.apps.example.com/auth/callback'
# The JWT AuthPolicy must be gone. A generated one is owned by the operator, not by this chart.
if printf '%s\n' "$out" | grep -q 'kind: AuthPolicy'; then
  echo "chart still renders AuthPolicy" >&2
  exit 1
fi
echo "render-gateway: ok"
