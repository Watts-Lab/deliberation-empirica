
/* module "ec2_sg" {
  source = "terraform-aws-modules/security-group/aws"
  name   = "ec2_sg"
  vpc_id = aws_vpc.project_vpc.id
  ingress_with_cidr_blocks = [
    {
      from_port   = 3000
      to_port     = 3000
      protocol    = "tcp"
      description = "http port"
      cidr_blocks = "0.0.0.0/0"
    }
  ]
  egress_with_cidr_blocks = [
    {
      from_port = 0
      to_port   = 0
      protocol  = "-1"
    cidr_blocks = "0.0.0.0/0" }
  ]
} */

resource "aws_ecs_service" "app_ecs_service" {
  name                               = "${var.app_name}-service"
  cluster                            = aws_ecs_cluster.project_cluster.id
  task_definition                    = aws_ecs_task_definition.task_definition.arn
  desired_count                      = 1
  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200
  launch_type                        = "FARGATE"

  network_configuration {
    security_groups  = ["${aws_security_group.app_ecs_task_sg.id}"]
    subnets          = [aws_subnet.public1.id, aws_subnet.public2.id]
    assign_public_ip = true
  }
  load_balancer {
    target_group_arn = aws_alb_target_group.app_alb_target_group.arn
    container_name   = var.app_name
    container_port   = "3000"
  }
}

