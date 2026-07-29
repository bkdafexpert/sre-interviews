# Region-level config. eu-west-3 (Paris) — EU region close to the users; the Cognito pool is created here too
# (services/cognito), so the Hosted UI domain lives in the same region.
locals {
  aws_region = "eu-west-3"

  # First two AZs of the region; used for the 2-AZ VPC (public + private subnets per AZ).
  azs = ["eu-west-3a", "eu-west-3b"]
}
