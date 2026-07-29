# ---------------------------------------------------------------------------------------------------------------------
# SECURITY GROUP CHAIN
# Implements the locked end-to-end access chain from ARCHITECTURE.md §4:
#
#   internet ──:80/:443──> [alb] ──:3000/:4000──> [app] ──:5432──> [db]
#
# Only the ALB is reachable from the internet. The app tasks accept traffic only from the ALB (and from each other,
# so the Next.js frontend can reach the NestJS backend). RDS accepts traffic only from the app tasks.
#
# Defined as one repo-local module because the three SGs reference each other; a single module lets us declare the
# groups first and the cross-referencing rules second without circular dependencies between separate components.
# (In a full Gruntwork setup these live in a separate infrastructure-modules repo; kept in-repo here for the exercise.)
# ---------------------------------------------------------------------------------------------------------------------

# ---- ALB: public entry point ----------------------------------------------------------------------------------------
resource "aws_security_group" "alb" {
  name_prefix = "${var.name_prefix}-alb-"
  description = "ALB - public HTTP/HTTPS ingress"
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name_prefix}-alb" })

  lifecycle { create_before_destroy = true }
}

# ---- App: Fargate tasks (backend + frontend share this SG) ----------------------------------------------------------
resource "aws_security_group" "app" {
  name_prefix = "${var.name_prefix}-app-"
  description = "Fargate tasks - ingress only from ALB and from peer tasks"
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name_prefix}-app" })

  lifecycle { create_before_destroy = true }
}

# ---- DB: RDS PostgreSQL ---------------------------------------------------------------------------------------------
resource "aws_security_group" "db" {
  name_prefix = "${var.name_prefix}-db-"
  description = "RDS Postgres - ingress only from app tasks"
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name_prefix}-db" })

  lifecycle { create_before_destroy = true }
}

# ---- ALB rules ------------------------------------------------------------------------------------------------------
resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP from anywhere"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from anywhere"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "alb_all" {
  security_group_id = aws_security_group.alb.id
  description       = "ALB to app tasks"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# ---- App rules ------------------------------------------------------------------------------------------------------
resource "aws_vpc_security_group_ingress_rule" "app_from_alb_backend" {
  security_group_id            = aws_security_group.app.id
  description                  = "Backend port from ALB"
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = var.backend_port
  to_port                      = var.backend_port
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "app_from_alb_frontend" {
  security_group_id            = aws_security_group.app.id
  description                  = "Frontend port from ALB"
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = var.frontend_port
  to_port                      = var.frontend_port
  ip_protocol                  = "tcp"
}

# Peer-to-peer within the app SG (frontend -> backend). Frontend reaches the backend via the ALB in this scaffold,
# but self-ingress keeps the door open for ECS Service Connect / direct task-to-task calls without another change.
resource "aws_vpc_security_group_ingress_rule" "app_self" {
  security_group_id            = aws_security_group.app.id
  description                  = "Task-to-task within the app tier"
  referenced_security_group_id = aws_security_group.app.id
  ip_protocol                  = "-1"
}

resource "aws_vpc_security_group_egress_rule" "app_all" {
  security_group_id = aws_security_group.app.id
  description       = "Egress to internet (image pull via NAT), RDS, Cognito, etc."
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# ---- DB rules -------------------------------------------------------------------------------------------------------
resource "aws_vpc_security_group_ingress_rule" "db_from_app" {
  security_group_id            = aws_security_group.db.id
  description                  = "Postgres from app tasks only"
  referenced_security_group_id = aws_security_group.app.id
  from_port                    = var.db_port
  to_port                      = var.db_port
  ip_protocol                  = "tcp"
}
