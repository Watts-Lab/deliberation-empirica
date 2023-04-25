# Create CW logs
resource "aws_cloudwatch_log_group" "fargate_cw_log" {
  name              = "${var.project_name}-logs"
  retention_in_days = var.log_retention_days
}
