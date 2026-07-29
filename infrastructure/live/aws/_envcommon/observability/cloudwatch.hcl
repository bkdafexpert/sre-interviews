# ---------------------------------------------------------------------------------------------------------------------
# COMMON CLOUDWATCH OBSERVABILITY CONFIGURATION
# Wraps the repo-local modules/aws/cloudwatch (alarms + one operational dashboard) for the sgcut platform.
#
# This is the read-only "top of the graph" component: it depends on ALB, the ECS cluster, both ECS services, and RDS
# purely to read their identifiers/ARN-suffixes for the CloudWatch metric dimensions — it creates no infrastructure
# those components rely on. As with every other component, dependency mock_outputs are gated to ["validate","plan"] so
# the graph resolves before anything is applied.
#
# Metric dimensions consumed from siblings:
#   ALB   -> arn_suffix               (LoadBalancer dimension, AWS/ApplicationELB)
#   ALB   -> target_groups[*].arn_suffix
#   ECS   -> cluster name + service names (ClusterName / ServiceName, ECS/ContainerInsights + AWS/ECS)
#   RDS   -> db_instance_identifier   (DBInstanceIdentifier dimension, AWS/RDS)
# ---------------------------------------------------------------------------------------------------------------------

locals {
  env_vars    = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  region_vars = read_terragrunt_config(find_in_parent_folders("region.hcl"))
  name        = "sgcut-${local.env_vars.locals.environment}"

  live_root = dirname(find_in_parent_folders("root.hcl"))
}

terraform {
  source = "${local.live_root}/../../modules/aws//cloudwatch"
}

dependency "alb" {
  config_path = "../../services/alb"
  mock_outputs = {
    arn_suffix = "app/sgcut-dev/0000000000000000"
    target_groups = {
      backend  = { arn_suffix = "targetgroup/be-mock/0000000000000000" }
      frontend = { arn_suffix = "targetgroup/fe-mock/0000000000000000" }
    }
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

dependency "ecs_cluster" {
  config_path                             = "../../services/ecs-cluster"
  mock_outputs                            = { name = "sgcut-dev" }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

dependency "backend" {
  config_path                             = "../../services/backend"
  mock_outputs                            = { name = "sgcut-dev-backend" }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

dependency "frontend" {
  config_path                             = "../../services/frontend"
  mock_outputs                            = { name = "sgcut-dev-frontend" }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

dependency "rds" {
  config_path                             = "../../data-stores/postgres"
  mock_outputs                            = { db_instance_identifier = "sgcut-dev" }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

inputs = {
  name_prefix = local.name
  region      = local.region_vars.locals.aws_region

  alb_arn_suffix = dependency.alb.outputs.arn_suffix
  target_group_arn_suffixes = {
    for k, tg in dependency.alb.outputs.target_groups : k => tg.arn_suffix
  }

  ecs_cluster_name  = dependency.ecs_cluster.outputs.name
  ecs_service_names = [dependency.backend.outputs.name, dependency.frontend.outputs.name]

  rds_instance_id = dependency.rds.outputs.db_instance_identifier

  # Alarm thresholds (module defaults; override per env if needed).
  alb_5xx_threshold         = 5
  alb_p99_latency_threshold = 1
  ecs_min_running_tasks     = 1

  # No SNS topic wired in dev — alarms evaluate but page no one. Add topic ARN(s) here to enable notifications.
  alarm_actions = []
}
