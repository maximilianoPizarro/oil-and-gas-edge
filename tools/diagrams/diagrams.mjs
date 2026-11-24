// Diagram definitions for the oil-and-gas-edge documentation site.
//
// Layout geometry is shared between languages; only the strings change, so the
// English and Spanish figures stay pixel-comparable. Coordinates are absolute
// on the 1280x720 stage defined in theme.mjs.

import { arrow, card, glyph, panel, pill, text, wideCard } from './theme.mjs';

/* ------------------------------------------------------------------ *
 * 1. Pattern architecture
 * ------------------------------------------------------------------ */

const ARCH = {
  panelL: { x: 32, y: 118, w: 552, h: 524 },
  panelR: { x: 732, y: 118, w: 512, h: 524 },
  cardCL: { x: 56, y: 156, w: 240, h: 190 },
  cardId: { x: 316, y: 156, w: 240, h: 190 },
  cardIg: { x: 56, y: 404, w: 500, h: 216 },
  rows: [164, 282, 400, 518],
  rowBox: { x: 756, w: 464, h: 104 },
};

function architecture(A, t) {
  const r = (i) => ({ ...ARCH.rowBox, y: ARCH.rows[i] });
  return {
    title: t.title,
    subtitle: t.subtitle,
    caption: t.caption,
    arrows: [
      arrow({ d: 'M 176,352 L 176,398', label: t.route, lx: 176, ly: 375 }),
      arrow({ d: 'M 436,352 L 436,398', label: t.jwt, lx: 436, ly: 375, dashed: true }),
      arrow({ d: 'M 562,498 C 622,498 652,456 726,440', label: t.gan, lx: 656, ly: 384 }),
    ],
    body: [
      panel({ ...ARCH.panelL, label: t.hub }),
      panel({ ...ARCH.panelR, label: t.field }),
      card({
        ...ARCH.cardCL,
        icon: A('connectivity-link.png'),
        iconSize: 66,
        name: 'Connectivity Link',
        role: t.gatewayRole,
      }),
      card({
        ...ARCH.cardId,
        icon: A('keycloak-operator.png'),
        iconSize: 66,
        name: 'Red Hat build of Keycloak',
        role: 'realm oilgas',
      }),
      wideCard({
        ...ARCH.cardIg,
        icon: A('ignition.svg'),
        iconSize: 64,
        name: 'Ignition 8.3',
        role: t.controlRoom,
        note: t.controlRoomNote,
      }),
      wideCard({
        ...r(0),
        icon: A('device-edge.svg'),
        iconSize: 46,
        name: 'wellpad-north',
        role: t.siteRole,
      }),
      wideCard({
        ...r(1),
        icon: A('device-edge.svg'),
        iconSize: 46,
        name: 'compressor-station',
        role: t.siteRole,
      }),
      wideCard({
        ...r(2),
        icon: A('device-edge.svg'),
        iconSize: 46,
        name: 'pipeline-segment',
        role: t.siteRole,
      }),
      wideCard({
        ...r(3),
        icon: A('rhel.svg'),
        iconSize: 46,
        name: 'hmi-kiosk',
        role: t.kioskRole,
      }),
    ].join('\n'),
  };
}

/* ------------------------------------------------------------------ *
 * 2. Gateway Network bootstrap
 * ------------------------------------------------------------------ */

const GAN_X = [56, 358, 660, 962];
const GAN_BOX = { y: 226, w: 262, h: 260 };

function gatewayNetwork(A, t) {
  const steps = [
    { icon: 'cert-manager.png', name: 'oilgas-gan-issuer', role: 'cert-manager', note: t.s1 },
    { icon: 'openshift.svg', name: 'control-room-gan', role: 'Service :8060', note: t.s2 },
    { icon: 'external-secrets.png', name: 'cloud-init', role: 'device-edge', note: t.s3 },
    { icon: 'ignition.svg', name: 'Ignition Edge', role: t.outgoing, note: t.s4 },
  ];
  return {
    title: t.title,
    subtitle: t.subtitle,
    caption: t.caption,
    arrows: [0, 1, 2].map((i) =>
      arrow({ d: `M ${GAN_X[i] + 266},356 L ${GAN_X[i + 1] - 4},356` }),
    ),
    body: steps
      .map((s, i) =>
        card({
          ...GAN_BOX,
          x: GAN_X[i],
          step: String(i + 1),
          icon: A(s.icon),
          iconSize: 68,
          name: s.name,
          role: s.role,
          note: s.note,
        }),
      )
      .join('\n'),
  };
}

/* ------------------------------------------------------------------ *
 * 3. Three certificate planes
 * ------------------------------------------------------------------ */

const PLANE_X = [40, 452, 864];
const PLANE = { y: 132, w: 376, h: 470 };

function certificatePlanes(A, t) {
  const planes = [
    {
      label: t.p1,
      icon: 'connectivity-link.png',
      name: 'TLSPolicy',
      role: 'oilgas-gateway',
      pills: ['ClusterIssuer letsencrypt-prod', 'secret oilgas-gateway-tls', 'realm oilgas · ignition-hmi'],
      foot: t.f1,
    },
    {
      label: t.p2,
      icon: 'ignition.svg',
      name: 'oilgas-gan-issuer',
      role: 'namespace ignition',
      pills: ['control-room certManager', 'issuer CA into every guest', 'trust for GAN :8060'],
      foot: t.f2,
    },
    {
      label: t.p3,
      icon: 'external-secrets.png',
      name: 'oilgas-device-ca',
      role: 'ClusterIssuer',
      pills: ['Certificate per site · ECDSA', 'PushSecret oilgas/devices/*', 'ExternalSecret oilgas-edge'],
      foot: t.f3,
    },
  ];
  return {
    title: t.title,
    subtitle: t.subtitle,
    caption: t.caption,
    arrows: [],
    body: planes
      .map((p, i) => {
        const x = PLANE_X[i];
        const inner = x + 28;
        return [
          panel({ ...PLANE, x, label: p.label }),
          card({
            x: inner,
            y: 172,
            w: 320,
            h: 186,
            icon: A(p.icon),
            iconSize: 62,
            name: p.name,
            role: p.role,
          }),
          ...p.pills.map((value, k) => pill({ x: inner, y: 386 + k * 46, text: value })),
          text({ x: inner, y: 536, w: 320, value: p.foot, cls: 'small' }),
        ].join('\n');
      })
      .join('\n'),
  };
}

/* ------------------------------------------------------------------ *
 * 4. Device event and telemetry flow
 * ------------------------------------------------------------------ */

const FLOW_X = [46, 362, 678, 994];
const TOPIC_X = [70, 365, 699, 1018];
const TOPICS = [
  'oilgas.devices.wellpad-north',
  'oilgas.devices.compressor-station',
  'oilgas.devices.pipeline-segment',
  'oilgas.devices.events',
];

function dataFlow(A, t) {
  const stageCards = [
    { icon: 'ignition.svg', name: t.simulator, role: t.simulatorRole, w: 276 },
    { icon: 'openshift.svg', name: 'device-events', role: t.publisherRole, w: 276 },
    { icon: 'amq.svg', name: 'Kafka oilgas', role: 'single-node KRaft', w: 276 },
    { icon: 'grafana.svg', name: 'Grafana', role: 'oil-and-gas-edge', w: 240 },
  ];
  return {
    title: t.title,
    subtitle: t.subtitle,
    caption: t.caption,
    arrows: [
      arrow({ d: 'M 326,245 L 358,245' }),
      arrow({ d: 'M 642,245 L 674,245' }),
      arrow({ d: 'M 958,245 L 990,245' }),
      arrow({ d: 'M 816,344 L 816,388' }),
    ],
    body: [
      ...stageCards.map((c, i) =>
        card({
          x: FLOW_X[i],
          y: 150,
          w: c.w,
          h: 190,
          icon: A(c.icon),
          iconSize: 62,
          name: c.name,
          role: c.role,
        }),
      ),
      panel({ x: 46, y: 392, w: 1188, h: 100, label: t.topics }),
      ...TOPICS.map((value, i) => pill({ x: TOPIC_X[i], y: 420, text: value })),
      panel({ x: 46, y: 546, w: 1188, h: 112, label: t.mesh }),
      glyph({ x: 72, y: 574, size: 56, icon: A('openshift-service-mesh.svg') }),
      pill({ x: 148, y: 568, text: 'Istio Telemetry' }),
      pill({ x: 148, y: 610, text: 'ServiceMonitor · JMX' }),
      text({ x: 384, y: 578, w: 826, value: t.meshNote, cls: 'body' }),
    ].join('\n'),
  };
}

/* ------------------------------------------------------------------ *
 * Strings
 * ------------------------------------------------------------------ */

export const STRINGS = {
  en: {
    architecture: {
      title: 'Oil and Gas Edge — pattern architecture',
      subtitle: 'A control room on the OpenShift hub and three Device Edge field sites',
      hub: 'OpenShift hub',
      field: 'Field sites · OpenShift Virtualization',
      gatewayRole: 'Gateway · TLSPolicy',
      controlRoom: 'control room · namespace ignition',
      controlRoomNote: 'Standard edition. Registers all three site simulators and owns the Gateway Network issuer.',
      siteRole: 'RHEL VM · MicroShift · Ignition Edge',
      kioskRole: 'Firefox kiosk · 2 vCPU / 4 GiB',
      route: 'HTTPRoute :8088',
      jwt: 'JWT',
      gan: 'Gateway Network',
      caption:
        'Operators open the HMI from the kiosk VM through the gateway. Field sites dial out to the control room on port 8060.',
    },
    gatewayNetwork: {
      title: 'Gateway Network bootstrap',
      subtitle: 'How a field site earns its trust and dials in to the control room',
      outgoing: 'outgoing connection',
      s1: 'control-room enables certManager and creates the shared Gateway Network issuer.',
      s2: 'A ClusterIP Service in namespace ignition, so guests never depend on the headless chart Service.',
      s3: 'cloud-init writes the issuer CA and the site client certificate under /etc/oilgas on the guest.',
      s4: 'MicroShift installs the edge gateway pointing at control-room-gan.ignition.svc.cluster.local:8060.',
      caption:
        'device-edge syncs last. Re-sync it once the issuer and the site ExternalSecret are Ready, or cloud-init ships placeholders.',
    },
    certificatePlanes: {
      title: 'Three certificate planes',
      subtitle: 'Operators, Ignition gateways and field devices are issued separately',
      p1: 'Operators',
      p2: 'Ignition gateways',
      p3: 'Field devices',
      f1: 'The lab issuer is self-signed and still carries the name letsencrypt-prod.',
      f2: 'control-room creates the issuer. device-edge copies its CA on the next sync.',
      f3: 'One client-auth certificate per site, parked in Vault and projected back to the edge namespace.',
      caption: 'Nothing is shared between the planes. A failure in one of them does not take the other two down.',
    },
    dataFlow: {
      title: 'Device event and telemetry flow',
      subtitle: 'Simulator samples land in Kafka; mesh metrics land on the shared Grafana',
      simulator: 'Device Simulator',
      simulatorRole: '3 sites · 9 tags',
      publisherRole: 'publisher · 5 s',
      topics: 'Kafka topics',
      mesh: 'Service mesh telemetry',
      meshNote:
        'Istio keeps request rate and latency for namespaces ignition and oilgas. The GrafanaDashboard oil-and-gas-edge is loaded into the Grafana the cluster already runs.',
      caption:
        'The stock Ignition image has no Kafka module, so device-events is the bridge that stores every sample.',
    },
  },
  es: {
    architecture: {
      title: 'Oil and Gas Edge — arquitectura del patrón',
      subtitle: 'Una sala de control en el hub de OpenShift y tres sitios de campo con Device Edge',
      hub: 'Hub de OpenShift',
      field: 'Sitios de campo · OpenShift Virtualization',
      gatewayRole: 'Gateway · TLSPolicy',
      controlRoom: 'sala de control · namespace ignition',
      controlRoomNote:
        'Edición standard. Registra los tres simuladores de sitio y es dueña del issuer de Gateway Network.',
      siteRole: 'VM RHEL · MicroShift · Ignition Edge',
      kioskRole: 'Kiosco Firefox · 2 vCPU / 4 GiB',
      route: 'HTTPRoute :8088',
      jwt: 'JWT',
      gan: 'Gateway Network',
      caption:
        'El operador abre la HMI desde la VM kiosco a través del gateway. Los sitios de campo marcan hacia la sala de control por el puerto 8060.',
    },
    gatewayNetwork: {
      title: 'Arranque de Gateway Network',
      subtitle: 'Cómo un sitio de campo obtiene su confianza y marca a la sala de control',
      outgoing: 'conexión saliente',
      s1: 'control-room habilita certManager y crea el issuer compartido de Gateway Network.',
      s2: 'Un Service ClusterIP en el namespace ignition, para que los guests no dependan del Service headless del chart.',
      s3: 'cloud-init escribe la CA del issuer y el certificado de cliente del sitio bajo /etc/oilgas en el guest.',
      s4: 'MicroShift instala el gateway de borde apuntando a control-room-gan.ignition.svc.cluster.local:8060.',
      caption:
        'device-edge sincroniza al final. Hay que volver a sincronizarlo cuando el issuer y el ExternalSecret del sitio estén Ready, o cloud-init escribe marcadores.',
    },
    certificatePlanes: {
      title: 'Tres planos de certificados',
      subtitle: 'Operadores, gateways de Ignition y dispositivos de campo se emiten por separado',
      p1: 'Operadores',
      p2: 'Gateways de Ignition',
      p3: 'Dispositivos de campo',
      f1: 'El issuer de laboratorio es self-signed y conserva el nombre letsencrypt-prod.',
      f2: 'control-room crea el issuer. device-edge copia su CA en la siguiente sincronización.',
      f3: 'Un certificado de cliente por sitio, guardado en Vault y proyectado de vuelta al namespace de borde.',
      caption: 'Los planos no comparten nada. Una falla en uno no se lleva puestos a los otros dos.',
    },
    dataFlow: {
      title: 'Flujo de eventos de dispositivo y telemetría',
      subtitle: 'Las muestras del simulador caen en Kafka; las métricas de malla caen en el Grafana compartido',
      simulator: 'Simulador de dispositivo',
      simulatorRole: '3 sitios · 9 tags',
      publisherRole: 'publicador · 5 s',
      topics: 'Tópicos de Kafka',
      mesh: 'Telemetría de service mesh',
      meshNote:
        'Istio conserva tasa de pedidos y latencia para los namespaces ignition y oilgas. El GrafanaDashboard oil-and-gas-edge se carga en el Grafana que el clúster ya ejecuta.',
      caption:
        'La imagen estándar de Ignition no trae módulo de Kafka, así que device-events es el puente que almacena cada muestra.',
    },
  },
};

export const DIAGRAMS = [
  { id: 'architecture', key: 'architecture', build: architecture },
  { id: 'gateway-network', key: 'gatewayNetwork', build: gatewayNetwork },
  { id: 'certificate-planes', key: 'certificatePlanes', build: certificatePlanes },
  { id: 'data-flow', key: 'dataFlow', build: dataFlow },
];
