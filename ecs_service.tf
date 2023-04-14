provider "aws" {
  region  = "us-east-1"
  profile = "aws-csslab-deliberation-seas-acct-PennAccountAdministrator"
}

resource "aws_security_group" "deliberation" {
  name_prefix = "deliberation"
  vpc_id      = aws_vpc.deliberation.id
}

resource "aws_vpc" "deliberation" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "deliberation" {
  vpc_id = aws_vpc.deliberation.id
  cidr_block = "10.0.0.0/16"
}

resource "aws_efs_file_system" "efs" {
  creation_token = "efs"
}

resource "aws_efs_access_point" "efs" {
  file_system_id = aws_efs_file_system.efs.id
}

resource "aws_efs_mount_target" "mount_target" {
  file_system_id = aws_efs_file_system.efs.id
  subnet_id      = aws_subnet.deliberation.id
}

resource "aws_cloudwatch_log_group" "deliberation-empirica-log-group" {
  name = "/ecs/deliberation-empirica-logs"
}

resource "aws_cloudwatch_log_stream" "deliberation-empirica-log-stream" {
  name           = "deliberation-empirica-log-stream"
  log_group_name = aws_cloudwatch_log_group.deliberation-empirica-log-group.name

}

resource "aws_ecs_task_definition" "deliberation-empirica-app" {
  family = "deliberation-empirica-app"
  container_definitions = jsonencode([
    {
      name      = "deliberation-empirica-container",
      image     = "ghcr.io/watts-lab/deliberation-empirica:latest",
      cpu       = 10,
      memory    = 512,
      essential = true,
      portMappings = [
        {
          containerPort = 3000
          hostPort      = 80
        }
      ]
      mountPoints = [
        {
          sourceVolume  = "deliberation-data-volume"
          containerPath = "/data"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.deliberation-empirica-log-group.name,
          awslogs-region        = "us-east-1",
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  volume {
    name = "deliberation-data-volume"
    efs_volume_configuration {
      file_system_id     = aws_efs_file_system.efs.id
      transit_encryption = "ENABLED"
      authorization_config {
        access_point_id = aws_efs_access_point.efs.id
        iam             = "ENABLED"
      }
    }
  }


}

resource "aws_ecs_service" "deliberation-empirica-app" {
  name            = "deliberation-empirica-app"
  task_definition = aws_ecs_task_definition.deliberation-empirica-app.arn
  desired_count   = 1

  network_configuration {
    security_groups = [aws_security_group.deliberation.id]
    subnets         = [aws_subnet.deliberation.id]
  }

}

resource "aws_lb_target_group" "example" {
  name_prefix = "delib"
  port        = 80
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.deliberation.id
}