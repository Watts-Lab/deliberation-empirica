# It's important to store tfstate safely in some place
# e.g: a s3 bucket in AWS. 
# Remember to enable versioning!
terraform {
  backend "s3" {
    bucket         = "watts-lab-tfstate"                   # CHANGEME
    key            = "watts-lab/fargate-terraform.tfstate" # CHANGEME
    region         = "eu-west-1"                           # CHANGEME
    dynamodb_table = "watts-lab-tfstate-dynamo"            # CHANGEME
    encrypt        = true
  }
}
