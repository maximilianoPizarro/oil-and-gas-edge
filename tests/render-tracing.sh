#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
out=$(helm template tracing "$root/charts/hub/tracing")
printf '%s\n' "$out" | grep -q 'kind: TempoMonolithic'
printf '%s\n' "$out" | grep -q 'name: oilgas'
printf '%s\n' "$out" | grep -q 'backend: memory'
printf '%s\n' "$out" | grep -q 'kind: Kiali'
printf '%s\n' "$out" | grep -q 'provider: tempo'
printf '%s\n' "$out" | grep -q 'tempo-oilgas.tempo.svc.cluster.local:3200'
printf '%s\n' "$out" | grep -q 'otel-tracing'
printf '%s\n' "$out" | grep -q 'tempo-oilgas.tempo.svc.cluster.local'
grep -q 'path: charts/hub/tracing' "$root/variants/hub/values-hub.yaml"
grep -q 'name: tempo-product' "$root/variants/hub/values-hub.yaml"
echo "render-tracing: ok"
