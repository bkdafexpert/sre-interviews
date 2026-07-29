# ---------------------------------------------------------------------------------------------------------------------
# GITHUB ACTIONS OIDC DEPLOY ROLE
# Lets the CI pipeline (ARCHITECTURE.md §8) authenticate to AWS with no long-lived keys: GitHub Actions presents an
# OIDC token, assumes this role, and gets short-lived credentials scoped to "push image to ECR + roll the ECS service".
# ---------------------------------------------------------------------------------------------------------------------

variable "name" {
  description = "Role name."
  type        = string
}

variable "github_repo" {
  description = "GitHub repository allowed to assume the role, as \"org/repo\"."
  type        = string
}

variable "aws_region" {
  type = string
}

variable "account_id" {
  type = string
}

variable "create_oidc_provider" {
  description = "Create the account-wide GitHub OIDC provider (set false if it already exists in the account)."
  type        = bool
  default     = true
}

variable "create_infra_role" {
  description = "Also create a broad Terragrunt plan/apply role for GitHub Actions (see infra role below)."
  type        = bool
  default     = false
}

variable "infra_role_name" {
  description = "Name of the Terragrunt apply role — AdministratorAccess, trusted on main only (used when create_infra_role = true)."
  type        = string
  default     = ""
}

variable "infra_plan_role_name" {
  description = "Name of the Terragrunt plan role — ReadOnlyAccess, trusted on PRs (used when create_infra_role = true)."
  type        = string
  default     = ""
}

variable "create_bootstrap_user" {
  description = "Create the static-credential bootstrap IAM user for the local infra-bootstrap task (manages the OIDC roles + state backend, i.e. the resources that gate the OIDC pipeline itself). Access key is generated out-of-band (console) so it never lands in TF state."
  type        = bool
  default     = false
}

variable "bootstrap_user_name" {
  description = "Name of the bootstrap IAM user (used when create_bootstrap_user = true)."
  type        = string
  default     = ""
}

variable "tags" {
  type    = map(string)
  default = {}
}

locals {
  oidc_url     = "token.actions.githubusercontent.com"
  provider_arn = var.create_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : "arn:aws:iam::${var.account_id}:oidc-provider/${local.oidc_url}"

  # This org enables GitHub's "customize the subject claim" with numeric IDs, so the token `sub` looks like
  # `repo:OWNER@<owner_id>/REPO@<repo_id>:ref:...` — an exact `repo:OWNER/REPO:*` match therefore fails. AWS still
  # requires a `sub` (or `job_workflow_ref`) condition, so we use a repo-scoped wildcard tolerant of the @IDs, and
  # lock the exact repo via the clean `repository` claim (unaffected by the sub customization).
  gh_owner    = split("/", var.github_repo)[0]
  gh_name     = split("/", var.github_repo)[1]
  gh_sub_glob = "repo:${local.gh_owner}*/${local.gh_name}*:*"
}

resource "aws_iam_openid_connect_provider" "github" {
  count           = var.create_oidc_provider ? 1 : 0
  url             = "https://${local.oidc_url}"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
  tags            = var.tags
}

data "aws_iam_policy_document" "trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [local.provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_url}:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "${local.oidc_url}:sub"
      values   = [local.gh_sub_glob]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_url}:repository"
      values   = [var.github_repo]
    }
  }
}

resource "aws_iam_role" "this" {
  name               = var.name
  assume_role_policy = data.aws_iam_policy_document.trust.json
  tags               = var.tags
}

data "aws_iam_policy_document" "deploy" {
  # ECR: auth + push images.
  statement {
    sid       = "ECRAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    sid = "ECRPush"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:CompleteLayerUpload",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
      "ecr:DescribeImages", # CD checks the version tag exists before deploying
    ]
    resources = ["arn:aws:ecr:${var.aws_region}:${var.account_id}:repository/sgcut-*"]
  }

  # ECS: force a new deployment of the services + read task/service state.
  statement {
    sid = "ECSDeploy"
    actions = [
      "ecs:UpdateService",
      "ecs:DescribeServices",
      "ecs:DescribeTaskDefinition",
      "ecs:RegisterTaskDefinition",
      "ecs:ListTasks",
      "ecs:DescribeTasks",
    ]
    resources = ["*"]
  }

  # Pass the ECS task/execution roles when registering task definitions.
  statement {
    sid       = "PassRole"
    actions   = ["iam:PassRole"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "${var.name}-deploy"
  role   = aws_iam_role.this.id
  policy = data.aws_iam_policy_document.deploy.json
}

output "role_arn" {
  description = "ARN to set as the CI's role-to-assume (AWS_ROLE_ARN)."
  value       = aws_iam_role.this.arn
}

# ---------------------------------------------------------------------------------------------------------------------
# INFRA (TERRAGRUNT) ROLES — run the whole stack from GitHub Actions. Split in two along the plan/apply boundary,
# because `pull_request` runs execute PR-controlled workflow code: a single AdministratorAccess role trusted on PRs
# would let anyone who can open a PR rewrite the workflow (turn `plan` into `apply`, or exfiltrate credentials) and
# wield admin. So:
#   - infra (apply) role: AdministratorAccess, trusted on `main` ONLY — reached only by the post-merge apply.
#   - infra_plan role:     ReadOnlyAccess,      trusted on PRs (and main) — the worst a malicious PR can do is read.
# CI picks the role by event (see .github/workflows/infra.yml); PR plans run with `-lock=false` since the read-only
# role can't write the S3 state lock and a plan needs no lock. Swap the managed policies for scoped ones beyond dev.
# ---------------------------------------------------------------------------------------------------------------------
data "aws_iam_policy_document" "infra_trust" {
  count = var.create_infra_role ? 1 : 0

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [local.provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_url}:aud"
      values   = ["sts.amazonaws.com"]
    }
    # AWS requires a `sub` (or `job_workflow_ref`) condition that isn't scoped to all, so we keep a repo-scoped `sub`
    # wildcard — which also tolerates a customized/extended `sub` (an exact `sub` match was failing). The real
    # admin gate is the native `ref` claim: only tokens from the main branch match, so PR tokens
    # (ref = refs/pull/N/merge) can never reach this role.
    condition {
      test     = "StringLike"
      variable = "${local.oidc_url}:sub"
      values   = [local.gh_sub_glob]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_url}:repository"
      values   = [var.github_repo]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_url}:ref"
      values   = ["refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "infra" {
  count              = var.create_infra_role ? 1 : 0
  name               = var.infra_role_name
  assume_role_policy = data.aws_iam_policy_document.infra_trust[0].json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "infra_admin" {
  count      = var.create_infra_role ? 1 : 0
  role       = aws_iam_role.infra[0].name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

output "infra_role_arn" {
  description = "ARN of the apply role (admin, main-only). null if not created."
  value       = var.create_infra_role ? aws_iam_role.infra[0].arn : null
}

# ---- Read-only plan role (trusted on PRs) ---------------------------------------------------------------------------
data "aws_iam_policy_document" "infra_plan_trust" {
  count = var.create_infra_role ? 1 : 0

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [local.provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_url}:aud"
      values   = ["sts.amazonaws.com"]
    }
    # Read-only role: any workflow token from this repo may assume it (PR plans and main). Repo-scoped `sub` wildcard
    # — satisfies AWS's sub requirement and tolerates a customized/extended `sub`.
    condition {
      test     = "StringLike"
      variable = "${local.oidc_url}:sub"
      values   = [local.gh_sub_glob]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_url}:repository"
      values   = [var.github_repo]
    }
  }
}

resource "aws_iam_role" "infra_plan" {
  count              = var.create_infra_role ? 1 : 0
  name               = var.infra_plan_role_name
  assume_role_policy = data.aws_iam_policy_document.infra_plan_trust[0].json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "infra_plan_readonly" {
  count      = var.create_infra_role ? 1 : 0
  role       = aws_iam_role.infra_plan[0].name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

output "infra_plan_role_arn" {
  description = "ARN of the plan role (read-only, PR-trusted). null if not created."
  value       = var.create_infra_role ? aws_iam_role.infra_plan[0].arn : null
}

# ---------------------------------------------------------------------------------------------------------------------
# BOOTSTRAP USER — static credentials for bootstrapping the OIDC layer.
# The OIDC provider + CI roles + state bucket are what gate the OIDC pipeline, so they can't be managed BY that
# pipeline (chicken-and-egg / self-lockout). This user's static key (created in the console, never in TF state) is the
# out-of-band admin credential used to run the bootstrap — today via a LOCAL `task bootstrap` (see infrastructure's
# Taskfile / README), not GitHub Actions, so the key never lives in CI. AdministratorAccess for simplicity; rotate it.
# ---------------------------------------------------------------------------------------------------------------------
resource "aws_iam_user" "bootstrap" {
  count = var.create_bootstrap_user ? 1 : 0
  name  = var.bootstrap_user_name
  tags  = var.tags

  # The access key is generated out-of-band (console) and never enters TF state, so Terraform can't clean it up on
  # destroy — without this, DeleteUser 409s with "must delete access keys first". force_destroy lets the provider
  # remove the user's keys/MFA/etc. before deleting the user itself.
  force_destroy = true
}

resource "aws_iam_user_policy_attachment" "bootstrap_admin" {
  count      = var.create_bootstrap_user ? 1 : 0
  user       = aws_iam_user.bootstrap[0].name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

output "bootstrap_user_name" {
  description = "Name of the bootstrap IAM user (generate its access key in the console for local bootstrap). null if not created."
  value       = var.create_bootstrap_user ? aws_iam_user.bootstrap[0].name : null
}
