#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
out=$(helm template oilgas-identity "$root/charts/hub/oilgas-identity" \
  --set realm.host=ignition.apps.example.com)
printf '%s\n' "$out" | grep -q 'kind: KeycloakRealmImport'
printf '%s\n' "$out" | grep -q 'keycloakCRName: rhbk'
printf '%s\n' "$out" | grep -q 'namespace: rhbk-operator'
printf '%s\n' "$out" | grep -q 'username: operator'
printf '%s\n' "$out" | grep -q 'kind: Secret'
printf '%s\n' "$out" | grep -q 'name: oilgas-operator'
# The password stays in the cluster objects, not in git.
if printf '%s\n' "$out" | grep -q 'password: ""'; then
  echo "operator password rendered empty" >&2
  exit 1
fi
off=$(helm template oilgas-identity "$root/charts/hub/oilgas-identity" \
  --set realm.host=ignition.apps.example.com \
  --set realm.operatorUser.enabled=false)
if printf '%s\n' "$off" | grep -q 'kind: Secret'; then
  echo "disabled operator user still rendered a Secret" >&2
  exit 1
fi
echo "render-identity: ok"
