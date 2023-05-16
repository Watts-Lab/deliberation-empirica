resource "aws_ecs_task_definition" "task_definition" {
  family                   = var.app_name
  network_mode             = "awsvpc"
  task_role_arn            = aws_iam_role.app_ecs_task_role.arn
  execution_role_arn       = aws_iam_role.app_ecs_task_execution_role.arn
  requires_compatibilities = ["FARGATE"]
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
      "linuxParameters" : {
        "initProcessEnabled" : true
      }
      "environment" : [
        {
          name  = "QUALTRICS_DATACENTER",
          value = var.QUALTRICS_DATACENTER
        },
        {
          name  = "GH_DATA_REPO",
          value = var.GITHUB_DATA_REPO
        },
        {
          name  = "GH_BRANCH",
          value = var.GITHUB_BRANCH
        },
        {
          name  = "REACT_APP_TEST_CONTROLS",
          value = var.REACT_APP_TEST_CONTROLS
        },
        {
          name  = "DAILY_APIKEY",
          value = var.DAILY_APIKEY
        },
        {
          name  = "QUALTRICS_API_TOKEN",
          value = var.QUALTRICS_API_TOKEN
        },
        {
          name  = "GH_TOKEN",
          value = var.GITHUB_TOKEN
        },
        {
          name  = "EMPIRICA_ADMIN_PW",
          value = var.EMPIRICA_ADMIN_PW
        }
      ],

      mountPoints = [
        {
          containerPath = var.app_data_path,
          sourceVolume  = "${var.app_name}_data_volume",
          readOnly      = false
        }
      ],
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
  volume {
    name = "${var.app_name}_data_volume"

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