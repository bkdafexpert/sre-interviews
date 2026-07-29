# sgcut — Infrastructure (Terragrunt / OpenTofu)

Infrastructure-as-code for **sgcut** (the URL shortener in `../applications`): NestJS API + Next.js UI on
**ECS Fargate**, fronted by an ALB, backed by **RDS PostgreSQL**, deployed from GitHub Actions.

It follows the Gruntwork **`infrastructure-modules` + `infrastructure-live`** split and DRY-Terragrunt conventions
(one root config generating backend + provider, `_envcommon` component definitions, `account / region / env` hierarchy,
`dependency` wiring with mocks). Both trees are **grouped by cloud provider** (`modules/<cloud>/`, `live/<cloud>/`) so
a second cloud is an additive tree rather than a rewrite — see the **Multicloud** section.

> The datastore is **PostgreSQL** (the app is Prisma/NestJS on Postgres), not the Redis/ElastiCache in the older
> `../../ARCHITECTURE.md` draft. Region is **eu-west-3 (Paris)**; the Cognito user pool is created here too
> (`services/cognito`), so its Hosted UI lives in the same region.

---

## Layout

```
infrastructure/
├── modules/                        # reusable OpenTofu modules, by cloud  (== "infrastructure-modules")
│   │                               #   each module is named after the official service (or its shortcut)
│   ├── aws/
│   │   ├── sg/                     #   EC2 security groups — the alb->app->db chain (ARCHITECTURE.md §4)
│   │   ├── secretsmanager/         #   Secrets Manager — DB password + JWT secret
│   │   └── iam/                    #   IAM — OIDC provider + keyless CI/CD deploy role
│   └── azure/                      #   placeholder — Azure analogues when an Azure tree is added
│
└── live/                           # Terragrunt live config, by cloud     (== "infrastructure-live")
    ├── aws/
    │   ├── root.hcl                # remote state (S3) + AWS provider generation + global tags/inputs
    │   ├── _envcommon/             # component definitions shared across environments (DRY)
    │   │   ├── networking/{vpc,security-groups}.hcl
    │   │   ├── data-stores/rds.hcl
    │   │   ├── services/{ecr,ecs-cluster,service-connect-namespace,alb,backend,frontend}.hcl
    │   │   └── security/{app-secrets,github-oidc}.hcl
    │   └── dev/                     # account = dev
    │       ├── account.hcl          #   account id (guard-rail) + state naming
    │       └── eu-west-3/           # region
    │           ├── region.hcl       #   region + AZs
    │           └── dev/             # environment
    │               ├── env.hcl      #   ALL per-env knobs (CIDR, sizing, Google IdP client, GH repo)
    │               ├── networking/{vpc,security-groups}/
    │               ├── security/{app-secrets,github-oidc}/
    │               ├── shared/{ecr-backend,ecr-frontend}/
    │               ├── data-stores/postgres/
    │               └── services/{ecs-cluster,service-connect-namespace,alb,backend,frontend}/
    └── azure/                       # placeholder — mirrors the aws/ tree with cloud-native modules
```

Each cloud carries its own `root.hcl` (provider + backend differ per cloud) and its own `_envcommon` (the components
are genuinely cloud-specific). Adding Azure = a `live/azure/` tree wrapping `modules/azure/` modules; the tooling, the
`account/region/env` (Azure: `subscription/region/env`) hierarchy, and the `dependency` pattern are unchanged.

Each leaf `terragrunt.hcl` is ~5 lines: it `include`s `root.hcl` and the matching `_envcommon` file. All real config
lives in `_envcommon` (shared) + `env.hcl` (per-env values), so adding `stage`/`prod` is a copy of the `dev/` tree
with a new `account.hcl` / `env.hcl`.

## What gets created (dependency order)

```
vpc ─┬─> security-groups ─┬─> alb ──────────┐
     │                    ├─> postgres ─────┤
app-secrets ──────────────┘                 ├─> backend  (Fargate + autoscaling, ALB /api/*)
ecr-backend ────────────────────────────────┤
ecr-frontend, ecs-cluster ──────────────────┴─> frontend (Fargate + autoscaling, ALB default)
service-connect-namespace ──────────────────┴─> backend + frontend (frontend resolves backend:4000)
github-oidc  (independent)
```

Terragrunt resolves this graph automatically via the `dependency` blocks (with `mock_outputs` so `validate`/`plan`
work before anything is applied).

- **VPC** — `10.0.0.0/16`, 2 AZ, 2 public + 2 private + 2 database subnets, IGW, single NAT (dev). The database
  subnets are an isolated data tier: their route table has **no NAT route**, so RDS has zero outbound internet path
  (defense-in-depth on top of the db security group).
- **Security groups** — `alb` (80/443 from world) → `app` (3000/4000 from ALB only, self for task-to-task) → `db`
  (5432 from app only).
- **ECR** — `sgcut-backend`, `sgcut-frontend`, scan-on-push, keep-last-30 lifecycle.
- **RDS PostgreSQL 16** — private subnets, encrypted, password from Secrets Manager.
- **ECS cluster** — Fargate + Fargate Spot, Container Insights on.
- **ALB** — public, `:80`, `/api/* → backend`, default `→ frontend`.
- **Service Connect namespace** — Cloud Map HTTP namespace; the backend registers as `backend:4000` and the
  frontend resolves it directly (task-to-task), so server-side calls skip the public ALB.
- **backend / frontend services** — Fargate in private subnets, registered to the ALB target groups, CPU
  target-tracking autoscaling, awslogs → CloudWatch, JWT injected from Secrets Manager.
- **GitHub OIDC role** — assumed by CI to push ECR + roll the ECS services, no long-lived keys.

## Prerequisites

- OpenTofu + Terragrunt (pinned in `.tool-versions` → `mise install` or `asdf install`).
- AWS credentials for the target account.
- **Recommended — local pre-commit hooks** (mirror the CI static-analysis gate: tofu fmt + tflint + checkov, so
  errors are caught before they reach CI). One-time, from the repo root:
  ```bash
  brew install pre-commit tflint checkov
  export PCT_TFPATH="$(command -v tofu)"   # point the terraform_* hooks at OpenTofu — add to your ~/.zshrc
  pre-commit install                        # see ../.pre-commit-config.yaml
  ```
  It's a fast feedback loop, not a gate — bypassable with `git commit --no-verify`; CI remains authoritative.

## Usage

```bash
cd live/aws/dev/eu-west-3/dev

# fill in the placeholders first (see below), then create the shared S3 state bucket ONCE, from the
# dependency-free vpc unit (all units share one bucket, so bootstrapping any single leaf is enough):
cd networking/vpc && terragrunt backend bootstrap && cd -

terragrunt run --all plan     # plan the whole environment (dependency order)
terragrunt run --all apply    # create everything

# or one component at a time:
cd networking/vpc && terragrunt apply
```

Backend creation is opt-in in Terragrunt (the CLI redesign). **Don't** use `backend bootstrap --all` on a fresh
stack: it evaluates every unit up front, and the dependent units gate their `mock_outputs` to `["validate","plan"]`,
so `bootstrap` can't resolve their (not-yet-applied) dependency outputs and fails. Instead bootstrap the single
dependency-free `vpc` leaf (creates the one shared bucket), or pass `--backend-bootstrap` to `run --all apply` to
create the bucket inline as it applies in dependency order. State locking uses a native `.tflock` object in the same
bucket (OpenTofu ≥ 1.10) — no DynamoDB table.

### Before first apply — replace these placeholders

| Where | Value | Note |
| --- | --- | --- |
| `live/aws/dev/account.hcl` | `aws_account_id` | real dev account ID (used for state naming + provider guard-rail) |
| `live/aws/dev/eu-west-3/dev/env.hcl` | `github_repo` | your `org/repo` for the OIDC trust |
| GitHub Variable | `GOOGLE_CLIENT_ID` | Google OAuth client ID for Cognito's Google IdP (not secret). Read by `services/cognito` via `get_env`; leave unset to stand up the pool without Google. |
| GitHub Secret | `GOOGLE_CLIENT_SECRET` | the matching Google secret — injected as an env var on the cd-infra apply step, never committed (locally: `export` it before `task infra:apply`). After apply, register the pool's `google_redirect_uri` output on the Google OAuth client. |

Images must exist in ECR before the services become healthy: apply `shared/ecr-*` first, let CI push
`:latest`, then apply `services/backend` + `services/frontend` (or expect the initial tasks to fail pulling until CI runs).

## Bootstrap the OIDC layer (one-time, local — `task bootstrap`)

The `security/github-oidc` unit creates the GitHub OIDC provider + the three CI roles (`…-gha-app-deploy`,
`…-gha-infra-all-rw`, `…-gha-infra-all-ro`) + the bootstrap user. It is the one unit CI **cannot** manage: the roles
are what gate the CI pipeline itself, so letting the pipeline manage them is a chicken-and-egg / self-lockout risk (a
bad apply reverts the very trust the next run needs). The unit is therefore excluded from CI `run --all`
(`TG_CI=true`) and applied **out-of-band, locally, by an operator with admin credentials** — via the `bootstrap` task
in the repo-root `Taskfile.yml`, **not** a GitHub Actions job. It stays 100% Terraform; the task is only a local
runner. The point of running it off-CI: the admin credential used for bootstrap never has to live in GitHub Secrets.

```bash
# From the repo root. Authenticate first with admin credentials — either your SSO session, or the dedicated
# bootstrap user's access key set up as a local AWS profile (created in the console; never in TF state / CI).
aws sso login                 # or: export AWS_PROFILE=sgcut-bootstrap
task bootstrap                # = terragrunt backend bootstrap + terragrunt apply on security/github-oidc
# preview only:
task bootstrap:plan
```

After this, the **CI** workflows authenticate purely via OIDC — the only GitHub config they need is **non-sensitive
repo Variables** (no AWS Secrets): `AWS_ACCOUNT_ID`, `PROJECT`, `AWS_REGION`, `TOFU_VERSION`, `TERRAGRUNT_VERSION`
(they build the role ARNs from `PROJECT`/`AWS_ACCOUNT_ID`). Re-run `task bootstrap` locally whenever the OIDC trust
or CI roles change.

## Deploy flow (CI)

Matches `../ARCHITECTURE.md §8`: GitHub Actions assumes the OIDC role → `docker push` to ECR → 
`aws ecs update-service --force-new-deployment` on `:latest`. Terraform stays the source of truth for the task
definition; CI only ships new image layers under the same `:latest` tag.

## Known simplifications (dev scaffold)

- **Single NAT gateway** (cost). Set `single_nat_gateway = false` in `env.hcl` for per-AZ HA in prod.
- **HTTPS at CloudFront, HTTP origin.** The public entry is a CloudFront distribution (`*.cloudfront.net`, default
  cert) that terminates HTTPS and forwards to the ALB over plain `:80` inside AWS (`COOKIE_SECURE=true` on the
  backend). The ALB has no `:443`/ACM listener of its own — see the parked item on locking it to CloudFront.
- **`DATABASE_URL` is a plaintext task-def env** (password generated by TF, stored in Secrets Manager, but woven into
  the URL). Production: store the whole URL in Secrets Manager and inject via `secrets`, or assemble it in the
  container entrypoint from separately-injected secret parts.
- **Module versions** in `_envcommon` are pinned to recent `terraform-aws-modules` releases; run `terragrunt validate`
  and bump if a provider/module argument has shifted. The ECS cluster/service modules are on **v6.x** to match AWS
  provider **v6** (v5.12.0 emitted the `inference_accelerator` block the v6 provider removed); v6 also renamed the
  cluster inputs `cluster_name`→`name`, `cluster_settings`→`setting`, and replaced `fargate_capacity_providers` with
  `default_capacity_provider_strategy`.

## Planned improvements (parked)

Deliberately deferred — decided during the architecture review, not worth the cost/effort on the dev scaffold yet:

- **Lock the ALB to CloudFront only.** CloudFront is the intended public entry, but the ALB SG
  (`modules/aws/sg/main.tf`) still allows `:80`/`:443` from `0.0.0.0/0`, so the ALB DNS is reachable directly and
  bypasses CloudFront (its `redirect-to-https`, and any future WAF). Fix: restrict ALB ingress to the AWS-managed
  CloudFront origin prefix list (`com.amazonaws.global.cloudfront.origin-facing`), or verify a shared secret header
  at the ALB. **No cost — do this before any real exposure.**
- **Fully-private data plane (internal ALB, no NAT).** Make the ALB `internal` in the private subnets and let
  CloudFront reach it via a **VPC origin** (GA Nov 2024); replace the NAT with **VPC interface endpoints**
  (`ecr.api`, `ecr.dkr`, `secretsmanager`, `logs`, `ssmmessages`) + an S3 gateway endpoint. Best posture (zero public
  exposure, no outbound internet route). Two caveats: (1) at dev scale the endpoints cost *more* than the single NAT
  they replace — this is a security play, not a saving; (2) **Cognito has no PrivateLink**, so the backend's runtime
  JWKS fetch still needs egress — keep a minimal egress path or move to offline JWT verification (pre-loaded JWKS, an
  app change). Worth it in prod / at high egress volume, where per-GB endpoint pricing beats the NAT.
- **Dev cost levers** (opposite direction, if a cheap dev is the priority): Fargate `min/desired = 1` per service,
  baseline on `FARGATE_SPOT` (the capacity provider is wired but currently `weight = 0`), Container Insights off, and
  scheduled scale-to-zero out of hours. The fixed floor (CloudFront + ALB + RDS) stays regardless.

## Multicloud

The `modules/<cloud>/` + `live/<cloud>/` grouping makes a second cloud **additive**, not a rewrite. What ports for
free vs. what must be rebuilt:

- **Ports as-is:** OpenTofu + Terragrunt, the `account/region/env` hierarchy, the `_envcommon` + `dependency` DRY
  pattern, the CI shape.
- **Rebuilt per cloud (cloud-native, not a leaky abstraction):** provider block + remote-state backend (S3 → azurerm
  Storage), and every resource module — ECS Fargate → Azure Container Apps/AKS, RDS → PostgreSQL Flexible Server,
  ALB → Application Gateway, ECR → Container Registry (ACR), Secrets Manager → Key Vault, Cognito → Microsoft Entra ID
  (an app change).

**Decision:** stay **single-cloud AWS** for this app. There is no active driver (data-residency mandate, vendor-risk
policy, or DR RTO) that justifies the ~2× surface and the loss of managed-service depth. A portable wrapper over
fundamentally different services is an over-engineering trap; genuine portability would mean re-platforming onto
Kubernetes (EKS/AKS) and pushing it into the app/Helm layer. The layout above keeps that door open without paying
for it now — see `live/azure/README.md` for the sketch.

## Not yet included (natural follow-ups)

`stage` + `prod` environment trees, an **ACM cert + custom domain** on CloudFront (currently the default
`*.cloudfront.net`), and a **WAF** web ACL on the distribution. The Cognito stack (pool, Hosted UI domain, Google
IdP, app client) is now created and owned by Terraform in `services/cognito` — its app client callback/logout URLs are
wired to the CloudFront output. The backend reads the pool/client via a Terraform dependency; the frontend build
(cd-app.yml) reads the non-secret pool/client/domain/app-URL from **SSM Parameter Store** (`/sgcut/dev/frontend/*`,
published by the cognito unit) so the app pipeline never touches the state that holds the Google client secret.
CloudWatch **alarms + dashboard** live in `observability/cloudwatch` (5xx / p99 latency / running-task count).
