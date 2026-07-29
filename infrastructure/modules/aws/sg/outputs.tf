output "alb_security_group_id" {
  description = "Security group for the public ALB."
  value       = aws_security_group.alb.id
}

output "app_security_group_id" {
  description = "Security group shared by the Fargate backend + frontend tasks."
  value       = aws_security_group.app.id
}

output "db_security_group_id" {
  description = "Security group for RDS Postgres."
  value       = aws_security_group.db.id
}
