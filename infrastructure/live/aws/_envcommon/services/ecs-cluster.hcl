# ---------------------------------------------------------------------------------------------------------------------
# COMMON ECS CLUSTER CONFIGURATION
# Fargate-only cluster with Container Insights for observability.
# Module: terraform-aws-modules/ecs/aws//modules/cluster
# ---------------------------------------------------------------------------------------------------------------------

locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  name     = "sgcut-${local.env_vars.locals.environment}"
}

terraform {
  source = "tfr:///terraform-aws-modules/ecs/aws//modules/cluster?version=6.12.0"
}

inputs = {
  name = local.name

  # Container Insights -> CPU/mem/task metrics in CloudWatch (observability requirement).
  # v6 renamed `cluster_settings` -> `setting`.
  setting = [{
    name  = "containerInsights"
    value = "enabled"
  }]

  # Fargate + Fargate Spot capacity providers. Weighted default to on-demand Fargate.
  # v6 dropped the `fargate_capacity_providers` convenience var: the module now derives the cluster's
  # capacity_providers list from these map keys (FARGATE, FARGATE_SPOT) and wires them as the default strategy.
  default_capacity_provider_strategy = {
    FARGATE = {
      base   = 1
      weight = 1
    }
    FARGATE_SPOT = {
      weight = 0
    }
  }

  create_cloudwatch_log_group = true
}
