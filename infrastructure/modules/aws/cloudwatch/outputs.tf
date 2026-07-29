output "dashboard_name" {
  description = "Name of the CloudWatch dashboard."
  value       = aws_cloudwatch_dashboard.this.dashboard_name
}

output "dashboard_arn" {
  description = "ARN of the CloudWatch dashboard."
  value       = aws_cloudwatch_dashboard.this.dashboard_arn
}

output "alarm_names" {
  description = "Names of every alarm created by this module (ALB 5xx x2, ALB p99 latency, one running-task alarm per ECS service)."
  value = concat(
    [
      aws_cloudwatch_metric_alarm.alb_target_5xx.alarm_name,
      aws_cloudwatch_metric_alarm.alb_elb_5xx.alarm_name,
      aws_cloudwatch_metric_alarm.alb_p99_latency.alarm_name,
    ],
    [for a in aws_cloudwatch_metric_alarm.ecs_running_tasks : a.alarm_name],
  )
}

output "alarm_arns" {
  description = "ARNs of every alarm created by this module (useful for composite alarms / auditing)."
  value = concat(
    [
      aws_cloudwatch_metric_alarm.alb_target_5xx.arn,
      aws_cloudwatch_metric_alarm.alb_elb_5xx.arn,
      aws_cloudwatch_metric_alarm.alb_p99_latency.arn,
    ],
    [for a in aws_cloudwatch_metric_alarm.ecs_running_tasks : a.arn],
  )
}
