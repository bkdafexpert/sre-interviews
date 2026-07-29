# ---------------------------------------------------------------------------------------------------------------------
# COGNITO USER POOL (auth for the app — Hosted UI + Google federation)
# Everything the "cognito" auth provider needs, created and owned here (no pre-existing pool):
#   1. user pool          — the directory of users
#   2. user pool domain   — the Hosted UI subdomain (<prefix>.auth.<region>.amazoncognito.com)
#   3. identity provider  — Google federation (optional; created only when Google OAuth creds are supplied)
#   4. app client         — public SPA client (authorization code + PKCE); its callback/logout URLs are derived from
#                           the app's public origin (the CloudFront URL, passed in as app_url) so nothing is
#                           hard-coded and Cognito never drifts from CloudFront.
#   5. SSM parameters     — the NON-SECRET frontend build config (pool id / client id / domain / app URL) published to
#                           Parameter Store, so the app CD pipeline reads it from there (ssm:GetParameter) and never
#                           touches Terraform state — which holds the Google client secret.
# ---------------------------------------------------------------------------------------------------------------------

variable "name" {
  description = "Base name for the pool and app client, e.g. sgcut-dev."
  type        = string
}

variable "domain_prefix" {
  description = "Hosted UI domain prefix (must be globally unique across AWS): <prefix>.auth.<region>.amazoncognito.com."
  type        = string
}

variable "app_url" {
  description = "The app's public HTTPS origin (the CloudFront URL), e.g. https://dxxxx.cloudfront.net. The OAuth callback/logout URLs are derived from it."
  type        = string
}

variable "ssm_prefix" {
  description = "SSM Parameter Store path prefix for the published frontend config, e.g. /sgcut/dev/frontend."
  type        = string
}

variable "google_client_id" {
  description = "Google OAuth client ID (from Google Cloud Console). Empty = skip Google federation (Cognito-native only)."
  type        = string
  default     = ""
}

variable "google_client_secret" {
  description = "Google OAuth client secret. Supply via the GOOGLE_CLIENT_SECRET env var; never commit it."
  type        = string
  default     = ""
  sensitive   = true
}

variable "tags" {
  description = "Tags applied to the user pool."
  type        = map(string)
  default     = {}
}

data "aws_region" "current" {}

locals {
  google_enabled = var.google_client_id != "" && var.google_client_secret != ""
  idps           = local.google_enabled ? ["Google"] : ["COGNITO"]

  hosted_ui_domain = "${var.domain_prefix}.auth.${data.aws_region.current.region}.amazoncognito.com"

  # Everything on Cognito points at the app's public origin (CloudFront).
  callback_urls = ["${var.app_url}/"]
  logout_urls   = ["${var.app_url}/login"]
}

# 1. The user pool. Users sign in with their email; Google-federated users are provisioned here on first login.
resource "aws_cognito_user_pool" "this" {
  name = var.name

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  tags = var.tags
}

# 2. Hosted UI domain — the login page the frontend redirects to (NEXT_PUBLIC_COGNITO_DOMAIN).
resource "aws_cognito_user_pool_domain" "this" {
  domain       = var.domain_prefix
  user_pool_id = aws_cognito_user_pool.this.id
}

# 3. Google as a federated identity provider — created only when Google OAuth creds are supplied. The redirect URI to
#    register in Google Cloud is https://<domain>/oauth2/idpresponse (see the google_redirect_uri output).
resource "aws_cognito_identity_provider" "google" {
  count = local.google_enabled ? 1 : 0

  user_pool_id  = aws_cognito_user_pool.this.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    client_id        = var.google_client_id
    client_secret    = var.google_client_secret
    authorize_scopes = "openid email profile"
  }

  attribute_mapping = {
    email    = "email"
    username = "sub"
  }
}

# 4. The public app client. redirectSignIn/redirectSignOut in the frontend must match these exactly, and they are the
#    CloudFront origin derived from app_url — Terraform keeps Cognito and CloudFront in sync.
resource "aws_cognito_user_pool_client" "app" {
  name         = var.name
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret = false # public SPA client → authorization code + PKCE, no secret

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  supported_identity_providers         = local.idps

  callback_urls = local.callback_urls
  logout_urls   = local.logout_urls

  # Ensure the Google IdP exists before the client references it in supported_identity_providers.
  depends_on = [aws_cognito_identity_provider.google]
}

# 5. Publish the non-secret frontend build config to SSM Parameter Store. The app CD pipeline reads these (never the
#    state) to bake NEXT_PUBLIC_* into the frontend image. String (not SecureString): none of these are secrets.
resource "aws_ssm_parameter" "frontend_config" {
  for_each = {
    cognito_user_pool_id = aws_cognito_user_pool.this.id
    cognito_client_id    = aws_cognito_user_pool_client.app.id
    cognito_domain       = local.hosted_ui_domain
    app_url              = var.app_url
  }

  name  = "${var.ssm_prefix}/${each.key}"
  type  = "String"
  value = each.value
  tags  = var.tags
}

output "user_pool_id" {
  description = "Cognito user pool ID (COGNITO_USER_POOL_ID / NEXT_PUBLIC_COGNITO_USER_POOL_ID)."
  value       = aws_cognito_user_pool.this.id
}

output "client_id" {
  description = "App client ID (COGNITO_CLIENT_ID / NEXT_PUBLIC_COGNITO_CLIENT_ID)."
  value       = aws_cognito_user_pool_client.app.id
}

output "domain" {
  description = "Hosted UI domain FQDN, no scheme (NEXT_PUBLIC_COGNITO_DOMAIN)."
  value       = local.hosted_ui_domain
}

output "google_redirect_uri" {
  description = "Authorized redirect URI to register on the Google OAuth client in Google Cloud Console."
  value       = "https://${local.hosted_ui_domain}/oauth2/idpresponse"
}
