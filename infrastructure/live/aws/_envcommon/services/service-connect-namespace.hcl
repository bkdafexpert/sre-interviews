# ---------------------------------------------------------------------------------------------------------------------
# COMMON SERVICE CONNECT NAMESPACE CONFIGURATION
# Wraps the repo-local modules/aws/service-discovery (a Cloud Map HTTP namespace). No dependencies, applied early.
# The backend registers into it as `backend:4000` and the frontend resolves it via Service Connect — so the Next.js
# server-side proxy (short-link redirects) reaches the backend directly instead of hair-pinning through the ALB.
# ---------------------------------------------------------------------------------------------------------------------

locals {
  env_vars  = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  live_root = dirname(find_in_parent_folders("root.hcl"))

  name = "sgcut-${local.env_vars.locals.environment}"
}

terraform {
  source = "${local.live_root}/../../modules/aws//service-discovery"
}

inputs = {
  name        = local.name
  description = "ECS Service Connect namespace for ${local.name}"
}
