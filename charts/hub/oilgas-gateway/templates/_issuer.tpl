{{/*
Live Keycloak Route wins over oidc.issuerURL. helm template without a cluster
keeps the values fallback, which is what the render tests set.
*/}}
{{- define "oilgas-gateway.issuer" -}}
{{- $found := dict "host" "" -}}
{{- $namespaces := .Values.oidc.keycloakNamespaces | default (list "rhbk-operator" "keycloak") -}}
{{- range $ns := $namespaces -}}
{{- if not (index $found "host") -}}
{{- $routes := lookup "route.openshift.io/v1" "Route" $ns "" -}}
{{- range $routes.items -}}
{{- if not (index $found "host") -}}
{{- $to := "" -}}
{{- if .spec.to -}}{{- $to = .spec.to.name | default "" -}}{{- end -}}
{{- if and .spec.host (or (eq $to "keycloak") (eq .metadata.name "keycloak")) -}}
{{- $_ := set $found "host" .spec.host -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- $issuer := .Values.oidc.issuerURL -}}
{{- if index $found "host" -}}
{{- $realm := .Values.oidc.realm | default "oilgas" -}}
{{- $issuer = printf "https://%s/realms/%s" (index $found "host") $realm -}}
{{- end -}}
{{- if not $issuer -}}
{{- fail "oidc.issuerURL is empty and no Keycloak Route was found. Set oidc.issuerURL to https://<route host>/realms/oilgas." -}}
{{- end -}}
{{- $issuer -}}
{{- end -}}
