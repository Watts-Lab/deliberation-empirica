
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 3.27"
    }
  }
  required_version = ">= 0.14.8"

  cloud {
    organization = "css-lab-deliberation"
    workspaces {
      name = "deliberation-empirica"
    }
  }
}


provider "aws" {
  region  = var.region
  profile = "aws-csslab-deliberation-seas-acct-PennAccountAdministrator"
  default_tags {
    tags = {
      project  = "deliberation"
      app      = "deliberation-empirica"
      deployBy = "terraform"
    }
  }
}
