{{/*
Control-room helpers.
*/}}
{{- define "control-room.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}
