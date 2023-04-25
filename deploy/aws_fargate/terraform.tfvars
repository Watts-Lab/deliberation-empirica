# General
project_name       = "deliberation-empirica"
environment        = "prod"
region             = "us-east-1"
terraform_repo_url = "https://github.com/watts-lab/deliberation-empirica"

# Networking
vpc_id              = "vpc-04f29ccea4a98f9e9"
alb_subnets_id_list = ["subnet-074f4d3cd81f1de79", "subnet-0c62f6a1f7b1b9bb2", "subnet-0c62f6a1f7b1b9bb2"]

# ACM
acm_certificate_arn = "arn:aws:acm:eu-west-1:<aws_account_id>:certificate/094011b6-bfa9-4e33-a9f1-6f0bc9ac0828"

# EFS
efs_subnet_id = "subnet-074f4d3cd81f1de79"

# Load balancer
tg_deregistration_delay      = 60
tg_health_check_interval     = 30
tg_health_check_path         = "/assets/index.10f06f83.css" # FIXME: Image doesn't have valid healthcheck, workaround to make it work
tg_health_check_timeout      = 5
tg_health_check_healthy_th   = 2
tg_health_check_unhealthy_th = 2
tg_health_check_http_code    = "200"

# Cloudwatch
log_retention_days = 30

# Fargate
fargate_platform_version         = "1.4.0"
fargate_container_name           = "container"
fargate_container_repository     = "ghcr.io/watts-lab/deliberation-empirica:latest"
fargate_cpu                      = 256
fargate_memory                   = 512
fargate_env_vars                 = [{ name = "varname1", value = "varvalue1" }]
fargate_container_host_port      = 3000
fargate_container_container_port = 3000
fargate_volume_size_gb           = 5
fargate_container_mount_path     = "/data"
fargate_desired_count            = 1
fargate_subnets_id_list          = ["subnet-074f4d3cd81f1de79", "subnet-0c62f6a1f7b1b9bb2", "subnet-0c62f6a1f7b1b9bb2"]
fargate_public_ip                = true

# Route 53
route53_main_domain = "deliberation-lab.org"
route53_app_domain  = "study.deliberation-lab.com"
