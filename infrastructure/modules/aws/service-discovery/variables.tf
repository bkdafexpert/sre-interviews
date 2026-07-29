variable "name" {
  description = "Cloud Map HTTP namespace name (the Service Connect namespace), e.g. sgcut-dev."
  type        = string
}

variable "description" {
  description = "Namespace description."
  type        = string
  default     = "ECS Service Connect namespace"
}

variable "tags" {
  description = "Tags to apply to the namespace."
  type        = map(string)
  default     = {}
}
