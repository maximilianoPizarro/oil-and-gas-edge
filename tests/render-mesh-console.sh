#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
mesh=$(helm template mesh-console "$root/charts/hub/mesh-console")
printf '%s\n' "$mesh" | grep -q 'kind: OSSMConsole'
printf '%s\n' "$mesh" | grep -q 'name: ossmconsole'
printf '%s\n' "$mesh" | grep -q 'namespace: openshift-operators'
printf '%s\n' "$mesh" | grep -q 'version: default'
printf '%s\n' "$mesh" | grep -q 'autoDiscover: true'
tel=$(helm template telemetry "$root/charts/hub/telemetry")
printf '%s\n' "$tel" | grep -q 'otel-tracing'
printf '%s\n' "$tel" | grep -q 'randomSamplingPercentage: 1'
grep -q 'path: charts/hub/mesh-console' "$root/variants/hub/values-hub.yaml"
echo "render-mesh-console: ok"
