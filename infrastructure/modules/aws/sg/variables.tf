variable "name_prefix" {
  description = "Prefix for security group names, e.g. sgcut-dev."
  type        = string
}

variable "vpc_id" {
  description = "VPC the security groups are created in."
  type        = string
}

variable "backend_port" {
  description = "Port the NestJS backend container listens on."
  type        = number
  default     = 4000
}

variable "frontend_port" {
  description = "Port the Next.js frontend container listens on."
  type        = number
  default     = 3000
}

variable "db_port" {
  description = "PostgreSQL port."
  type        = number
  default     = 5432
}

variable "tags" {
  description = "Tags to apply to all security groups."
  type        = map(string)
  default     = {}
}
