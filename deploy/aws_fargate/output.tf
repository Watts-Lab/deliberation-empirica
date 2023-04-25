# IAM
output "iam_task_execution_role_arn" {
  value       = aws_iam_role.ecs_task_execution_role.arn
  description = "IAM task execution role arn"

}

output "iam_task_role_arn" {
  value       = aws_iam_role.task_role.arn
  description = "IAM task role arn"
}

# EFS
output "efs_arn" {
  value       = aws_efs_file_system.efs.arn
  description = "EFS arn"
}

# Load balancer
output "alb_arn" {
  value       = aws_lb.alb.arn
  description = "ALB arn"

}

output "alb_listener_arn" {
  value       = aws_lb_listener.alb_listener.arn
  description = "ALB listener arn"
}

output "alb_target_group_arn" {
  value       = aws_lb_target_group.tg.arn
  description = "ALB target group arn"
}

# Security groups
output "sg_alb_id" {
  value       = aws_security_group.alb_sg.id
  description = "Security group of ALB"
}

output "sg_fargate_service_id" {
  value       = aws_security_group.fargate_service_sg.id
  description = "Security group of Fargate service"
}

output "sg_efs_id" {
  value       = aws_security_group.efs_sg.id
  description = "Security group of EFS"
}

# Cloudwatch
output "cw_logs_arn" {
  value       = aws_cloudwatch_log_group.fargate_cw_log.arn
  description = "Cloudwatch Logs arn"
}

# Fargate
output "fargate_cluster_arn" {
  value       = aws_ecs_cluster.cluster.arn
  description = "Fargate cluster arn"
}

output "fargate_taskdef_arn" {
  value       = aws_ecs_task_definition.task_definition.arn
  description = "Fargate task definition arn"
}

output "fargate_service_name" {
  value       = aws_ecs_service.service.name
  description = "Fargate service arn"
}

# Route 53
output "route53_domain" {
  value       = "https://${var.route53_app_domain}"
  description = "App domain"
}
