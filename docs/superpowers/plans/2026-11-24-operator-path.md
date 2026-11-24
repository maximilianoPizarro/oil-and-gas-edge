# Operator path, ENTSOG door, and consoles

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser that opens `https://ignition.<domain>` is sent to the Keycloak login, lands in Ignition and sees the field devices; one MicroShift VM is actually running; `https://ignition.<domain>/entsog/api/v1/operationalDatas` returns ENTSOG gas-flow JSON through the same door; the Streams console shows the `oilgas` Kafka cluster; the OpenShift console shows Kiali with traces.

**Architecture:** One `OIDCPolicy` on the existing Istio Gateway replaces the JWT-only `AuthPolicy`, so Ignition and ENTSOG share the realm `oilgas` cookie session. ENTSOG is an Istio `ServiceEntry` plus an `ExternalName` Service, rewritten by an `HTTPRoute` under `/entsog`. The field VM boots from the Vault URL `rhel-guest-image/url` instead of `example.invalid`. The Streams console operator is a new subscription; the Service Mesh console plugin is an `OSSMConsole` pointed at the Kiali the Field Content template already installed, and the Telemetry objects this pattern already owns gain a tracing provider aimed at that template's Tempo.

**Tech Stack:** Helm 3, Argo CD applications in `variants/hub/values-hub.yaml`, Connectivity Link `OIDCPolicy` (`extensions.kuadrant.io/v1alpha1`), Gateway API `HTTPRoute`, Istio `ServiceEntry` and `DestinationRule`, External Secrets, KubeVirt `DataVolume`, Streams for Apache Kafka Console (`console.streamshub.github.com/v1alpha1`), Kiali `OSSMConsole` (`kiali.io/v1alpha1`).

## Global Constraints

- Do not subscribe operators the Field Content template already owns: GitOps, Service Mesh, Connectivity Link, Red Hat build of Keycloak, External Secrets, Vault, OpenShift Virtualization, Grafana, OpenTelemetry, Tempo. Kafka (`amq-streams`, channel `stable`) and the new Streams console operator are the exceptions.
- The public hostname stays `ignition.<cluster domain>`. The Gateway listener `allowedRoutes` stays `Same` namespace. New routes live in `oilgas`.
- Keycloak issuer is `https://rhbk.<cluster domain>/realms/oilgas`. The client id is `ignition-hmi` and it stays a public client. Keycloak endpoints are `/protocol/openid-connect/auth` and `/protocol/openid-connect/token`, not the CRD defaults `/oauth/authorize` and `/oauth/token`.
- The OIDC redirect URI is `https://ignition.<cluster domain>/auth/callback`.
- ENTSOG upstream is `https://transparency.entsog.eu`. The public path is `/entsog`. No upstream API key.
- The RHEL guest URL is Vault secret `rhel-guest-image`, property `url`, store `vault-backend`. Never commit a filled URL.
- The Kafka cluster name is `oilgas`, namespace `oilgas`, listener name `plain` (TLS off, no SASL). Do not add a `secure` listener in this plan.
- `OSSMConsole` name is `ossmconsole`, namespace `openshift-operators`, `spec.version: default`, `kiali.autoDiscover: true`.
- Docs change in `docs/index.html` and `docs/es/index.html` in the same task as the chart they describe.
- Render tests use `helm template` and must pass with no cluster. Cluster checks are a separate verify step and are skipped when `oc whoami` fails.

---

### Task 1: Browser login on the Gateway

**Files:**
- Create: `charts/hub/oilgas-gateway/templates/oidcpolicy.yaml`
- Modify: `charts/hub/oilgas-gateway/templates/authpolicy.yaml`
- Modify: `charts/hub/oilgas-gateway/values.yaml`
- Modify: `charts/hub/oilgas-identity/templates/realm.yaml`
- Modify: `charts/hub/oilgas-gateway/templates/NOTES.txt`
- Modify: `charts/hub/oilgas-gateway/Chart.yaml` (description only)
- Test: `tests/render-gateway.sh`

**Interfaces:**
- Consumes: `oidc.issuerURL`, `oidc.clientID`, `gateway.hostname` already overridden in `variants/hub/values-hub.yaml` (`oidc.issuerURL`, `gateway.hostname`).
- Produces: `OIDCPolicy` named `oilgas-login` in the release namespace, targeting Gateway `oilgas-gateway`. The hand-written JWT `AuthPolicy` is not rendered. Realm client `ignition-hmi` allows the callback and PKCE S256.

- [ ] **Step 1: Write the failing render test**

Create `tests/render-gateway.sh`:

```bash
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
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `bash tests/render-gateway.sh`

Expected: FAIL because `kind: OIDCPolicy` is absent and `kind: AuthPolicy` is present.

- [ ] **Step 3: Add the policy and stop rendering the JWT AuthPolicy**

Replace `charts/hub/oilgas-gateway/templates/authpolicy.yaml` with an empty file that renders nothing. Helm requires the file to stay valid, so replace its contents with:

```yaml
{{- /* Browser login is oilgas-login OIDCPolicy. Do not also attach a JWT AuthPolicy. */}}
```

Create `charts/hub/oilgas-gateway/templates/oidcpolicy.yaml`:

```yaml
{{- if .Values.oidc.enabled }}
apiVersion: extensions.kuadrant.io/v1alpha1
kind: OIDCPolicy
metadata:
  name: oilgas-login
  namespace: {{ .Release.Namespace }}
  labels:
    app.kubernetes.io/name: oilgas-gateway
    app.kubernetes.io/part-of: oil-and-gas-edge
  annotations:
    argocd.argoproj.io/sync-wave: "4"
    argocd.argoproj.io/sync-options: SkipDryRunOnMissingResource=true
spec:
  targetRef:
    group: gateway.networking.k8s.io
    kind: Gateway
    name: {{ .Values.gateway.name }}
  provider:
    issuerURL: {{ .Values.oidc.issuerURL | quote }}
    clientID: {{ .Values.oidc.clientID | quote }}
    redirectURI: https://{{ .Values.gateway.hostname }}/auth/callback
    authorizationEndpoint: {{ printf "%s/protocol/openid-connect/auth" .Values.oidc.issuerURL | quote }}
    tokenEndpoint: {{ printf "%s/protocol/openid-connect/token" .Values.oidc.issuerURL | quote }}
{{- end }}
```

In `charts/hub/oilgas-identity/templates/realm.yaml`, inside the `ignition-hmi` client, add the explicit callback next to the existing wildcard and set PKCE. The client block's `redirectUris` becomes:

```yaml
        redirectUris:
          - https://{{ .Values.realm.host }}/*
          - https://{{ .Values.realm.host }}/auth/callback
        webOrigins:
          - https://{{ .Values.realm.host }}
        attributes:
          pkce.code.challenge.method: S256
```

Leave `publicClient: true` and `standardFlowEnabled: true` as they are.

Update `NOTES.txt` so it says an anonymous browser is redirected to Keycloak, and a request that already has a Bearer token from realm `oilgas` is accepted. In-cluster Jobs still use `control-room-http` and do not pass through this Gateway.

Change the `Chart.yaml` description sentence that says the chart requires a JWT so it says the chart attaches an `OIDCPolicy` for realm `oilgas`.

- [ ] **Step 4: Re-run the render test**

Run: `bash tests/render-gateway.sh`

Expected: `render-gateway: ok`

- [ ] **Step 5: Cluster check, only if logged in**

Run:

```bash
oc whoami
oc get oidcpolicy oilgas-login -n oilgas
oc get authpolicy -n oilgas
```

Expected: `oilgas-login` exists. Two AuthPolicies generated by the operator are present (the route policy and the callback policy). `curl -k -s -o /dev/null -w '%{http_code}\n' https://ignition.<domain>/` prints `302` and the `Location` contains `protocol/openid-connect/auth`. Opening that URL in a browser shows the Keycloak login for realm `oilgas`, not a bare 401 page.

- [ ] **Step 6: Docs**

In `docs/index.html` and `docs/es/index.html`, replace the sentence that says a browser without a Bearer token is rejected with 401. State that the Gateway `OIDCPolicy` `oilgas-login` redirects the browser to `https://rhbk.<domain>/realms/oilgas` and that the callback is `https://ignition.<domain>/auth/callback`. Keep the statement that `curl` without a session does not return the Ignition UI.

- [ ] **Step 7: Commit**

```bash
git add charts/hub/oilgas-gateway charts/hub/oilgas-identity/templates/realm.yaml tests/render-gateway.sh docs/index.html docs/es/index.html
git commit -m "$(cat <<'EOF'
Redirect the Ignition door to the Keycloak login.

A JWT AuthPolicy answered the browser with 401. An OIDCPolicy on the Gateway sends it to realm oilgas and keeps the session in a cookie.
EOF
)"
```

---

### Task 2: ENTSOG behind the same door

**Files:**
- Create: `charts/hub/oilgas-gateway/templates/entsog.yaml`
- Modify: `charts/hub/oilgas-gateway/values.yaml`
- Test: `tests/render-entsog.sh`

**Interfaces:**
- Consumes: Gateway name `oilgas-gateway` and hostname from Task 1. Login is the Gateway `OIDCPolicy`, so this route does not get its own policy.
- Produces: Service `entsog` (`ExternalName` `transparency.entsog.eu`), `ServiceEntry` `entsog`, `DestinationRule` `entsog`, `HTTPRoute` `entsog` with `PathPrefix /entsog` rewritten to `/` and hostname `transparency.entsog.eu`.

- [ ] **Step 1: Write the failing render test**

Create `tests/render-entsog.sh`:

```bash
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
```

- [ ] **Step 2: Run it and confirm failure**

Run: `bash tests/render-entsog.sh`

Expected: FAIL, `ServiceEntry` not in the render.

- [ ] **Step 3: Add the external service and the route**

Add to `charts/hub/oilgas-gateway/values.yaml`:

```yaml
entsog:
  enabled: true
  host: transparency.entsog.eu
  pathPrefix: /entsog
  serviceName: entsog
```

Create `charts/hub/oilgas-gateway/templates/entsog.yaml`:

```yaml
{{- if .Values.entsog.enabled }}
apiVersion: v1
kind: Service
metadata:
  name: {{ .Values.entsog.serviceName }}
  namespace: {{ .Release.Namespace }}
  labels:
    app.kubernetes.io/name: oilgas-gateway
    app.kubernetes.io/part-of: oil-and-gas-edge
  annotations:
    argocd.argoproj.io/sync-wave: "2"
spec:
  type: ExternalName
  externalName: {{ .Values.entsog.host }}
  ports:
    - name: https
      port: 443
      targetPort: 443
---
apiVersion: networking.istio.io/v1
kind: ServiceEntry
metadata:
  name: {{ .Values.entsog.serviceName }}
  namespace: {{ .Release.Namespace }}
  labels:
    app.kubernetes.io/name: oilgas-gateway
    app.kubernetes.io/part-of: oil-and-gas-edge
  annotations:
    argocd.argoproj.io/sync-wave: "2"
    argocd.argoproj.io/sync-options: SkipDryRunOnMissingResource=true
spec:
  hosts:
    - {{ .Values.entsog.host }}
  location: MESH_EXTERNAL
  resolution: DNS
  ports:
    - number: 443
      name: https
      protocol: HTTPS
---
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: {{ .Values.entsog.serviceName }}
  namespace: {{ .Release.Namespace }}
  labels:
    app.kubernetes.io/name: oilgas-gateway
    app.kubernetes.io/part-of: oil-and-gas-edge
  annotations:
    argocd.argoproj.io/sync-wave: "2"
    argocd.argoproj.io/sync-options: SkipDryRunOnMissingResource=true
spec:
  host: {{ .Values.entsog.host }}
  trafficPolicy:
    tls:
      mode: SIMPLE
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: {{ .Values.entsog.serviceName }}
  namespace: {{ .Release.Namespace }}
  labels:
    app.kubernetes.io/name: oilgas-gateway
    app.kubernetes.io/part-of: oil-and-gas-edge
  annotations:
    argocd.argoproj.io/sync-wave: "3"
    argocd.argoproj.io/sync-options: SkipDryRunOnMissingResource=true
spec:
  parentRefs:
    - name: {{ .Values.gateway.name }}
      namespace: {{ .Release.Namespace }}
  hostnames:
    - {{ .Values.gateway.hostname | quote }}
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: {{ .Values.entsog.pathPrefix }}
      filters:
        - type: URLRewrite
          urlRewrite:
            hostname: {{ .Values.entsog.host }}
            path:
              type: ReplacePrefixMatch
              replacePrefixMatch: /
      backendRefs:
        - name: {{ .Values.entsog.serviceName }}
          port: 443
{{- end }}
```

- [ ] **Step 4: Re-run the test**

Run: `bash tests/render-entsog.sh`

Expected: `render-entsog: ok`

- [ ] **Step 5: Cluster check, only if logged in**

After Task 1's login works, open `https://ignition.<domain>/entsog/api/v1/operationalDatas` in the same browser. Expected: JSON from ENTSOG (an array or an object of operational data), not the Ignition UI and not a 401. A cold `curl` without the session cookie gets the same `302` to Keycloak as the HMI.

- [ ] **Step 6: Docs**

Add a short subsection in both language pages under the Gateway section: `/entsog` is ENTSOG Transparency (`transparency.entsog.eu`), gas flows and nominations, no upstream key, same `OIDCPolicy` as Ignition.

- [ ] **Step 7: Commit**

```bash
git add charts/hub/oilgas-gateway tests/render-entsog.sh docs/index.html docs/es/index.html
git commit -m "$(cat <<'EOF'
Publish ENTSOG gas flows through the Ignition door.

The route rewrites /entsog to the public transparency host and reuses the Gateway login, so the pattern has one external oil-and-gas API and no second credential.
EOF
)"
```

---

### Task 3: Boot the field VM from Vault

**Files:**
- Create: `charts/hub/device-edge/templates/image-secret.yaml`
- Modify: `charts/hub/device-edge/templates/datavolume.yaml`
- Modify: `charts/hub/device-edge/values.yaml`
- Test: `tests/render-device-edge.sh`

**Interfaces:**
- Consumes: Vault key `secret/data/global/rhel-guest-image`, property `url`, same store shape as `charts/hub/mock-devices/values.yaml` (`vault.secretStore`, `remoteKey`).
- Produces: Secret `rhel-guest-image` in the release namespace (`oilgas-edge`). DataVolume `url` is that secret when the chart value is empty, and `helm template` fails when both are empty.

- [ ] **Step 1: Write the failing render test**

Create `tests/render-device-edge.sh`:

```bash
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
```

- [ ] **Step 2: Run it and confirm failure**

Run: `bash tests/render-device-edge.sh`

Expected: FAIL. The empty-url render succeeds today because of `example.invalid`, and there is no `ExternalSecret`.

- [ ] **Step 3: Project the URL and refuse the placeholder**

Add to `charts/hub/device-edge/values.yaml` under the existing `rhelImage` key, leaving `url: ""`:

```yaml
  secretName: rhel-guest-image
  vault:
    secretStore: vault-backend
    secretStoreKind: ClusterSecretStore
    remoteKey: secret/data/global/rhel-guest-image
```

Create `charts/hub/device-edge/templates/image-secret.yaml`:

```yaml
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: {{ .Values.rhelImage.secretName }}
  namespace: {{ .Release.Namespace }}
  labels:
    app.kubernetes.io/name: device-edge
    app.kubernetes.io/part-of: oil-and-gas-edge
  annotations:
    argocd.argoproj.io/sync-wave: "1"
    argocd.argoproj.io/sync-options: SkipDryRunOnMissingResource=true
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: {{ .Values.rhelImage.vault.secretStore }}
    kind: {{ .Values.rhelImage.vault.secretStoreKind }}
  target:
    name: {{ .Values.rhelImage.secretName }}
    creationPolicy: Owner
  data:
    - secretKey: url
      remoteRef:
        key: {{ .Values.rhelImage.vault.remoteKey }}
        property: url
```

In `charts/hub/device-edge/templates/datavolume.yaml`, replace both `url:` lines (the site disk and the kiosk disk) with:

```yaml
      {{- $url := .Values.rhelImage.url }}
      {{- if not $url }}
      {{- $img := lookup "v1" "Secret" .Release.Namespace .Values.rhelImage.secretName }}
      {{- if and $img $img.data }}
      {{- $url = index $img.data "url" | b64dec }}
      {{- end }}
      {{- end }}
      url: {{ required "Set rhelImage.url or sync secret rhel-guest-image (values-secret rhel-guest-image/url)" $url | quote }}
```

Use `$root` instead of `.` inside the `range .Values.sites` block, matching the rest of that file. Do not leave `example.invalid` anywhere in the chart.

- [ ] **Step 4: Re-run the test**

Run: `bash tests/render-device-edge.sh`

Expected: `render-device-edge: ok`

- [ ] **Step 5: Cluster check, only if logged in**

The URL has to be in Vault before this sync (`values-secret.yaml.template` field `rhel-guest-image` / `url`). Then:

```bash
oc get externalsecret rhel-guest-image -n oilgas-edge
oc get secret rhel-guest-image -n oilgas-edge
oc get dv,vm -n oilgas-edge
```

Expected: the three field VMs (`wellpad-north`, `compressor-station`, `pipeline-segment`) and `hmi-kiosk` reach `Running`. `virtctl console -n oilgas-edge wellpad-north` shows the cloud-init log from `/usr/local/bin/oilgas-bootstrap-edge.sh`. A VM stuck on `example.invalid` means this task is not done.

- [ ] **Step 6: Commit**

```bash
git add charts/hub/device-edge tests/render-device-edge.sh
git commit -m "$(cat <<'EOF'
Boot field VMs from the Vault guest-image URL.

An empty rhelImage.url used to import example.invalid. The chart now reads rhel-guest-image and refuses to render without it.
EOF
)"
```

---

### Task 4: Devices visible in the control-room Ignition

**Files:**
- Modify: `charts/hub/device-edge/templates/cloudinit-secret.yaml` (only the bootstrap echo and the GAN wait)
- Modify: `docs/index.html`
- Modify: `docs/es/index.html`
- Test: `tests/render-device-edge.sh` (extend)

**Interfaces:**
- Consumes: the VM from Task 3, `controlRoom.ganHost` `control-room-gan.ignition.svc.cluster.local` port `8060`, and the simulator JSON already written to `/etc/oilgas/mock-device.json`.
- Produces: the guest script waits until MicroShift is up and prints one line `GAN target control-room-gan.ignition.svc.cluster.local:8060` before `helm upgrade`. The docs name the two Ignition screens that prove the device is connected.

- [ ] **Step 1: Extend the render test**

Append to `tests/render-device-edge.sh` before the final echo, using the same `out` variable from the successful render:

```bash
printf '%s\n' "$out" | grep -q 'GAN target control-room-gan.ignition.svc.cluster.local:8060'
```

- [ ] **Step 2: Run it and confirm failure**

Run: `bash tests/render-device-edge.sh`

Expected: FAIL, that string is not in the cloud-init secret.

- [ ] **Step 3: Print the GAN target in the guest script**

In `charts/hub/device-edge/templates/cloudinit-secret.yaml`, immediately after `source /etc/oilgas/site.env`, add:

```bash
echo "[oilgas] GAN target ${CONTROL_ROOM_GAN_HOST}:${CONTROL_ROOM_GAN_PORT}"
```

Do not change the outgoing connection values. They already point at the control-room Gateway Network.

- [ ] **Step 4: Re-run the test**

Run: `bash tests/render-device-edge.sh`

Expected: `render-device-edge: ok`

- [ ] **Step 5: What "connected" means in the UI**

Document this in both language pages, in the Gateway Network section, as the success check:

1. In the control-room Ignition, **Config → Networking → Gateway Network** lists an incoming connection from `wellpad-north` (and the other sites once their VMs finish bootstrap). That row is the MicroShift device. It does not require the API token.
2. **Connections → Devices** on that edge gateway shows the programmable simulator for that site. The edge script registers it only after `/etc/oilgas/api-token` exists on the guest. Create that token in the edge Gateway UI and re-run `/usr/local/bin/oilgas-bootstrap-edge.sh`.
3. The hub Job `register-mock-devices` registers the same three simulators on the control room. It stays failed until Vault `ignition-api/token` is set. That is a second view of the same tag names, not a substitute for the Gateway Network row.

- [ ] **Step 6: Commit**

```bash
git add charts/hub/device-edge/templates/cloudinit-secret.yaml tests/render-device-edge.sh docs/index.html docs/es/index.html
git commit -m "$(cat <<'EOF'
Point the field-VM check at the Gateway Network connection.

The incoming connection from the MicroShift guest is the device the control room can see without an API token.
EOF
)"
```

---

### Task 5: Streams console on the oilgas cluster

**Files:**
- Create: `charts/hub/kafka-console/Chart.yaml`
- Create: `charts/hub/kafka-console/values.yaml`
- Create: `charts/hub/kafka-console/templates/console.yaml`
- Modify: `variants/hub/values-hub.yaml` (subscription and application)
- Test: `tests/render-kafka-console.sh`

**Interfaces:**
- Consumes: Kafka `oilgas` in namespace `oilgas`, listener `plain`, from `charts/hub/kafka`.
- Produces: Subscription `amq-streams-console` in `openshift-operators`, channel `stable`, and `Console` `oilgas` whose single cluster entry uses listener `plain` and OpenShift user-workload monitoring. No `KafkaUser`.

- [ ] **Step 1: Write the failing render test**

Create `tests/render-kafka-console.sh`:

```bash
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
```

- [ ] **Step 2: Run it and confirm failure**

Run: `bash tests/render-kafka-console.sh`

Expected: FAIL, the chart directory does not exist.

- [ ] **Step 3: Add the chart and the hub entries**

`charts/hub/kafka-console/Chart.yaml`:

```yaml
apiVersion: v2
name: kafka-console
description: Streams for Apache Kafka Console for the oilgas cluster.
type: application
version: 0.1.0
appVersion: "2.9"
```

`charts/hub/kafka-console/values.yaml`:

```yaml
name: oilgas
hostname: kafka-console.apps.cluster.example.com
cluster:
  name: oilgas
  namespace: oilgas
  listener: plain
metrics:
  name: openshift-monitoring
  type: openshift-monitoring
```

`charts/hub/kafka-console/templates/console.yaml`:

```yaml
apiVersion: console.streamshub.github.com/v1alpha1
kind: Console
metadata:
  name: {{ .Values.name }}
  namespace: {{ .Release.Namespace }}
  labels:
    app.kubernetes.io/name: kafka-console
    app.kubernetes.io/part-of: oil-and-gas-edge
  annotations:
    argocd.argoproj.io/sync-wave: "2"
    argocd.argoproj.io/sync-options: SkipDryRunOnMissingResource=true
spec:
  hostname: {{ .Values.hostname | quote }}
  metricsSources:
    - name: {{ .Values.metrics.name }}
      type: {{ .Values.metrics.type }}
  kafkaClusters:
    - name: {{ .Values.cluster.name }}
      namespace: {{ .Values.cluster.namespace }}
      listener: {{ .Values.cluster.listener }}
      metricsSource: {{ .Values.metrics.name }}
```

In `variants/hub/values-hub.yaml`, add a subscription beside `amq-streams`:

```yaml
    amq-streams-console:
      name: amq-streams-console
      namespace: openshift-operators
      channel: stable
      source: redhat-operators
      sourceNamespace: openshift-marketplace
      installPlanApproval: Automatic
```

Add an application after `kafka` (sync wave `9`). Use wave `12` so the Kafka CR exists first:

```yaml
    kafka-console:
      name: kafka-console
      namespace: oilgas
      argoProject: oilgas
      path: charts/hub/kafka-console
      syncWave: "12"
      overrides:
        - name: hostname
          value: 'kafka-console.{{ .Values.global.localClusterDomain }}'
```

Before relying on the package name on a live cluster, run:

```bash
oc get packagemanifests -n openshift-marketplace -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' | grep console
```

Expected: a line `amq-streams-console`. If the catalog lists a different single console package, change the subscription `name` to that line and re-run the render test. Do not switch the channel to `alpha`.

- [ ] **Step 4: Re-run the test**

Run: `bash tests/render-kafka-console.sh`

Expected: `render-kafka-console: ok`

- [ ] **Step 5: Cluster check, only if logged in**

```bash
oc get csv -n openshift-operators | grep -i console
oc get console oilgas -n oilgas
oc get route -n oilgas -l app.kubernetes.io/name=kafka-console
```

Expected: the operator CSV is `Succeeded`, the `Console` condition is ready, and `https://kafka-console.<domain>` shows cluster `oilgas` and the four topics `oilgas.devices.wellpad-north`, `oilgas.devices.compressor-station`, `oilgas.devices.pipeline-segment`, `oilgas.devices.events`.

- [ ] **Step 6: Docs**

One paragraph in both languages: the console is a separate operator from the broker, it reads listener `plain`, and user-workload monitoring must be enabled or the metrics pane stays empty. The topics still appear without it.

- [ ] **Step 7: Commit**

```bash
git add charts/hub/kafka-console variants/hub/values-hub.yaml tests/render-kafka-console.sh docs/index.html docs/es/index.html
git commit -m "$(cat <<'EOF'
Add the Streams console for the oilgas cluster.

The console joins the existing plaintext listener and does not create a Kafka user.
EOF
)"
```

---

### Task 6: Kiali in the OpenShift console, with traces

**Files:**
- Create: `charts/hub/mesh-console/Chart.yaml`
- Create: `charts/hub/mesh-console/values.yaml`
- Create: `charts/hub/mesh-console/templates/ossmconsole.yaml`
- Modify: `charts/hub/telemetry/values.yaml`
- Modify: `charts/hub/telemetry/templates/telemetry.yaml`
- Modify: `variants/hub/values-hub.yaml`
- Test: `tests/render-mesh-console.sh`

**Interfaces:**
- Consumes: Istio and Tempo already installed by the Field Content template. This chart does not install them. The tracing provider name defaults to `otel-tracing`, which is the name in the OpenShift Service Mesh 3 tracing procedure. Override it when the live Istio CR uses another name.
- Produces: `OSSMConsole` `ossmconsole` in `openshift-operators`. The existing `Telemetry` objects in `ignition` and `oilgas` keep their metric overrides and add a tracing block at 100 percent for the first verify, then the value drops to `1` in the same commit once the render test covers both.

- [ ] **Step 1: Write the failing render test**

Create `tests/render-mesh-console.sh`:

```bash
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
```

- [ ] **Step 2: Run it and confirm failure**

Run: `bash tests/render-mesh-console.sh`

Expected: FAIL, `mesh-console` chart is missing and the Telemetry render has no `otel-tracing`.

- [ ] **Step 3: Add the plugin and the tracing block**

`charts/hub/mesh-console/Chart.yaml`:

```yaml
apiVersion: v2
name: mesh-console
description: OpenShift Service Mesh console plugin for the template Kiali.
type: application
version: 0.1.0
appVersion: "1.0"
```

`charts/hub/mesh-console/values.yaml`:

```yaml
name: ossmconsole
namespace: openshift-operators
version: default
```

`charts/hub/mesh-console/templates/ossmconsole.yaml`:

```yaml
apiVersion: kiali.io/v1alpha1
kind: OSSMConsole
metadata:
  name: {{ .Values.name }}
  namespace: {{ .Values.namespace }}
  labels:
    app.kubernetes.io/name: mesh-console
    app.kubernetes.io/part-of: oil-and-gas-edge
  annotations:
    argocd.argoproj.io/sync-options: SkipDryRunOnMissingResource=true
spec:
  version: {{ .Values.version }}
  kiali:
    autoDiscover: true
```

Add to `charts/hub/telemetry/values.yaml`:

```yaml
tracing:
  enabled: true
  providerName: otel-tracing
  randomSamplingPercentage: 1
```

Extend `charts/hub/telemetry/templates/telemetry.yaml` so each namespaced `Telemetry` keeps the current `metrics` list and, when tracing is enabled, adds:

```yaml
  tracing:
    - randomSamplingPercentage: {{ $.Values.tracing.randomSamplingPercentage }}
      providers:
        - name: {{ $.Values.tracing.providerName }}
```

Use `$.Values` inside the `range` so the file-level values are visible. Do not remove the `REQUEST_COUNT` and `REQUEST_DURATION` overrides.

In `variants/hub/values-hub.yaml` add the application. No new subscription: the Kiali operator comes from the template.

```yaml
    mesh-console:
      name: mesh-console
      namespace: openshift-operators
      argoProject: oilgas
      path: charts/hub/mesh-console
      syncWave: "18"
```

- [ ] **Step 4: Re-run the test**

Run: `bash tests/render-mesh-console.sh`

Expected: `render-mesh-console: ok`

- [ ] **Step 5: Cluster check, only if logged in**

```bash
oc get ossmconsole ossmconsole -n openshift-operators
oc get kiali -A
oc get istio -A -o yaml | grep -n opentelemetry -n || true
oc get tempostack,tempo -A
```

Expected: `OSSMConsole` is ready. The OpenShift console left nav has **Service Mesh**. `oc get kiali -A` prints the instance the plugin discovered.

The tracing provider on that Istio CR must be named `otel-tracing` and its OpenTelemetry service must be the template Tempo distributor (the Service Mesh 3 procedure uses `tempo-sample-distributor.tempo.svc.cluster.local:4317`). If `grep opentelemetry` prints a different provider name, set `tracing.providerName` on the `telemetry` application overrides to that name and re-sync. Do not install a second Tempo or a second Kiali operator.

Generate one trace by opening `https://ignition.<domain>/` after login. In the console, **Service Mesh → the ignition workload → Traces** shows at least one span. **View in Tracing** opens **Observe → Traces** for the template Tempo instance.

- [ ] **Step 6: Docs**

One paragraph in both languages: Kiali is the template's Kiali, shown inside the OpenShift console by `OSSMConsole`. Traces are the mesh spans for namespaces `ignition` and `oilgas`, stored in the template Tempo. This pattern does not install either operator.

- [ ] **Step 7: Commit**

```bash
git add charts/hub/mesh-console charts/hub/telemetry variants/hub/values-hub.yaml tests/render-mesh-console.sh docs/index.html docs/es/index.html
git commit -m "$(cat <<'EOF'
Show Kiali and mesh traces in the OpenShift console.

The plugin attaches to the template Kiali, and the Telemetry objects this pattern already owns now sample the existing tracing provider.
EOF
)"
```

---

## Coverage

| Request | Task |
| --- | --- |
| Keycloak shows a login instead of a bare 401 | Task 1 |
| ENTSOG as the single external oil-and-gas API, via ServiceEntry, HTTPRoute, and the Gateway login | Task 2 |
| A MicroShift VM that is actually running | Task 3 |
| Connected devices visible inside Ignition | Task 4 |
| Kafka console | Task 5 |
| Service Mesh dynamic plugin, Kiali, distributed traces | Task 6 |

## Self-review

- Task 2 does not add a second `OIDCPolicy`. Login stays the Gateway policy from Task 1, which is what makes `/entsog` and the HMI the same door.
- Task 3 does not commit a RHEL URL. The render test supplies a fake URL; the cluster still needs the Vault field that already exists in `values-secret.yaml.template`.
- Task 5 does not invent a SASL user. The broker listener in `charts/hub/kafka/templates/kafka.yaml` is `plain` with `tls: false`.
- Task 6 does not subscribe Service Mesh, Tempo, or Kiali. If the live Istio CR uses a provider name other than `otel-tracing`, the verify step changes one override instead of installing a new stack.
