# ---------------------------------------------------------------------------------------------------------------------
# COMMON COGNITO CONFIGURATION  (auth: Hosted UI + Google federation)
# Wraps the repo-local modules/aws/cognito. The whole Cognito stack (pool, Hosted UI domain, Google IdP, app client)
# is created and owned by Terraform — nothing is pre-existing or configured by hand in the console.
#
# The app client's callback/logout URLs are the app's PUBLIC ORIGIN — the CloudFront distribution — read dynamically
# from the cloudfront unit's output, so Cognito and CloudFront can never drift. Acyclic dependency chain:
#   alb -> cloudfront -> cognito   (and the backend service depends on cognito for its COGNITO_* env vars).
# ---------------------------------------------------------------------------------------------------------------------

locals {
  env_vars     = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  account_vars = read_terragrunt_config(find_in_parent_folders("account.hcl"))
  live_root    = dirname(find_in_parent_folders("root.hcl"))

  e = local.env_vars.locals

  name = "sgcut-${local.e.environment}"

  # Hosted UI domain prefix must be globally unique across AWS — suffix with the account ID to avoid collisions.
  domain_prefix = "sgcut-${local.e.environment}-${local.account_vars.locals.aws_account_id}"
}

terraform {
  source = "${local.live_root}/../../modules/aws//cognito"
}

# The public origin the app is served on. CloudFront depends only on the ALB, so this stays acyclic.
dependency "cloudfront" {
  config_path                             = "../cloudfront"
  mock_outputs                            = { public_url = "https://mock.cloudfront.net" }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

inputs = {
  name          = local.name
  domain_prefix = local.domain_prefix

  # The app's public origin = CloudFront. The module derives the OAuth callback/logout URLs from it, and publishes it
  # (+ the Cognito IDs) to SSM for the frontend build to read.
  app_url    = dependency.cloudfront.outputs.public_url
  ssm_prefix = "/sgcut/${local.e.environment}/frontend"

  # Google federation, injected from the environment — a GitHub Variable (client_id, not secret) and a GitHub Secret
  # (client_secret), set as env vars on the cd-infra apply step; locally, export them before `task infra:apply`.
  # Leave both empty to stand up the pool without Google.
  google_client_id     = get_env("GOOGLE_CLIENT_ID", "")
  google_client_secret = get_env("GOOGLE_CLIENT_SECRET", "")
}
