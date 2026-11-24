#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
out=$(helm template device-edge "$root/charts/hub/device-edge" \
  --set rhelImage.url=https://mirror.example/rhel-9-kvm.qcow2 \
  --set kiosk.enabled=false)
printf '%s\n' "$out" | grep -q 'https://mirror.example/rhel-9-kvm.qcow2'
printf '%s\n' "$out" | grep -q 'kind: ExternalSecret'
printf '%s\n' "$out" | grep -q 'secret/data/global/rhel-guest-image'
if printf '%s\n' "$out" | grep -q 'example.invalid'; then
  echo "placeholder image URL still rendered" >&2
  exit 1
fi
# Three field VMs, kiosk off.
test "$(printf '%s\n' "$out" | grep -c 'kind: VirtualMachine')" -eq 3
if helm template device-edge "$root/charts/hub/device-edge" --set kiosk.enabled=false >/dev/null 2>&1; then
  echo "empty image URL must fail the render" >&2
  exit 1
fi
echo "render-device-edge: ok"
