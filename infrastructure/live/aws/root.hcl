# ---------------------------------------------------------------------------------------------------------------------
# ROOT TERRAGRUNT CONFIGURATION
# Every child terragrunt.hcl pulls this in via `include "root" { path = find_in_parent_folders("root.hcl") }`.
# It is the single source of truth for:
#   - remote state (S3 backend with native S3 locking), generated into each module
#   - the AWS provider block (region + default tags), generated into each module
#   - common inputs derived from the account.hcl / region.hcl / env.hcl hierarchy
# Following the Gruntwork "infrastructure-live" DRY pattern.
# ---------------------------------------------------------------------------------------------------------------------

locals {
  # Walk up the tree and load the account-, region-, and env-level config files.
  account_vars = read_terragrunt_config(find_in_parent_folders("account.hcl"))
  region_vars  = read_terragrunt_config(find_in_parent_folders("region.hcl"))
  env_vars     = read_terragrunt_config(find_in_parent_folders("env.hcl"))

  account_name = local.account_vars.locals.account_name
  account_id   = local.account_vars.locals.aws_account_id
  aws_region   = local.region_vars.locals.aws_region
  environment  = local.env_vars.locals.environment

  project = "sgcut"

  # Tags applied to every resource via the provider's default_tags.
  common_tags = {
    Project     = local.project
    Environment = local.environment
    ManagedBy   = "terragrunt"
    Owner       = "sre"
  }
}

# Use OpenTofu as the execution engine (see ../../.tool-versions). Remove this line to fall back to `terraform`.
terraform_binary = "tofu"

# ---------------------------------------------------------------------------------------------------------------------
# REMOTE STATE
# S3 bucket for state, one per account, with native S3 locking (a .tflock object alongside each state file —
# no DynamoDB). `terragrunt backend bootstrap` creates the bucket on first run
# (`generate = ...` writes a backend.tf into each module directory).
# The state key mirrors the folder path, so state layout == repo layout.
# ---------------------------------------------------------------------------------------------------------------------
remote_state {
  backend = "s3"

  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }

  config = {
    encrypt      = true
    bucket       = "${local.project}-tfstate-${local.account_name}-${local.account_id}"
    key          = "${path_relative_to_include()}/tofu.tfstate"
    region       = local.aws_region
    use_lockfile = true # native S3 state locking (OpenTofu >= 1.10) — replaces the DynamoDB lock table

    s3_bucket_tags = local.common_tags
  }
}

# ---------------------------------------------------------------------------------------------------------------------
# PROVIDER
# Generated into every module so modules never hard-code region/credentials. default_tags means every resource is
# tagged without each module having to thread tags through.
# ---------------------------------------------------------------------------------------------------------------------
generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "aws" {
  region = "${local.aws_region}"

  # Guard-rail: refuse to run against the wrong account.
  allowed_account_ids = ["${local.account_id}"]

  default_tags {
    tags = ${jsonencode(local.common_tags)}
  }
}
EOF
}

# ---------------------------------------------------------------------------------------------------------------------
# GLOBAL INPUTS
# Merged (deep) into every module's inputs. Component-specific inputs live in _envcommon and the leaf terragrunt.hcl.
# ---------------------------------------------------------------------------------------------------------------------
inputs = {
  project      = local.project
  environment  = local.environment
  account_name = local.account_name
  account_id   = local.account_id
  aws_region   = local.aws_region
  tags         = local.common_tags
}
