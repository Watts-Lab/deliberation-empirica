# Create cluster
locals {
  volume_name = "efs-volume-name"
}
resource "aws_ecs_cluster" "cluster" {
  name = "${var.project_name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# Create task definition + env vars
resource "aws_ecs_task_definition" "task_definition" {
  family                   = "${var.project_name}-task-def"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.fargate_cpu
  memory                   = var.fargate_memory
  task_role_arn            = aws_iam_role.task_role.arn
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn


  container_definitions = jsonencode([
    {
      name      = var.fargate_container_name,
      image     = var.fargate_container_repository,
      essential = true,
      portMappings = [
        {
          hostPort      = var.fargate_container_host_port,
          containerPort = var.fargate_container_container_port
        }
      ],
      environment = [
        for env_var in var.fargate_env_vars :
        {
          name  = env_var.name
          value = env_var.value
        }
      ],
      mountPoints = [
        {
          containerPath = var.fargate_container_mount_path,
          sourceVolume  = local.volume_name,
          readOnly      = false
        }
      ],

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-region        = var.region
          awslogs-group         = aws_cloudwatch_log_group.fargate_cw_log.name
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  # Volume definition
  volume {
    name = local.volume_name

    efs_volume_configuration {
      file_system_id = aws_efs_file_system.efs.id
      root_directory = "/"
    }
  }

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }
}

# Create service
resource "aws_ecs_service" "service" {
  name             = "${var.project_name}-service"
  cluster          = aws_ecs_cluster.cluster.id
  task_definition  = aws_ecs_task_definition.task_definition.arn
  desired_count    = var.fargate_desired_count
  launch_type      = "FARGATE"
  platform_version = var.fargate_platform_version

  # Enforce fargate task redeployment on each change
  force_new_deployment = true

  load_balancer {
    target_group_arn = aws_lb_target_group.tg.arn
    container_name   = var.fargate_container_name
    container_port   = var.fargate_container_container_port
  }

  network_configuration {
    subnets          = var.fargate_subnets_id_list
    security_groups  = [aws_security_group.fargate_service_sg.id]
    assign_public_ip = var.fargate_public_ip
  }
}
