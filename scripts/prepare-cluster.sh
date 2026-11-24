#!/usr/bin/env bash
# Enable KubeVirt emulation when no node advertises /dev/kvm.
# OLM owns the HyperConverged operator Deployment, so the value has to live
# on the CSV env KVM_EMULATION. oc set env on the Deployment is reverted.
set -euo pipefail

if ! command -v oc >/dev/null 2>&1; then
  echo "oc is required" >&2
  exit 1
fi

python_bin=""
if command -v python3 >/dev/null 2>&1; then
  python_bin=python3
elif command -v python >/dev/null 2>&1; then
  python_bin=python
else
  echo "python3 is required to patch the HyperConverged CSV" >&2
  exit 1
fi

ns="${CNV_NAMESPACE:-openshift-cnv}"
kvm_nodes=$(oc get nodes -o custom-columns=NAME:.metadata.name,KVM:.status.allocatable.devices\\.kubevirt\\.io/kvm --no-headers)
echo "$kvm_nodes"
has_kvm=0
while read -r name kvm; do
  [ -z "${name:-}" ] && continue
  if [ -n "${kvm:-}" ] && [ "$kvm" != "<none>" ] && [ "$kvm" != "0" ]; then
    has_kvm=1
  fi
done <<< "$kvm_nodes"

if [ "$has_kvm" -eq 1 ]; then
  echo "At least one node advertises KVM. Emulation stays off."
  exit 0
fi

echo "No node advertises KVM. Setting KVM_EMULATION=true on the HyperConverged operator."

csv=$(oc get csv -n "$ns" -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' | grep hyperconverged | head -n 1 || true)
if [ -z "$csv" ]; then
  echo "No HyperConverged CSV in namespace ${ns}." >&2
  exit 1
fi

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
oc get csv "$csv" -n "$ns" -o json > "$tmp"
"$python_bin" - "$ns" "$csv" "$tmp" <<'PY'
import json, subprocess, sys
ns, csv, path = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path, encoding="utf-8") as fh:
    doc = json.load(fh)
patched = False
for di, dep in enumerate(doc["spec"]["install"]["spec"]["deployments"]):
    containers = dep["spec"]["template"]["spec"]["containers"]
    for ci, container in enumerate(containers):
        env = container.setdefault("env", [])
        for item in env:
            if item.get("name") == "KVM_EMULATION":
                if item.get("value") == "true":
                    print(f"{csv}: KVM_EMULATION is already true")
                    sys.exit(0)
                item["value"] = "true"
                patched = True
        if not any(item.get("name") == "KVM_EMULATION" for item in env):
            env.append({"name": "KVM_EMULATION", "value": "true"})
            patched = True
if not patched:
    sys.exit("KVM_EMULATION was not found on the operator container")
subprocess.run(["oc", "apply", "-f", "-"], input=json.dumps(doc).encode(), check=True)
print(f"patched CSV {csv}")
PY

echo "Waiting for the operator to set useEmulation."
for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
  value=$(oc get kubevirt -n "$ns" -o jsonpath='{.items[0].spec.configuration.developerConfiguration.useEmulation}' 2>/dev/null || true)
  if [ "$value" = "true" ]; then
    echo "KubeVirt useEmulation=true"
    exit 0
  fi
  sleep 5
done
echo "KVM_EMULATION is set, but useEmulation is not true yet. Re-run after the operator pod is Ready." >&2
exit 1
