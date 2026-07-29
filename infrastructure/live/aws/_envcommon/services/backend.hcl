# ---------------------------------------------------------------------------------------------------------------------
# COMMON BACKEND SERVICE CONFIGURATION  (NestJS API, :4000)
# Fargate service in the private subnets, registered into the ALB "backend" target group, CPU target-tracking
# autoscaling, JWT injected from Secrets Manager. Reaches RDS over the app->db security-group rule.
# Module: terraform-aws-modules/ecs/aws//modules/service
# ---------------------------------------------------------------------------------------------------------------------

locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  e        = local.env_vars.locals
  name     = "sgcut-${local.e.environment}-backend"
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
  mock_outputs                            = { dns_name = "mock.elb.amazonaws.com", target_groups = { backend = { arn = "arn:aws:elasticloadbalancing:eu-west-3:111111111111:targetgroup/be-mock/0" } } }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

# The public entry point is CloudFront (HTTPS), not the raw HTTP ALB — the CORS origin + secure cookie must match it.
# Acyclic: cloudfront depends only on the ALB, so `run --all` applies alb -> cloudfront -> backend.
dependency "cloudfront" {
  config_path                             = "../cloudfront"
  mock_outputs                            = { public_url = "https://mock.cloudfront.net" }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

# Cognito is created & owned by Terraform; the backend verifies ID tokens against this pool/client (aws-jwt-verify).
dependency "cognito" {
  config_path                             = "../cognito"
  mock_outputs                            = { user_pool_id = "eu-west-3_mock", client_id = "mockclient" }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

dependency "ecr" {
  config_path                             = "../../shared/ecr-backend"
  mock_outputs                            = { repository_url = "111111111111.dkr.ecr.eu-west-3.amazonaws.com/sgcut-backend" }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

dependency "rds" {
  config_path                             = "../../data-stores/postgres"
  mock_outputs                            = { db_instance_address = "mock.rds.amazonaws.com" }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

dependency "app_secrets" {
  config_path                             = "../../security/app-secrets"
  mock_outputs                            = { db_password = "mock", jwt_secret_arn = "arn:aws:secretsmanager:eu-west-3:111111111111:secret:mock", db_password_secret_arn = "arn:aws:secretsmanager:eu-west-3:111111111111:secret:mock2" }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

inputs = {
  name        = local.name
  cluster_arn = dependency.ecs_cluster.outputs.arn

  # Service Connect: register this service in the namespace as `backend:4000` (port_name matches the container
  # portMappings name below), so the frontend's server-side proxy can reach it directly (short-link redirects).
  service_connect_configuration = {
    namespace = dependency.service_connect_namespace.outputs.arn
    service = [{
      port_name      = "backend"
      discovery_name = "backend"
      client_alias = {
        dns_name = "backend"
        port     = 4000
      }
    }]
  }

  cpu           = local.e.backend_cpu
  memory        = local.e.backend_memory
  desired_count = local.e.backend_desired_count

  # Zero-downtime deploys: ECS watches the ALB health checks during a rollout and automatically rolls
  # back to the last healthy task set if the new one fails to stabilise (deployment circuit breaker).
  deployment_circuit_breaker = {
    enable   = true
    rollback = true
  }

  # Private subnets + our shared app SG. No public IP (egress via NAT).
  subnet_ids            = dependency.vpc.outputs.private_subnets
  assign_public_ip      = false
  create_security_group = false
  security_group_ids    = [dependency.security_groups.outputs.app_security_group_id]

  enable_execute_command = true # `aws ecs execute-command` for debugging

  # Let the execution role read the secrets we inject below.
  task_exec_secret_arns = [
    dependency.app_secrets.outputs.jwt_secret_arn,
    dependency.app_secrets.outputs.db_password_secret_arn,
  ]

  # Register into the ALB backend target group.
  load_balancer = {
    service = {
      target_group_arn = dependency.alb.outputs.target_groups["backend"].arn
      container_name   = "backend"
      container_port   = 4000
    }
  }

  # ---- CPU target-tracking autoscaling (the "Autoscaling" box in the diagram) -----------------------------------
  enable_autoscaling       = true
  autoscaling_min_capacity = local.e.backend_min_capacity
  autoscaling_max_capacity = local.e.backend_max_capacity
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
    backend = {
      essential = true
      image     = "${dependency.ecr.outputs.repository_url}:latest"

      portMappings = [{ name = "backend", containerPort = 4000, protocol = "tcp" }]

      # NOTE: DATABASE_URL embeds the DB password as a plaintext env var here. It is generated by Terraform and lives
      # in Secrets Manager, but assembling the full URL means it also lands in the task definition. Acceptable for
      # dev; production hardening = store the whole URL in Secrets Manager and inject it via `secrets` (valueFrom),
      # or have the container entrypoint assemble it from separately-injected secret parts.
      environment = [
        { name = "PORT", value = "4000" },
        { name = "DATABASE_URL", value = "postgresql://sgcut:${dependency.app_secrets.outputs.db_password}@${dependency.rds.outputs.db_instance_address}:5432/sgcut?schema=public" },
        { name = "FRONTEND_URL", value = dependency.cloudfront.outputs.public_url },
        { name = "COOKIE_SECURE", value = "true" }, # traffic enters via CloudFront HTTPS
        { name = "AUTH_PROVIDER", value = "cognito" },
        { name = "COGNITO_USER_POOL_ID", value = dependency.cognito.outputs.user_pool_id },
        { name = "COGNITO_CLIENT_ID", value = dependency.cognito.outputs.client_id },
      ]

      secrets = [
        { name = "JWT_SECRET", valueFrom = dependency.app_secrets.outputs.jwt_secret_arn },
      ]

      readonlyRootFilesystem = false

      # awslogs is wired automatically by the module's per-container CloudWatch log group.
    }
  }
}
