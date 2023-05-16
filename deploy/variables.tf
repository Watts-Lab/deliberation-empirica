
# project-specific variables
variable "project_name" {}
variable "region" {}
variable "subnet_cidr" {}
variable "public_subnet1" {}
variable "public_subnet2" {}
variable "acm_certificate_arn" {}

# app-specific variables
variable "app_name" {}
variable "container_image_name" {}

# app environment variables
#  set in deploy/aws_terraform/terraform.tfvars
variable "QUALTRICS_DATACENTER" {}
variable "GITHUB_DATA_REPO" {}
variable "GITHUB_BRANCH" {}
variable "REACT_APP_TEST_CONTROLS" {}
variable "app_data_path" {
  type        = string
  description = "Path to app data"
  default     = "/data"
}

# taken from TF_VAR_* environment variables or set on TF cloud
variable "DAILY_APIKEY" {
  sensitive = true
}
variable "QUALTRICS_API_TOKEN" {
  sensitive = true
}
variable "GITHUB_TOKEN" {
  sensitive = true
}

variable "EMPIRICA_ADMIN_PW" {
  sensitive = true
}
