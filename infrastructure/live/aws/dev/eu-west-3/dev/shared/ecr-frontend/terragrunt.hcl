include "root" {
  path = find_in_parent_folders("root.hcl")
}

include "envcommon" {
  path           = "${dirname(find_in_parent_folders("root.hcl"))}/_envcommon/services/ecr.hcl"
  merge_strategy = "deep"
}

inputs = {
  repository_name = "sgcut-frontend"
}
