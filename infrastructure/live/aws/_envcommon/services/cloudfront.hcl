# ---------------------------------------------------------------------------------------------------------------------
# COMMON CLOUDFRONT DISTRIBUTION CONFIGURATION
# Public entry point for the app: a CloudFront distribution fronting the ALB, so the public URL is a
# `*.cloudfront.net` domain served over HTTPS (no custom domain / ACM required — README "HTTPS" note).
#
#   viewer  --HTTPS-->  CloudFront (*.cloudfront.net, default cert)  --HTTP :80-->  ALB  -->  frontend / backend
#
# The app is DYNAMIC (Next.js SSR + NestJS API), so this is a pass-through, NOT a cache:
#   - caching disabled       (AWS managed `Managed-CachingDisabled`   policy — min/default/max TTL = 0)
#   - forward everything      (AWS managed `Managed-AllViewerExceptHostHeader` origin-request policy: all viewer
#                              headers except Host, all cookies, all query strings)
#   - all HTTP methods        (GET/HEAD/OPTIONS/PUT/POST/PATCH/DELETE)
#   - viewer_protocol_policy = redirect-to-https; origin_protocol_policy = http-only (ALB listens on :80)
#
# Module: terraform-aws-modules/cloudfront/aws
# ---------------------------------------------------------------------------------------------------------------------

locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  name     = "sgcut-${local.env_vars.locals.environment}"
}

terraform {
  source = "tfr:///terraform-aws-modules/cloudfront/aws?version=3.4.1"
}

dependency "alb" {
  config_path = "../alb"
  mock_outputs = {
    dns_name = "mock.eu-west-3.elb.amazonaws.com"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan", "destroy"]
}

# Expose the distribution's public URL under stable, app-facing names (the community module only emits
# `cloudfront_distribution_*`). Downstream/CI reads `public_url` / `domain_name` / `distribution_id`.
generate "public_url_outputs" {
  path      = "public_url_outputs.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<-EOF
    output "domain_name" {
      description = "CloudFront distribution domain name (e.g. dxxxx.cloudfront.net)."
      value       = aws_cloudfront_distribution.this[0].domain_name
    }

    output "public_url" {
      description = "Public HTTPS entry point for the app."
      value       = "https://$${aws_cloudfront_distribution.this[0].domain_name}"
    }

    output "distribution_id" {
      description = "CloudFront distribution ID (for cache invalidations / CI)."
      value       = aws_cloudfront_distribution.this[0].id
    }
  EOF
}

inputs = {
  comment         = "${local.name} public entry (fronts the ALB)"
  enabled         = true
  is_ipv6_enabled = true
  http_version    = "http2and3"
  price_class     = "PriceClass_100" # NA + EU edge locations (dev/cost); widen in prod

  # Default cert only — public URL is the `*.cloudfront.net` domain, no custom domain / ACM.
  create_origin_access_identity  = false
  create_monitoring_subscription = false

  # Single custom origin = the ALB DNS name, reached over plain HTTP on :80 (the ALB's only listener).
  origin = {
    alb = {
      domain_name = dependency.alb.outputs.dns_name
      custom_origin_config = {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "http-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  # Dynamic app: no caching, forward everything, allow every method. Managed policies keep this declarative:
  #   Managed-CachingDisabled            -> min/default/max TTL = 0, no cache key
  #   Managed-AllViewerExceptHostHeader  -> all viewer headers (except Host), all cookies, all query strings
  # `use_forwarded_values = false` is required so the module emits cache_policy_id instead of the legacy
  # forwarded_values block (the two are mutually exclusive).
  default_cache_behavior = {
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    use_forwarded_values   = false

    cache_policy_name          = "Managed-CachingDisabled"
    origin_request_policy_name = "Managed-AllViewerExceptHostHeader"
  }

  viewer_certificate = {
    cloudfront_default_certificate = true
  }
}
