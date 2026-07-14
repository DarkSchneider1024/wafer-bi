{{/*
Common labels for all resources
*/}}
{{- define "wafer-bi.labels" -}}
app.kubernetes.io/part-of: wafer-bi
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{/*
Selector labels for a service
*/}}
{{- define "wafer-bi.selectorLabels" -}}
app: {{ .name }}
{{- end -}}
