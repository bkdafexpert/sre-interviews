# ---------------------------------------------------------------------------------------------------------------------
# COMMON VPC CONFIGURATION
# Shared across all environments. Environment-specific values (CIDR, subnets, NAT strategy) are read from env.hcl,
# so this file itself never changes between dev/stage/prod.
# Module: terraform-aws-modules/vpc/aws
# ---------------------------------------------------------------------------------------------------------------------

locals {
  env_vars    = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  region_vars = read_terragrunt_config(find_in_parent_folders("region.hcl"))

  name = "sgcut-${local.env_vars.locals.environment}"
}

terraform {
  source = "tfr:///terraform-aws-modules/vpc/aws?version=5.19.0"
}

inputs = {
  name = local.name
  cidr = local.env_vars.locals.vpc_cidr
  azs  = local.region_vars.locals.azs

  public_subnets  = local.env_vars.locals.public_subnets
  private_subnets = local.env_vars.locals.private_subnets

  # Dedicated data tier: RDS lives in its own subnets with a route table that has NO NAT route (defense-in-depth on
  # top of the db security group — the database can never initiate outbound internet traffic even if compromised).
  database_subnets                   = local.env_vars.locals.database_subnets
  create_database_subnet_route_table = true

  # Internet Gateway for public subnets (ALB), NAT Gateway for private-subnet egress (image pulls, RDS out, etc).
  enable_nat_gateway     = true
  single_nat_gateway     = local.env_vars.locals.single_nat_gateway
  one_nat_gateway_per_az = !local.env_vars.locals.single_nat_gateway

  enable_dns_hostnames    = true
  enable_dns_support      = true
  map_public_ip_on_launch = false # tasks live in private subnets; never auto-assign public IPs

  # Tag subnets so other components/tools can discover them by role.
  public_subnet_tags   = { Tier = "public" }
  private_subnet_tags  = { Tier = "private" }
  database_subnet_tags = { Tier = "database" }
}
