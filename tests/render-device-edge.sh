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
if printf '%s\n' "$out" | grep -q 'kind: DataSource'; then
  echo "explicit image URL must not clone the cluster DataSource" >&2
  exit 1
fi
# Three field VMs, kiosk off.
test "$(printf '%s\n' "$out" | grep -c 'kind: VirtualMachine')" -eq 3
printf '%s\n' "$out" | grep -q 'GAN target control-room-gan.ignition.svc.cluster.local:8060'

empty=$(helm template device-edge "$root/charts/hub/device-edge" --set kiosk.enabled=false)
printf '%s\n' "$empty" | grep -q 'kind: DataSource'
printf '%s\n' "$empty" | grep -q 'name: rhel9'
printf '%s\n' "$empty" | grep -q 'namespace: openshift-virtualization-os-images'
if printf '%s\n' "$empty" | grep -q '^[[:space:]]*http:'; then
  echo "empty image URL must clone the DataSource, not import over HTTP" >&2
  exit 1
fi
echo "render-device-edge: ok"
