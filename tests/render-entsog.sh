#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
out=$(helm template oilgas-gateway "$root/charts/hub/oilgas-gateway" \
  --set gateway.hostname=ignition.apps.example.com \
  --set oidc.issuerURL=https://rhbk.apps.example.com/realms/oilgas)
printf '%s\n' "$out" | grep -q 'kind: ServiceEntry'
printf '%s\n' "$out" | grep -q 'transparency.entsog.eu'
printf '%s\n' "$out" | grep -q 'kind: HTTPRoute'
printf '%s\n' "$out" | grep -q 'value: /entsog'
printf '%s\n' "$out" | grep -q 'replacePrefixMatch: /'
printf '%s\n' "$out" | grep -q 'mode: SIMPLE'
echo "render-entsog: ok"
