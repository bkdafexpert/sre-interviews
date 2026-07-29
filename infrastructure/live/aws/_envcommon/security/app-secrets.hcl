# ---------------------------------------------------------------------------------------------------------------------
# COMMON APPLICATION SECRETS CONFIGURATION
# Wraps the repo-local _modules/app-secrets (DB password + JWT secret in Secrets Manager).
# Has no dependencies, so it can be applied early — RDS and the backend service depend on it.
# ---------------------------------------------------------------------------------------------------------------------

locals {
  env_vars  = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  live_root = dirname(find_in_parent_folders("root.hcl"))

  name_prefix = "sgcut/${local.env_vars.locals.environment}"
}

terraform {
  source = "${local.live_root}/../../modules/aws//secretsmanager"
}

inputs = {
  name_prefix = local.name_prefix
}
