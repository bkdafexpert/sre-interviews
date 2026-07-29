
# ---------------------------------------------------------------------------------------------------------------------
# APPLICATION SECRETS
# Generates and stores the two secrets the app needs at runtime:
#   - the PostgreSQL master password (consumed by RDS, and used to assemble DATABASE_URL for the backend task)
#   - JWT_SECRET (session-cookie signing key for the NestJS backend)
#
# Both are stored in AWS Secrets Manager. The backend ECS task injects JWT_SECRET via `secrets` (valueFrom), so it
# never appears in the task definition in plaintext. The DB password is also exposed as a module output so RDS can
# consume it and the DATABASE_URL can be assembled — see the note in _envcommon/services/backend.hcl.
# ---------------------------------------------------------------------------------------------------------------------

variable "name_prefix" {
  description = "Secret name prefix, e.g. sgcut/dev."
  type        = string
}

variable "tags" {
  description = "Tags applied to the secrets."
  type        = map(string)
  default     = {}
}

variable "recovery_window_in_days" {
  description = "Days before a deleted secret is purged. 0 = delete immediately (dev, so a destroy/recreate cycle can reuse the same name); set 7-30 in prod."
  type        = number
  default     = 0
}

resource "random_password" "db" {
  length  = 32
  special = false # keep it URL-safe for DATABASE_URL
}

resource "random_password" "jwt" {
  length  = 48
  special = true
}

resource "aws_secretsmanager_secret" "db_password" {
  name                    = "${var.name_prefix}/db-password"
  description             = "PostgreSQL master password for sgcut."
  recovery_window_in_days = var.recovery_window_in_days
  tags                    = var.tags
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db.result
}

resource "aws_secretsmanager_secret" "jwt" {
  name                    = "${var.name_prefix}/jwt-secret"
  description             = "JWT signing secret for the sgcut backend session cookie."
  recovery_window_in_days = var.recovery_window_in_days
  tags                    = var.tags
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id     = aws_secretsmanager_secret.jwt.id
  secret_string = random_password.jwt.result
}

output "db_password" {
  description = "Generated Postgres master password (consumed by RDS + DATABASE_URL assembly)."
  value       = random_password.db.result
  sensitive   = true
}

output "db_password_secret_arn" {
  description = "Secrets Manager ARN of the DB password."
  value       = aws_secretsmanager_secret.db_password.arn
}

output "jwt_secret_arn" {
  description = "Secrets Manager ARN of the JWT secret (injected into the backend task via `secrets`)."
  value       = aws_secretsmanager_secret.jwt.arn
}
