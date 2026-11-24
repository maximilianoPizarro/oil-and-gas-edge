# Pedido de clúster y prueba

Patrón `oil-and-gas-edge`. El clúster se pide con el template [from-3scale-to-connectivity-link](https://github.com/maximilianoPizarro/from-3scale-to-connectivity-link). Ese template ya instala GitOps, Service Mesh, Connectivity Link, Red Hat Build of Keycloak, External Secrets, Vault, OpenShift Virtualization, OpenTelemetry, Tempo y Grafana. Este patrón no vuelve a instalarlos.

## Pedido

- OpenShift 4.20 o la versión del template.
- 3 control planes: 8 vCPU / 32 GiB (`m5a.2xlarge`).
- 3 workers: 16 vCPU / 64 GiB (`m5a.4xlarge`). Si el catálogo del template ofrece `m5a.8xlarge`, no achicarlo: con tres VMs de campo, el kiosk, Ignition y Kafka el margen de `m5a.4xlarge` queda justo.
- StorageClass RWO `gp3-csi`: 500 GiB libres.
- DNS wildcard `*.apps.<cluster-domain>` del router de OpenShift. La prueba usa el issuer self-signed de `cert-manager-config`. No hace falta Route53.

Kafka de prueba suma alrededor de 2 vCPU, 4 GiB y un PVC de 20 GiB. OpenTelemetry y Grafana no suman nodos.

## Qué corre encima del template

| Pieza | Dónde | Notas |
| --- | --- | --- |
| Realm `oilgas`, client `ignition-hmi` | `rhbk-operator` | El Keycloak del template se llama `rhbk`. No se redespliega RHBK. |
| CA `oilgas-device-ca` y un cert por sitio | `oilgas` | PushSecret a Vault y ExternalSecret en `oilgas-edge`. |
| Gateway, TLSPolicy, HTTPRoute, AuthPolicy | `oilgas` | Puerta pública `https://ignition.<domain>`. |
| Ignition 8.3 control room | `ignition` | Ingress de OpenShift apagado. Sigue el Service GAN `:8060`. |
| Tres Programmable Device Simulator | `ignition` | Job contra la API de configuración. |
| Kafka `oilgas` y cuatro tópicos | `oilgas` | Un nodo KRaft. Suscripción `amq-streams`. |
| Publicador de eventos | `oilgas` | JSON `{site, device, tag, value, ts}`. |
| Dashboard `oil-and-gas-edge` | Grafana del template | No se instala otro Grafana. |
| Tres VMs de campo + `hmi-kiosk` | `oilgas-edge` | MicroShift + Ignition Edge. El kiosk solo abre Firefox. |

RAM de VMs: 3 x 16 GiB + 1 x 4 GiB = 52 GiB, más el límite de 8 GiB de Ignition. En menos de 3 workers no entran las tres VMs a la vez.

## Antes de instalar el patrón

1. Confirmar el dominio:

```bash
oc get ingresses.config.openshift.io cluster -o jsonpath='{.spec.domain}{"\n"}'
```

2. Copiar secretos y completar la URL de la imagen RHEL y el token de la API de Ignition:

```bash
cp values-secret.yaml.template ~/values-secret-oil-and-gas-edge.yaml
```

3. Anotar en `charts/hub/device-edge/values.yaml` la URL de la imagen (`rhelImage.url`) o pasarla en el install.
4. Confirmar el ClusterSecretStore. Los charts usan `vault-backend`. Si el template lo nombró distinto:

```bash
oc get clustersecretstore
```

5. Instalar cuando el clúster del template esté listo. No hace falta redeployar el template.

```bash
./pattern.sh make install
```

El release Helm `ignition` que pueda existir de una instalación manual anterior no es este patrón. El patrón usa el release `control-room`.

## Checklist

- `oc get clusterissuer` muestra `oilgas-device-ca` Ready. El issuer de laboratorio que crea `cert-manager-config` en modo self-signed se llama `letsencrypt-prod` y es una CA interna, no Let's Encrypt.
- `oc get certificate -A` muestra el certificado de RHBK o del Gateway, y un Certificate por sitio (`wellpad-north`, `compressor-station`, `pipeline-segment`).
- `oc get gateway,httproute,authpolicy,tlspolicy -n oilgas` en Ready.
- `curl -k https://ignition.<domain>` no entrega la UI de Ignition sin un Bearer token del realm `oilgas`.
- `oc get pods -n ignition` en 1/1 y existe el secret `control-room-gateway-admin-password`.
- `oc get vm -n oilgas-edge` muestra las tres VMs de campo y `hmi-kiosk` en Running.
- En la UI de Ignition, Connections, Devices, los tres simuladores figuran Running.
- En Config, Networking, Gateway Network, aparecen las tres conexiones entrantes de los gateways MicroShift.
- En cada gateway edge, Connections, Devices, muestra solo el simulador de ese sitio.
- `oc get externalsecret,pushsecret -A` sincroniza el cert de cada dispositivo hacia Vault y de vuelta a `oilgas-edge`.
- `oc get kafka,kafkatopic -n oilgas` muestra el cluster `oilgas` y los cuatro tópicos.
- Un consumidor lee al menos un evento JSON en `oilgas.devices.wellpad-north`:

```bash
oc run kafka-consume -n oilgas --rm -it --restart=Never \
  --image=quay.io/strimzi/kafka:0.45.0 -- \
  /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server oilgas-kafka-bootstrap:9092 \
  --topic oilgas.devices.wellpad-north \
  --from-beginning --max-messages 1
```

- En el Grafana del template (`https://grafana-observability.<domain>`, usuario `admin`, contraseña `openshift`), el dashboard `oil-and-gas-edge` muestra la tasa y la latencia del HTTPRoute de Ignition, y mensajes por tópico.

El Job `register-mock-devices` necesita el token de la API de Ignition en el secret `control-room-ignition-api-token` (Vault, secreto `ignition-api`, campo `token`). El token se crea en el Gateway después del commissioning. En cada VM de campo, si el registro del simulador queda en WARN, el mismo archivo queda en `/etc/oilgas/mock-device.json` y se vuelve a intentar con `/usr/local/bin/oilgas-bootstrap-edge.sh` cuando `/etc/oilgas/api-token` existe.
