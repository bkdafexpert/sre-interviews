# Region-level config. eu-west-3 (Paris) — chosen to match the existing Cognito user pool (eu-west-3_s7BhtGWWn).
locals {
  aws_region = "eu-west-3"

  # First two AZs of the region; used for the 2-AZ VPC (public + private subnets per AZ).
  azs = ["eu-west-3a", "eu-west-3b"]
}
