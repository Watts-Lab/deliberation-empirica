/*
This config should spool up an ECS service with a task definition that mounts an EFS volume.
It should save container logs to CloudWatch.
*/



provider "aws" {
  region  = "us-east-1"
  profile = "aws-csslab-deliberation-seas-acct-PennAccountAdministrator"
}

# may be able to use default security group from the VPC instead of this
resource "aws_security_group" "deliberation" {
  name_prefix = "deliberation"
  vpc_id      = aws_vpc.deliberation.id
}

resource "aws_vpc" "deliberation" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "deliberation-subnet-1" {
  vpc_id            = aws_vpc.deliberation.id
  cidr_block        = "10.0.0.0/24"
  availability_zone = "us-east-1a"
}

resource "aws_subnet" "deliberation-subnet-2" {
  vpc_id            = aws_vpc.deliberation.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "us-east-1b"
}

resource "aws_efs_file_system" "efs" {
  creation_token = "efs"
}

resource "aws_efs_access_point" "efs" {
  file_system_id = aws_efs_file_system.efs.id
}

resource "aws_efs_mount_target" "mount_target" {
  file_system_id  = aws_efs_file_system.efs.id
  subnet_id       = aws_subnet.deliberation-subnet-1.id
  security_groups = [aws_security_group.deliberation.id]
}

resource "aws_cloudwatch_log_group" "deliberation-empirica-log-group" {
  name = "deliberation-empirica-logs"
  tags = {
    "deploy" = "terraform"
  }
}

resource "aws_cloudwatch_log_stream" "deliberation-empirica-log-stream" {
  name           = "deliberation-empirica-log-stream"
  log_group_name = aws_cloudwatch_log_group.deliberation-empirica-log-group.name
}

resource "aws_iam_role" "deliberation_empirica_task_role" {
  name = "deliberation_empirica_task_role"
  assume_role_policy = jsonencode({ # needs additional policy line for cloudwatch create log group 
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
  tags = {
    Name = "deliberation_empirica_task_role"
  }
}

resource "aws_iam_role_policy_attachment" "deliberation_empirica_task_role_attachment" {
  role       = aws_iam_role.deliberation_empirica_task_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_ecs_task_definition" "deliberation-empirica-app-task" {
  family                   = "deliberation-empirica-app"
  task_role_arn            = aws_iam_role.deliberation_empirica_task_role.arn
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = aws_iam_role.deliberation_empirica_task_role.arn
  cpu                      = 256
  memory                   = 512
  container_definitions = jsonencode([
    {
      name      = "deliberation-empirica-container",
      image     = "ghcr.io/watts-lab/deliberation-empirica:latest",
      cpu       = 256,
      memory    = 512,
      essential = true,
      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
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

resource "aws_ecs_cluster" "deliberation-cluster" {
  name = "deliberation-cluster"
}


resource "aws_ecs_service" "deliberation-empirica-app" {
  name            = "deliberation-empirica-app"
  task_definition = aws_ecs_task_definition.deliberation-empirica-app-task.arn
  desired_count   = 1
  cluster         = aws_ecs_cluster.deliberation-cluster.id
  launch_type     = "FARGATE"

  network_configuration {

    security_groups = [aws_security_group.deliberation.id]
    subnets         = [aws_subnet.deliberation-subnet-1.id, aws_subnet.deliberation-subnet-2.id]
  }

}

resource "aws_lb" "deliberation-lb" { # lets you connect to the task, even if you only have one task
  name               = "deliberation-empirica-lb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.deliberation.id]
  subnets            = [aws_subnet.deliberation-subnet-1.id, aws_subnet.deliberation-subnet-2.id]
}


resource "aws_lb_listener" "deliberation-lb-listener" {
  load_balancer_arn = aws_lb.deliberation-lb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.deliberation-lb-target-group.arn
  }
}

resource "aws_lb_target_group" "deliberation-lb-target-group" {
  name_prefix = "delib"
  port        = 3000
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.deliberation.id

  health_check {
    path                = "/"
    interval            = 180
    timeout             = 120
    healthy_threshold   = 2
    unhealthy_threshold = 10
    matcher             = "200-399"
  }
  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400
  }
}

resource "aws_lb_listener_rule" "deliberation-lb-listener-rule-websocket" {
  listener_arn = aws_lb_listener.deliberation-lb-listener.arn

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.deliberation-lb-target-group.arn
  }

  condition {
    http_header {
      http_header_name = "Upgrade"
      values           = ["websocket"]
    }
  }
}

resource "aws_internet_gateway" "deliberation-empirica-igw" {
  vpc_id = aws_vpc.deliberation.id
}

resource "aws_route_table" "deliberation-empirica-route-table" {
  vpc_id = aws_vpc.deliberation.id
}
