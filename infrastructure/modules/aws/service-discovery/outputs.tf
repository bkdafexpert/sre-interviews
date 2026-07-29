output "arn" {
  description = "ARN of the Cloud Map namespace — passed to each service's service_connect_configuration.namespace."
  value       = aws_service_discovery_http_namespace.this.arn
}
