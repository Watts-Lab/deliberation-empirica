terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "4.64.0"
    }
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      project        = var.project_name
      repository-url = var.terraform_repo_url
      environment    = var.environment
    }
  }
}
