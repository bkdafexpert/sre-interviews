# Pinned Terragrunt + OpenTofu toolchain — matches ../.tool-versions.
# Terragrunt drives OpenTofu (root.hcl sets terraform_binary = "tofu"), so the
# image ships `tofu`, not HashiCorp Terraform.
FROM alpine:3.20

ARG OPENTOFU_VERSION=1.12.5
ARG TERRAGRUNT_VERSION=1.1.1
# amd64 | arm64 — set via `docker build --build-arg TARGETARCH=...`; Docker fills it in automatically on buildx.
ARG TARGETARCH=arm64

RUN apk add --no-cache bash ca-certificates curl git unzip aws-cli \
    && curl -fsSL -o /tmp/tofu.zip \
        "https://github.com/opentofu/opentofu/releases/download/v${OPENTOFU_VERSION}/tofu_${OPENTOFU_VERSION}_linux_${TARGETARCH}.zip" \
    && unzip /tmp/tofu.zip -d /usr/local/bin tofu \
    && chmod +x /usr/local/bin/tofu \
    && curl -fsSL -o /usr/local/bin/terragrunt \
        "https://github.com/gruntwork-io/terragrunt/releases/download/v${TERRAGRUNT_VERSION}/terragrunt_linux_${TARGETARCH}" \
    && chmod +x /usr/local/bin/terragrunt \
    && rm -f /tmp/tofu.zip \
    && tofu version && terragrunt --version

# Terragrunt caches provider plugins here; the wrapper mounts a named volume so
# `init` isn't re-downloaded on every container run.
ENV TF_PLUGIN_CACHE_DIR=/tmp/tf-plugin-cache
RUN mkdir -p "$TF_PLUGIN_CACHE_DIR"

WORKDIR /infra
ENTRYPOINT ["terragrunt"]
