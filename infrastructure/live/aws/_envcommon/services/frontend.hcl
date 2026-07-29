# ---------------------------------------------------------------------------------------------------------------------
# COMMON FRONTEND SERVICE CONFIGURATION  (Next.js UI, :3000)
# Fargate service in the private subnets, registered into the ALB "frontend" (default) target group. The Next.js
# server-side rewrites (/api/* -> BACKEND_URL) point at the ALB, so the frontend reaches the backend through the same
# load balancer (the ALB routes /api/* to the backend target group). NEXT_PUBLIC_* / Cognito values are baked into
# the image at build time by CI; only BACKEND_URL is needed at runtime.
# Module: terraform-aws-modules/ecs/aws//modules/service
# ---------------------------------------------------------------------------------------------------------------------

locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  e        = local.env_vars.locals
  name     = "sgcut-${local.e.environment}-frontend"
}

terraform {
  source = "tfr:///terraform-aws-modules/ecs/aws//modules/service?version=6.12.0"
}

dependency "vpc" {
  config_path                             = "../../networking/vpc"
  mock_outputs                            = { private_subnets = ["subnet-mock-a", "subnet-mock-b"] }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

dependency "security_groups" {
  config_path                             = "../../networking/security-groups"
  mock_outputs                            = { app_security_group_id = "sg-mock" }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

dependency "ecs_cluster" {
  config_path                             = "../ecs-cluster"
  mock_outputs                            = { arn = "arn:aws:ecs:eu-west-3:111111111111:cluster/mock" }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

dependency "service_connect_namespace" {
  config_path                             = "../service-connect-namespace"
  mock_outputs                            = { arn = "arn:aws:servicediscovery:eu-west-3:111111111111:namespace/ns-mock" }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

dependency "alb" {
  config_path                             = "../alb"
  mock_outputs                            = { dns_name = "mock.elb.amazonaws.com", target_groups = { frontend = { arn = "arn:aws:elasticloadbalancing:eu-west-3:111111111111:targetgroup/fe-mock/0" } } }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

dependency "ecr" {
  config_path                             = "../../shared/ecr-frontend"
  mock_outputs                            = { repository_url = "111111111111.dkr.ecr.eu-west-3.amazonaws.com/sgcut-frontend" }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

inputs = {
  name        = local.name
  cluster_arn = dependency.ecs_cluster.outputs.arn

  # Service Connect client: join the namespace (no `service` block = client-only) so the Next.js server-side
  # proxy can resolve `backend:4000` — the value baked into the image — for short-link redirects.
  service_connect_configuration = {
    namespace = dependency.service_connect_namespace.outputs.arn
  }

  cpu           = local.e.frontend_cpu
  memory        = local.e.frontend_memory
  desired_count = local.e.frontend_desired_count

  # Zero-downtime deploys: auto-rollback to the last healthy task set if a rollout fails to stabilise.
  deployment_circuit_breaker = {
    enable   = true
    rollback = true
  }

  subnet_ids            = dependency.vpc.outputs.private_subnets
  assign_public_ip      = false
  create_security_group = false
  security_group_ids    = [dependency.security_groups.outputs.app_security_group_id]

  enable_execute_command = true

  load_balancer = {
    service = {
      target_group_arn = dependency.alb.outputs.target_groups["frontend"].arn
      container_name   = "frontend"
      container_port   = 3000
    }
  }

  enable_autoscaling       = true
  autoscaling_min_capacity = local.e.frontend_min_capacity
  autoscaling_max_capacity = local.e.frontend_max_capacity
  autoscaling_policies = {
    cpu = {
      policy_type = "TargetTrackingScaling"
      target_tracking_scaling_policy_configuration = {
        predefined_metric_specification = { predefined_metric_type = "ECSServiceAverageCPUUtilization" }
        target_value                    = 60
      }
    }
  }

  container_definitions = {
    frontend = {
      essential = true
      image     = "${dependency.ecr.outputs.repository_url}:latest"

      portMappings = [{ name = "frontend", containerPort = 3000, protocol = "tcp" }]

      environment = [
        # Next.js server-side rewrites (/api/* and short-link /:code -> backend) reach the backend directly via
        # Service Connect (`backend:4000`), not the public ALB — the ALB can't path-route bare short codes.
        { name = "BACKEND_URL", value = "http://backend:4000" },
      ]

      readonlyRootFilesystem = false
    }
  }
}
