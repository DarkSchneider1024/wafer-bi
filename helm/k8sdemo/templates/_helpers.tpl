{{/*
Common labels for all resources
*/}}
{{- define "k8sdemo.labels" -}}
app.kubernetes.io/part-of: k8sdemo
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{/*
Selector labels
*/}}
{{- define "k8sdemo.selectorLabels" -}}
app: {{ .name }}
{{- end -}}
