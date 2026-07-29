# AWS Cloud Map HTTP namespace for ECS Service Connect.
# Service Connect only needs an HTTP namespace (no Route 53 / VPC association): each service registers under it and
# reaches the others by their client_alias DNS name via the per-task Service Connect proxy. Here it lets the frontend
# resolve `backend:4000` directly instead of hair-pinning through the public ALB (which can't path-route bare codes).
resource "aws_service_discovery_http_namespace" "this" {
  name        = var.name
  description = var.description
  tags        = var.tags
}
