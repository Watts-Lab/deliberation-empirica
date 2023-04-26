variable "project_name" {}
variable "region" {}
variable "subnet_cidr" {}
variable "public_subnet1" {}
variable "public_subnet2" {}
variable "acm_certificate_arn" {}

variable "app_name" {}
variable "container_image_name" {}
variable "app_data_path" {
  type        = string
  description = "Path to app data"
  default     = "/data"
}

variable "app_secrets" {
  type = list(object({
    name  = string
    value = string
  }))
  description = "List of app env vars in form of names and values"
  sensitive = true
}



/* variable "alb-target-group" {} */
/* variable "ecs_service_name" {} */
/* variable "alb-name" {} */
/* variable "ecs-role" {}
variable "ecs-task-role" {} */
/* variable "vpc-id" {} */

/* variable "public_subnets" {
  type        = list(string)
  description = "the CIDR blocks to create public subnets"
  default     = ["10.0.10.0/24", "10.0.20.0/24"]
} */

/* variable "vpc_cidr" {} */
/* variable "ecs_security_group" {} */
/* variable "internet_cidr_blocks" {} */