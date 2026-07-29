# Environment-level config: knobs that differ between dev / stage / prod live here, so the _envcommon component
# definitions stay identical across environments and only read these values.
locals {
  environment = "dev"

  # ---- Networking -------------------------------------------------------------------------------------------------
  vpc_cidr         = "10.0.0.0/16"
  public_subnets   = ["10.0.0.0/24", "10.0.1.0/24"]   # ALB + NAT GW
  private_subnets  = ["10.0.10.0/24", "10.0.11.0/24"] # Fargate tasks
  database_subnets = ["10.0.20.0/24", "10.0.21.0/24"] # RDS — isolated data tier (no NAT route)

  # Single NAT gateway in dev to save cost (~1 NAT vs 1-per-AZ). Set false / one_nat_per_az in prod for HA.
  single_nat_gateway = true

  # ---- Data store -------------------------------------------------------------------------------------------------
  db_instance_class    = "db.t3.micro" # t3.micro (Intel): t4g.micro hit insufficient-capacity in eu-west-3
  db_allocated_storage = 20
  db_multi_az          = false # true in prod

  # ---- Services (Fargate) -----------------------------------------------------------------------------------------
  backend_cpu           = 256
  backend_memory        = 512
  backend_desired_count = 2
  backend_min_capacity  = 2
  backend_max_capacity  = 6

  frontend_cpu           = 256
  frontend_memory        = 512
  frontend_desired_count = 2
  frontend_min_capacity  = 2
  frontend_max_capacity  = 6

  # ---- Auth (Cognito) — existing pool, sourced from the app's docker-compose.yml ----------------------------------
  cognito_user_pool_id = "eu-west-3_s7BhtGWWn"
  cognito_client_id    = "450qv2b4bt0fn7t5qsffcv16ov"
  cognito_domain       = "eu-west-3s7bhtgwwn.auth.eu-west-3.amazoncognito.com"

  # ---- CI/CD (GitHub Actions OIDC) --------------------------------------------------------------------------------
  github_repo = "bkdafexpert/sre-interviews"
}
