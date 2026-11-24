# Oil and Gas Edge

Validated Pattern for oil and gas. A control-room Ignition 8.3 Gateway on the OpenShift hub connects over Gateway Network to field sites. Each site is a RHEL virtual machine on OpenShift Virtualization running Red Hat Device Edge (MicroShift) and Ignition Edge. Mock devices are Ignition Programmable Device Simulators. Their events are stored in Kafka. Operators reach the HMI through Red Hat Connectivity Link, with certificates and identity from the same ingredients as [rhbk-cert](https://github.com/maximilianoPizarro/rhbk-cert).

Repository: [maximilianoPizarro/oil-and-gas-edge](https://github.com/maximilianoPizarro/oil-and-gas-edge).

Full documentation: <https://maximilianopizarro.github.io/oil-and-gas-edge/> ([español](https://maximilianopizarro.github.io/oil-and-gas-edge/es/)).

Target hub: an RHDP / Field Content cluster from
[from-3scale-to-connectivity-link](https://github.com/maximilianoPizarro/from-3scale-to-connectivity-link).
That catalog already installs GitOps, Service Mesh, Connectivity Link, Red Hat Build of Keycloak, External Secrets, Vault, OpenShift Virtualization, OpenTelemetry, Tempo and Grafana. This pattern does not install those again, and it does not install Ansible Automation Platform. GitOps replaces the Podman unit push from [hmi-demo](https://github.com/maximilianoPizarro/hmi-demo). Podman stays on the guest only as an image tool. Ignition Edge runs on MicroShift.

Sizing and the test checklist are in [docs/sizing.md](docs/sizing.md).

## Architecture

```text
operator laptop or hmi-kiosk (Firefox only)
    -> Connectivity Link Gateway -> Keycloak realm oilgas
    -> Ignition's own admin login -> Config / Gateway Network
Ignition control room -- Gateway Network --> MicroShift Ignition Edge (3 sites)
leak-indicator on Kafka --> (not installed) Ansible Automation Platform job on that field VM
Programmable Device Simulators --> Kafka topics oilgas.devices.<site>
Service Mesh -- OpenTelemetry --> Grafana dashboard oil-and-gas-edge
device CA --> Vault --> External Secrets --> field VM cloud-init
```

| Site | Role | Simulator tags |
| --- | --- | --- |
| `wellpad-north` | Upstream well pad | wellhead pressure, flow rate, tank level |
| `compressor-station` | Midstream compression | suction pressure, discharge pressure, vibration |
| `pipeline-segment` | Pipeline segment | line pressure, temperature, leak indicator |

The control room registers all three simulators. Each edge gateway registers only its own, with the same name. The kiosk VM (`hmi-kiosk`, 2 vCPU / 4 GiB) is the operator's Firefox. It does not run Ignition and it does not join the Gateway Network.

Keycloak only opens the public door. The Ignition console that lists Gateway Network connections still asks for its own user `admin` (Secret `control-room-gateway-admin-password`). This pattern does not federate the realm into Ignition.

Ansible Automation Platform is not installed. The extension case is a leak indicator on `oilgas.devices.pipeline-segment`: an Event-Driven Ansible rulebook would run a job on the `pipeline-segment` VM, re-run the guest bootstrap, and disable that device through the in-cluster Ignition API. GitOps keeps owning the hub.

Field VMs default to 4 vCPU / 16 GiB, 80 GiB root and 40 GiB data.

## Repository layout

```text
values-global.yaml                 # pattern name + main.variant: hub
pattern-metadata.yaml
variants/hub/values-hub.yaml       # oil and gas applications, AMQ Streams subscription
charts/hub/control-room/           # Ignition 0.2.5 + SCC + GAN and HTTP Services
charts/hub/oilgas-gateway/         # Gateway, TLSPolicy, HTTPRoute, AuthPolicy
charts/hub/oilgas-identity/        # realm oilgas, client ignition-hmi
charts/hub/device-certs/           # oilgas-device-ca, PushSecret, ExternalSecret
charts/hub/mock-devices/           # Programmable Device Simulator registration
charts/hub/kafka/                  # single-node KRaft cluster and topics
charts/hub/device-events/          # publisher for device events
charts/hub/telemetry/              # Istio Telemetry + Grafana dashboard
charts/hub/kafka-console/          # Streams console for the oilgas cluster
charts/hub/mesh-console/           # OpenShift Service Mesh console plugin
charts/hub/tracing/                # TempoMonolithic, Kiali, mesh trace provider
charts/hub/device-edge/            # field VMs, MicroShift cloud-init, kiosk
values-secret.yaml.template
docs/index.html                    # documentation site, English
docs/es/index.html                 # documentation site, Spanish
docs/images/                       # generated figures + attribution
docs/sizing.md
tools/diagrams/                    # source for the figures (node render.mjs)
```

`cert-manager-config` is pulled from `maximilianoPizarro/rhbk-cert` with ACME off and self-signed on. The Keycloak chart from that repo stays commented out because the Field Content template already runs Keycloak (`rhbk` in `rhbk-operator`).

## Install

On the virt-capable cluster. The identity and gateway charts follow the Keycloak CR and its Route at sync time. `values-hub.yaml` is the fallback when that lookup sees nothing. If no node advertises KVM, run `bash scripts/prepare-cluster.sh` before the field VMs sync.

```bash
cp values-secret.yaml.template ~/values-secret-oil-and-gas-edge.yaml
# rhel-guest-image.url is optional (empty clones DataSource rhel9).
# After commissioning, set ignition-api.token
# pattern.sh needs podman. Without it, helm-install the charts. Do not
# also create Argo Applications for releases Helm already owns.
bash scripts/prepare-cluster.sh
./pattern.sh make install
```

Realm `oilgas` includes user `operator`. The password is in Secret `oilgas-operator` in the Keycloak namespace. Keycloak only opens the Connectivity Link door. Ignition's Gateway Network console is a second login, user `admin`, password in `control-room-gateway-admin-password`. **Designer → Connections** lists Designer sessions, not the field sites.

Watch the applications:

```bash
oc get applications -A
oc get pods -n ignition
oc get gateway,httproute,authpolicy,tlspolicy -n oilgas
oc get kafka,kafkatopic -n oilgas
oc get vm -n oilgas-edge
```

Operator URL: `https://ignition.<cluster-domain>`.

Admin password:

```bash
oc get secret -n ignition control-room-gateway-admin-password \
  --template='{{ printf "%s\n" (index .data "gateway-admin-password" | base64decode) }}'
```

Grafana: `https://grafana-observability.<cluster-domain>` (user `admin`, password `openshift` on the Field Content template). Dashboard name: `oil-and-gas-edge`.

## Gateway Network

1. `control-room` enables `certManager` and creates the shared issuer `oilgas-gan-issuer`.
2. Service `control-room-gan` exposes port `8060` for guests. Service `control-room-http` exposes port `8088` for the HTTPRoute. Both avoid the headless chart Service.
3. `device-edge` syncs later. Cloud-init copies the issuer CA and the site client certificate into each field VM.
4. Each guest installs Ignition Edge with an outgoing connection to `control-room-gan.ignition.svc.cluster.local:8060`.

## Certificates

Three planes:

- Operators: TLSPolicy on the Gateway, plus the `oilgas` realm for the HMI.
- Ignition gateways: issuer `oilgas-gan-issuer`.
- Field devices: ClusterIssuer `oilgas-device-ca`, one client certificate per site, stored in Vault at `oilgas/devices/<site>` and projected back to `oilgas-edge`.

The lab issuer created by `cert-manager-config` is named `letsencrypt-prod` even though ACME is disabled. It is the self-signed CA from that chart.

## OpenShift notes

- The Ignition container runs as UID/GID 2003. The control-room chart creates SCC `ignition` and a ClusterRoleBinding.
- HyperConverged is not applied again. The template already owns OpenShift Virtualization. Set `cnv.enabled` true only on a cluster that does not have it.
- Operators this pattern subscribes, in `openshift-operators`: `amq-streams`, `amq-streams-console`, `kiali-ossm` and `tempo-product`. Drop the last two on a cluster that already runs Kiali and Tempo, and set `tracing.enabled` to false.

## Uninstall

```bash
./pattern.sh make uninstall
```
