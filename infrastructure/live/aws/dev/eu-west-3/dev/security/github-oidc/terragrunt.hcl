include "root" {
  path = find_in_parent_folders("root.hcl")
}

include "envcommon" {
  path           = "${dirname(find_in_parent_folders("root.hcl"))}/_envcommon/security/github-oidc.hcl"
  merge_strategy = "deep"
}

# Bootstrap unit: the OIDC provider + CI roles are what gate the infra pipeline itself. Managing them from that same
# pipeline is a chicken-and-egg / self-lockout risk (a bad apply can revert the very trust the next run needs). So the
# CI pipeline sets TG_CI=true and this unit is excluded from `run --all` there — it is applied only out-of-band, by an
# operator with admin credentials running it locally via `task bootstrap` (see infrastructure/README.md → "Bootstrap
# the OIDC layer"). Deliberately NOT a CI job, so the admin credential never has to live in GitHub Secrets. Local
# runs (TG_CI unset) manage it normally.
exclude {
  if                   = get_env("TG_CI", "false") == "true"
  actions              = ["all"]
  exclude_dependencies = false
}

