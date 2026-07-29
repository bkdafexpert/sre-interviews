# ---------------------------------------------------------------------------------------------------------------------
# COMMON RDS POSTGRESQL CONFIGURATION
# The app is NestJS + Prisma on PostgreSQL (see applications/backend/prisma/schema.prisma), so the data store is RDS
# Postgres — NOT the ElastiCache/Redis mentioned in the older ARCHITECTURE.md draft.
# Module: terraform-aws-modules/rds/aws
# ---------------------------------------------------------------------------------------------------------------------

locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  name     = "sgcut-${local.env_vars.locals.environment}"
}

terraform {
  source = "tfr:///terraform-aws-modules/rds/aws?version=6.10.0"
}

dependency "vpc" {
  config_path = "../../networking/vpc"
  mock_outputs = {
    vpc_id           = "vpc-mock"
    private_subnets  = ["subnet-mock-a", "subnet-mock-b"]
    database_subnets = ["subnet-mock-db-a", "subnet-mock-db-b"]
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

dependency "security_groups" {
  config_path = "../../networking/security-groups"
  mock_outputs = {
    db_security_group_id = "sg-mock"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

dependency "app_secrets" {
  config_path = "../../security/app-secrets"
  mock_outputs = {
    db_password = "mock-password"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

inputs = {
  identifier = local.name

  engine               = "postgres"
  engine_version       = "16"
  family               = "postgres16"
  major_engine_version = "16"
  instance_class       = local.env_vars.locals.db_instance_class

  allocated_storage     = local.env_vars.locals.db_allocated_storage
  max_allocated_storage = local.env_vars.locals.db_allocated_storage * 5 # storage autoscaling ceiling
  storage_encrypted     = true

  db_name  = "sgcut"
  username = "sgcut"
  port     = 5432

  # We manage the password ourselves via _modules/app-secrets so the same value can be woven into DATABASE_URL for
  # the backend task. (Alternative: manage_master_user_password = true to let RDS own it in Secrets Manager.)
  manage_master_user_password = false
  password                    = dependency.app_secrets.outputs.db_password

  multi_az               = local.env_vars.locals.db_multi_az
  create_db_subnet_group = true
  subnet_ids             = dependency.vpc.outputs.database_subnets # isolated data-tier subnets (no NAT route)
  vpc_security_group_ids = [dependency.security_groups.outputs.db_security_group_id]

  # dev-friendly lifecycle. Harden for prod (deletion protection on, final snapshot on, longer backups).
  backup_retention_period = 7
  deletion_protection     = false
  skip_final_snapshot     = true
  apply_immediately       = true

  performance_insights_enabled    = true
  create_cloudwatch_log_group     = true
  enabled_cloudwatch_logs_exports = ["postgresql"]
}
