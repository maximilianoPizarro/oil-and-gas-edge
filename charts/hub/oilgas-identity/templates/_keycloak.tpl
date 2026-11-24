{{/*
Prefer the configured Keycloak CR. If that object is absent and a CR named
keycloak exists in the keycloak namespace, use that. Offline renders keep
the values, which is the Field Content default (rhbk / rhbk-operator).
*/}}
{{- define "oilgas-identity.placement" -}}
{{- $place := dict "ns" .Values.keycloak.namespace "name" .Values.keycloak.name -}}
{{- $found := lookup "k8s.keycloak.org/v2alpha1" "Keycloak" (index $place "ns") (index $place "name") -}}
{{- if not $found -}}
{{- $alt := lookup "k8s.keycloak.org/v2alpha1" "Keycloak" "keycloak" "keycloak" -}}
{{- if $alt -}}
{{- $_ := set $place "ns" "keycloak" -}}
{{- $_ := set $place "name" "keycloak" -}}
{{- end -}}
{{- end -}}
{{- printf "%s %s" (index $place "ns") (index $place "name") -}}
{{- end -}}
