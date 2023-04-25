# project-specific variables
project_name          = "deliberation"
region                = "us-east-1"
ecs_definition_family = "deliberation"
ecs_security_group    = "deliberation-ecs-security-group"
subnet_cidr           = "10.0.0.0/24"
public_subnet1        = "10.0.10.0/24"
public_subnet2        = "10.0.20.0/24"
vpc_cidr              = "10.0.0.0/16"
acm_certificate_arn   = "arn:aws:acm:us-east-1:941654414269:certificate/e0e19345-4917-4e54-a87a-01ee32812046"

# app-specific variables
container_image_name = "ghcr.io/watts-lab/deliberation-empirica:latest"
app_name             = "delib-emp"
internet_cidr_blocks = ""



/* 
vpc-id = "vpc-049d4482ca2f8f85c"  # where is this coming from?
ecs-role = "deliberation-ecs-role"
ecs-task-role = "deliberation-ecs-task-role" 
alb_target_group = "alb-target-group"
alb_name = "deliberation-empirica-alb"
ecs_service_name = "deliberation-empirica"
*/