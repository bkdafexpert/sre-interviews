# ---------------------------------------------------------------------------------------------------------------------
# COMMON ECR CONFIGURATION
# One repository per image. The leaf terragrunt.hcl (shared/ecr-backend, shared/ecr-frontend) sets repository_name.
# Module: terraform-aws-modules/ecr/aws
# ---------------------------------------------------------------------------------------------------------------------

terraform {
  source = "tfr:///terraform-aws-modules/ecr/aws?version=2.3.1"
}

inputs = {
  repository_type = "private"

  # Immutable-ish workflow: CI pushes both an immutable :<git-sha> tag and updates :latest, so keep tags mutable.
  repository_image_tag_mutability = "MUTABLE"
  repository_image_scan_on_push   = true

  # Keep the last 30 images; expire older untagged layers to control storage cost.
  repository_lifecycle_policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 30 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 30
      }
      action = { type = "expire" }
    }]
  })

  # dev convenience: allow `destroy` to remove a repo that still holds images. Set false in prod.
  repository_force_delete = true
}
