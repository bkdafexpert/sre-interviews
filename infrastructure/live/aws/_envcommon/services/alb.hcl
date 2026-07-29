# ---------------------------------------------------------------------------------------------------------------------
# COMMON APPLICATION LOAD BALANCER CONFIGURATION
# Public ALB in the public subnets. One listener on :80 with path-based routing:
#   /api/*  -> backend  target group (NestJS, :4000, health /api/health)
#   /*      -> frontend target group (Next.js, :3000, health /login)   [default]
#
# The ECS services register themselves into these target groups (see backend.hcl / frontend.hcl), so target_type=ip.
# HTTPS: add a :443 listener + ACM cert (or front with CloudFront) — see README "HTTPS" note.
# Module: terraform-aws-modules/alb
# ---------------------------------------------------------------------------------------------------------------------

locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  name     = "sgcut-${local.env_vars.locals.environment}"
}

terraform {
  source = "tfr:///terraform-aws-modules/alb/aws?version=9.13.0"
}

dependency "vpc" {
  config_path = "../../networking/vpc"
  mock_outputs = {
    vpc_id         = "vpc-mock"
    public_subnets = ["subnet-mock-a", "subnet-mock-b"]
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

dependency "security_groups" {
  config_path = "../../networking/security-groups"
  mock_outputs = {
    alb_security_group_id = "sg-mock"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

inputs = {
  name     = local.name
  internal = false

  vpc_id  = dependency.vpc.outputs.vpc_id
  subnets = dependency.vpc.outputs.public_subnets

  # Use the ALB SG from our security-group chain rather than letting the module create one.
  create_security_group = false
  security_groups       = [dependency.security_groups.outputs.alb_security_group_id]

  enable_deletion_protection = false # true in prod

  target_groups = {
    frontend = {
      name_prefix       = "fe-"
      protocol          = "HTTP"
      port              = 3000
      target_type       = "ip"
      create_attachment = false # ECS registers targets dynamically
      health_check = {
        path                = "/login"
        matcher             = "200-399"
        healthy_threshold   = 2
        unhealthy_threshold = 3
        interval            = 15
        timeout             = 5
      }
    }
    backend = {
      name_prefix       = "be-"
      protocol          = "HTTP"
      port              = 4000
      target_type       = "ip"
      create_attachment = false
      health_check = {
        path                = "/api/health"
        matcher             = "200-399"
        healthy_threshold   = 2
        unhealthy_threshold = 3
        interval            = 15
        timeout             = 5
      }
    }
  }

  listeners = {
    http = {
      port     = 80
      protocol = "HTTP"

      # Default -> frontend
      forward = {
        target_group_key = "frontend"
      }

      # /api/* -> backend
      rules = {
        api = {
          priority = 10
          actions  = [{ type = "forward", target_group_key = "backend" }]
          conditions = [{
            path_pattern = { values = ["/api/*"] }
          }]
        }
      }
    }
  }
}
