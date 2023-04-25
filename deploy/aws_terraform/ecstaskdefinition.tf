resource "aws_ecs_task_definition" "task_definition" {
  family = var.ecs_definition_family
  # execution_role_arn = "arn:aws:iam::108938047369:role/ecsTaskExecutionRole"
  # execution_role_arn  = "${data.aws_iam_role.example.arn}"
  execution_role_arn       = aws_iam_role.app_ecs_task_execution_role.arn
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  memory                   = 1024
  cpu                      = 512
  container_definitions = jsonencode([
    {
      "name" : var.app_name,
      "image" : var.container_image_name,
      "cpu" : 0,
      "portMappings" : [
        {
          "name" : "${var.app_name}_tcp_3000",
          "containerPort" : 3000,
          "hostPort" : 3000,
          "protocol" : "tcp",
          "appProtocol" : "http"
        }
      ],
      "essential" : true,
      "environment" : [],
      "environmentFiles" : [],
      "mountPoints" : [],
      "volumesFrom" : [],
      "logConfiguration" : {
        "logDriver" : "awslogs",
        "options" : {
          "awslogs-create-group" : "true",
          "awslogs-group" : var.app_name,
          "awslogs-region" : var.region,
          "awslogs-stream-prefix" : "ecs"
        }
      }
    }
  ])
  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }
}