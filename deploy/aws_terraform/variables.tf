
variable "region" {}
variable "app_name" {}
variable "project_name" {}
variable "internet_cidr_blocks" {}
variable "ecs_definition_family" {}
variable "ecs_security_group" {}
variable "subnet_cidr" {}
variable "public_subnets" {
  type        = list(string)
  description = "the CIDR blocks to create public subnets"
  default     = ["10.0.10.0/24", "10.0.20.0/24"]
}
variable "public_subnet1" {}
variable "public_subnet2" {}
variable "vpc_cidr" {}
variable "container_image_name" {}
variable acm_certificate_arn {}


/* variable "alb-target-group" {} */
/* variable "ecs_service_name" {} */
/* variable "alb-name" {} */
/* variable "ecs-role" {}
variable "ecs-task-role" {} */
/* variable "vpc-id" {} */