# ---------------------------------------------------------------------------------------------------------------------
# COMMON SECURITY GROUPS CONFIGURATION
# Wraps the repo-local _modules/security-groups. Depends on the VPC for the vpc_id.
# ---------------------------------------------------------------------------------------------------------------------

locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  name     = "sgcut-${local.env_vars.locals.environment}"

  # live/aws dir (folder holding root.hcl); reusable AWS modules live under ../../modules/aws.
  live_root = dirname(find_in_parent_folders("root.hcl"))
}

terraform {
  source = "${local.live_root}/../../modules/aws//sg"
}

dependency "vpc" {
  config_path = "../vpc"

  mock_outputs = {
    vpc_id = "vpc-mock"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

inputs = {
  name_prefix   = local.name
  vpc_id        = dependency.vpc.outputs.vpc_id
  backend_port  = 4000
  frontend_port = 3000
  db_port       = 5432
}
