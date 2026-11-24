#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
out=$(helm template kafka-console "$root/charts/hub/kafka-console" \
  --set hostname=kafka-console.apps.example.com)
printf '%s\n' "$out" | grep -q 'apiVersion: console.streamshub.github.com/v1alpha1'
printf '%s\n' "$out" | grep -q 'kind: Console'
printf '%s\n' "$out" | grep -q 'name: oilgas'
printf '%s\n' "$out" | grep -q 'listener: plain'
printf '%s\n' "$out" | grep -q 'type: openshift-monitoring'
if printf '%s\n' "$out" | grep -q 'kafkaUser:'; then
  echo "plain listener must not reference a KafkaUser" >&2
  exit 1
fi
grep -q 'name: amq-streams-console' "$root/variants/hub/values-hub.yaml"
grep -q 'path: charts/hub/kafka-console' "$root/variants/hub/values-hub.yaml"
echo "render-kafka-console: ok"
