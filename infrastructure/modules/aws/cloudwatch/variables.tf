variable "name_prefix" {
  description = "Prefix for alarm/dashboard names, e.g. sgcut-dev. Keeps every object grouped per environment."
  type        = string
}

variable "region" {
  description = "AWS region the metrics live in (used for the dashboard widgets)."
  type        = string
}

# ---- ALB ------------------------------------------------------------------------------------------------------------
variable "alb_arn_suffix" {
  description = "ARN suffix of the ALB (e.g. app/sgcut-dev/abc123) — the LoadBalancer dimension value for AWS/ApplicationELB metrics."
  type        = string
}

variable "target_group_arn_suffixes" {
  description = "Map of target-group key -> ARN suffix (e.g. { backend = \"targetgroup/be-.../...\" }). Used for per-target latency widgets. Optional."
  type        = map(string)
  default     = {}
}

# ---- ECS ------------------------------------------------------------------------------------------------------------
variable "ecs_cluster_name" {
  description = "ECS cluster name — the ClusterName dimension for ECS/ContainerInsights + AWS/ECS metrics."
  type        = string
}

variable "ecs_service_names" {
  description = "List of ECS service names to monitor (one RunningTaskCount alarm + CPU/mem widget series per service)."
  type        = list(string)
  default     = []
}

# ---- RDS ------------------------------------------------------------------------------------------------------------
variable "rds_instance_id" {
  description = "RDS instance identifier — the DBInstanceIdentifier dimension for AWS/RDS metrics."
  type        = string
}

# ---- Thresholds -----------------------------------------------------------------------------------------------------
variable "period" {
  description = "Metric period (seconds) used for the alarms. Default 5 minutes."
  type        = number
  default     = 300
}

variable "alb_5xx_threshold" {
  description = "Alarm when ALB 5xx count (Target and ELB) over the period exceeds this. Default > 5."
  type        = number
  default     = 5
}

variable "alb_5xx_evaluation_periods" {
  description = "Number of consecutive periods the 5xx threshold must be breached before alarming."
  type        = number
  default     = 1
}

variable "alb_p99_latency_threshold" {
  description = "Alarm when TargetResponseTime p99 (seconds) exceeds this. Default > 1s."
  type        = number
  default     = 1
}

variable "alb_latency_evaluation_periods" {
  description = "Number of consecutive periods the p99 latency threshold must be breached before alarming."
  type        = number
  default     = 3
}

variable "ecs_min_running_tasks" {
  description = "Alarm when a service's RunningTaskCount drops below this. Default < 1 (service has no running tasks)."
  type        = number
  default     = 1
}

# ---- Actions --------------------------------------------------------------------------------------------------------
variable "alarm_actions" {
  description = "SNS topic ARNs notified when an alarm enters ALARM. Empty [] => alarms still evaluate, they just page no one (validates without an SNS topic)."
  type        = list(string)
  default     = []
}

variable "ok_actions" {
  description = "SNS topic ARNs notified when an alarm returns to OK. Optional."
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags applied to the alarms (the dashboard resource is untagged by the API)."
  type        = map(string)
  default     = {}
}
