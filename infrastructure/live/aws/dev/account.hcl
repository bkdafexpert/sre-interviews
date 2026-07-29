# Account-level config: one AWS account == one top-level folder.
# Read by root.hcl to name the state bucket/lock table and set the provider's allowed_account_ids guard-rail.
locals {
  account_name = "dev"

  aws_account_id = "176376356319"
}
