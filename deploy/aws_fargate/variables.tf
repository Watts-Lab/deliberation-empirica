# General
variable "project_name" {
  type        = string
  description = "Project name"
}

variable "environment" {
  type        = string
  description = "Infrastructure environment"
}

variable "region" {
  type        = string
  description = "Infrastructure region"
}

variable "terraform_repo_url" {
  type        = string
  description = "Git repository where this terraform code lives"
}

# Networking
variable "vpc_id" {
  type        = string
  description = "VPC where all should be deployed"
}

variable "alb_subnets_id_list" {
  type        = list(string)
  description = "Subnet list for ALB service (public facing)"
}

# ACM
variable "acm_certificate_arn" {
  type        = string
  description = "ACM Certificate ARN"
}

# EFS
variable "efs_subnet_id" {
  type        = string
  description = "EFS subnet id"
}

# Load balancer
variable "tg_deregistration_delay" {
  type        = number
  description = "Deregistration delay"
}
variable "tg_health_check_interval" {
  type        = number
  description = "ALB target group health check interval in seconds"
}

variable "tg_health_check_path" {
  type        = string
  description = "ALB target group health check path"
}

variable "tg_health_check_timeout" {
  type        = number
  description = "ALB target group health check timeout in seconds"
}

variable "tg_health_check_healthy_th" {
  type        = number
  description = "ALB target group health check healthy threshold (retries)"
}

variable "tg_health_check_unhealthy_th" {
  type        = number
  description = "ALB target group health check unhealthy threshold (retries)"
}

variable "tg_health_check_http_code" {
  type        = string
  description = "ALB target group health check http code string"
}

# Cloudwatch
variable "log_retention_days" {
  type        = number
  description = "Number of days to retain logs"
}

# Fargate
variable "fargate_platform_version" {
  type        = string
  description = "Fargate platform version"
}
variable "fargate_container_name" {
  type        = string
  description = "Fargate container name"
}

variable "fargate_container_repository" {
  type        = string
  description = "Container repository URI"
}

variable "fargate_cpu" {
  type        = number
  description = "Fargate cpu resources"
}

variable "fargate_memory" {
  type        = number
  description = "Fargate memory resources"
}
variable "fargate_env_vars" {
  type = list(object({
    name  = string
    value = string
  }))
  description = "List of fargate env vars in form of names and values"
}

variable "fargate_container_host_port" {
  type        = number
  description = "Fargate container host port"
  default     = 3000
}

variable "fargate_container_container_port" {
  type        = number
  description = "Fargate container container port"
  default     = 3000
}

variable "fargate_volume_size_gb" {
  type        = number
  description = "Fargate volume size in GB"
}

variable "fargate_container_mount_path" {
  type        = string
  description = "Container mount point container path"
}

variable "fargate_desired_count" {
  type        = string
  description = "Fargate number of containers"
}

variable "fargate_subnets_id_list" {
  type        = list(string)
  description = "Fargate subnets list"
}

variable "fargate_public_ip" {
  type        = bool
  description = "Assing public ip to fargate tasks"
}

# Route 53
variable "route53_main_domain" {
  type        = string
  description = "Route 53 zone domain, e.g: example.com"
}

variable "route53_app_domain" {
  type        = string
  description = "Route 53 application domain"
}
