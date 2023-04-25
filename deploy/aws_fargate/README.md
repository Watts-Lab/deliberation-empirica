## Terraform Project

The project requirement was:

> - Write a terraform configuration to deploy the container found at ghcr.io/watts-lab/deliberation-empirica:latest as a web app on AWS.
> - Only a single instance of the container is required
> - Expose port 3000 on the container to the web via a domain name registered with route53
> - The application connects over https and uses websockets
> - The application uses a file-based datastore, and so a file volume should be connected at path `/data`
> - The application logs debugging data to the console, we should be able to view these in cloudwatch
> - We set a number of environment variables on the container at deploy time
> - Simplicity is a strong priority, as this will be maintained by people without strong devops skills.

The provided files are part of an infrastructure-as-code (IaC) project written using Terraform. Terraform is a tool for building, changing, and versioning infrastructure safely and efficiently. The project is a web application, consisting of several AWS resources such as Elastic File System (EFS), Application Load Balancer (ALB), Elastic Container Service (ECS) - Fargate, CloudWatch logs, Security groups, Identity Access Management (IAM), AWS Certificate Manager (ACM) and Route 53.

## Terraform files

The repository has the following terraform files:

- backend.tf
- main.tf
- cloudwatch.tf
- ec2.tf
- iam.tf
- efs.tf
- ecs.tf
- route53.tf
- variables.tf
- terraform.tfvars
- output.tf

### backend.tf

This Terraform file configures the backend for the Terraform state, which is where Terraform stores the information about the infrastructure it creates. The file specifies that the Terraform state should be stored in an S3 bucket, in a DynamoDB table, in the "eu-west-1" region. The file also enables encryption of the state file. Keep into consideration that we cannot add env vars here, so this should be hardcoded.

#### S3 bucket

We need to create an S3 bucket to store the tfstate. This can be done (and mantained) with another terraform code and it's outside the scope of this task. This can also be manually created using AWS Console. The bucket name defined is: `watts-lab-tfstate` created in `eu-west-1` region.

#### DynamoDB Table

As a best practice it's recommended to maintain a DynamoDB table to keep consistency and maintain terraform locks. The DynamoDB table is defined as `watts-lab-tfstate-dynamo` and the index name has to be `LockID` and type `String`. Take into consideration that we can keep read and write units low as this probably is not gonna get exhaustive usage.

### main.tf

It defines the necessary resources and configurations for using the AWS provider in Terraform to manage infrastructure on the AWS platform.

The terraform block specifies the version of Terraform being used and the required provider(s) for this configuration.
The provider block configures the AWS provider with the specified region, which is passed as a variable `var.region`. It also sets default tags for all resources created by this Terraform configuration, including `project`, `repository-url`, and `environment`, which are all passed as variables as well (`var.project_name`, `var.terraform_repo_url`, and `var.environment`, respectively).

The main.tf file is typically one of the main configuration files in a Terraform project and includes provider configurations.

### cloudwatch.tf
This Terraform file creates a CloudWatch log group with the specified name and retention period.

### ec2.tf
This Terraform file creates three security groups and an application load balancer. The security groups are for the application load balancer, Fargate service, and Amazon EFS file system. The file also creates an application load balancer listener and target group.

The `aws_security_group` resource creates a security group for the application load balancer. The security group only allows incoming traffic on port `443` from the internet, which is the default port for `HTTPS` traffic. The security group also allows all outgoing traffic.

The `aws_security_group` resource creates a security group for the Fargate service. The security group only allows incoming traffic on the port specified in the `var.fargate_container_host_port` variable, which should be the same as the port exposed by the Fargate container (port 3000). The security group allows outgoing traffic to all destinations.

The `aws_security_group` resource creates a security group for the Amazon EFS file system. The security group only allows incoming traffic on port 2049 from the Fargate service security group.

The `aws_lb_target_group` resource creates an application load balancer target group, which is a group of resources that the load balancer distributes traffic to. The target group listens on the port specified in the `var.fargate_container_host_port` variable and uses `HTTPS` as the protocol. Note that to avoid race conditions as well as timeouts (we require a valid ACM) we already provide the valid ACM certificate from variables.

The `aws_lb resource` creates an application load balancer. The load balancer listens on port `443` and distributes traffic to the target group created by the `aws_lb_target_group` resource. The load balancer is created in the subnets specified in the `var.alb_subnets_id_list` variable and uses the security group created by the `aws_security_group` resource.

The `aws_lb_listener` resource creates a listener for the load balancer created by the `aws_lb resource`. The listener listens on port `443` and forwards traffic to the target group created by the `aws_lb_target_group` resource.

### route53.tf
The route53.tf file creates an AWS Route 53 zone and subdomain for the web application. It creates a CNAME record for the subdomain that points to the DNS name of the ALB.

The terraform.tfvars file contains variables that are used throughout the Terraform code to define the infrastructure. The variables include general settings like project name, environment, and region. Additionally, variables are defined for networking, ACM, EFS, load balancer, CloudWatch, and Fargate resources. These variables allow the Terraform code to be easily reused and customized for different environments and use cases.

In summary, the Terraform code in these files creates an AWS infrastructure for a web application, including an ALB, Fargate cluster, EFS, CloudWatch, Security groups, and Route 53 resources. The output.tf file contains output variables that are printed to the console after applying the Terraform code, and the terraform.tfvars file contains variables that are used throughout the Terraform code to define the infrastructure. The route53.tf file creates a DNS zone and subdomain for the application using AWS Route 53.

### iam.tf

The `iam.tf` file is used to define the Identity and Access Management (IAM) resources required for the project. IAM allows you to manage access to AWS services and resources securely. 

The first resource defined in this file is an `aws_iam_role` resource named `ecs_task_execution_role`. This role is created to allow Amazon Elastic Container Service (ECS) to launch and manage tasks on behalf of the project. The `assume_role_policy` attribute is used to specify the policy document that defines who can assume this role. In this case, it allows the ECS service to assume this role.

The second resource defined is an `aws_iam_role` resource named `task_role`. This is an empty role that will be assigned to the task definition. You can add and attach policies to this role if required.

The third resource defined is an `aws_iam_role_policy` resource named `fargate_execution_role_policy`. This resource defines a policy that is attached to the `ecs_task_execution_role` created earlier. This policy allows the role to perform certain actions, such as creating and putting logs in the Amazon CloudWatch Logs, and interacting with the Amazon Elastic Container Registry (ECR). 

The policy is specified using the `policy` attribute, which contains a JSON-encoded policy document that defines the permissions. This policy allows the role to perform actions on any resource for the specified actions. The `Resource` attribute in each `Statement` defines the resources to which the actions are applied.

Overall, the `iam.tf` file is used to create and manage the IAM roles and policies required for the ECS tasks to function properly.

### efs.tf

This Terraform code defines an Amazon Elastic File System (EFS) and a mount target for it in an Amazon Virtual Private Cloud (VPC).

The first block creates an EFS file system with the specified name using the `aws_efs_file_system` resource. The `creation_token` attribute uniquely identifies the EFS file system, while the `tags` attribute assigns a name tag to the EFS file system.

The second block creates a mount target for the EFS file system in a specified subnet using the `aws_efs_mount_target` resource. The `file_system_id` attribute specifies the ID of the EFS file system, while the `subnet_id` attribute specifies the ID of the subnet in which the mount target should be created. Finally, the `security_groups` attribute specifies the ID of the security group associated with the mount target.

By default, EFS file systems are encrypted using an Amazon-provided encryption key. In this case, the `encrypted` attribute of the `aws_efs_file_system` resource is set to `true`.

### ecs.tf

The `ecs.tf` file is a Terraform configuration file used to create an ECS cluster, task definition, and service. 

First, a local variable `volume_name` is defined for a volume used by the task. Then, an ECS cluster is created using the `aws_ecs_cluster` resource. 

Next, a task definition is created using the `aws_ecs_task_definition` resource. The task definition includes the Fargate container settings, environment variables, mount points, and logging configuration. It also includes a volume definition, which is an Amazon EFS volume that is mounted to the container file system. The `runtime_platform` block specifies the operating system and CPU architecture. 

Finally, an ECS service is created using the `aws_ecs_service` resource. The service includes the cluster and task definition IDs, desired number of tasks, and networking configuration. It also includes a load balancer target group and security groups.

Overall, this file creates an ECS cluster, task definition, and service with an EFS volume mounted to the container file system and a load balancer for traffic distribution.

### route53.tf

The `route53.tf` file defines resources for creating a Route 53 DNS zone and a CNAME record for a subdomain. The `aws_route53_zone` resource creates a new Route 53 DNS zone using the domain name specified in the `var.route53_main_domain` variable. The `aws_route53_record` resource creates a CNAME record for the `var.route53_app_domain` subdomain that points to the DNS name of an Application Load Balancer created in `ec2.tf` in the Terraform configuration.

### variables.tf

Defines the variables that can be used in the Terraform code. The current variables are the following:

| Name                             | Type                                            | Description                                                 |
|----------------------------------|-------------------------------------------------|-------------------------------------------------------------|
| project_name                     | string                                          | Project name                                                |
| environment                      | string                                          | Infrastructure environment                                  |
| region                           | string                                          | Infrastructure region                                       |
| terraform_repo_url               | string                                          | Git repository where this terraform code lives              |
| vpc_id                           | string                                          | VPC where all should be deployed                            |
| alb_subnets_id_list              | list(string)                                    | Subnet list for ALB service (public facing)                 |
| acm_certificate_arn              | string                                          | ACM Certificate ARN                                         |
| efs_subnet_id                    | string                                          | EFS subnet id                                               |
| tg_deregistration_delay          | number                                          | Deregistration delay                                        |
| tg_health_check_interval         | number                                          | ALB target group health check interval in seconds           |
| tg_health_check_path             | string                                          | ALB target group health check path                          |
| tg_health_check_timeout          | number                                          | ALB target group health check timeout in seconds            |
| tg_health_check_healthy_th       | number                                          | ALB target group health check healthy threshold (retries)   |
| tg_health_check_unhealthy_th     | number                                          | ALB target group health check unhealthy threshold (retries) |
| tg_health_check_http_code        | string                                          | ALB target group health check http code string              |
| log_retention_days               | number                                          | Number of days to retain logs                               |
| fargate_platform_version         | string                                          | Fargate platform version                                    |
| fargate_container_name           | string                                          | Fargate container name                                      |
| fargate_container_repository     | string                                          | Container repository URI                                    |
| fargate_cpu                      | number                                          | Fargate cpu resources                                       |
| fargate_memory                   | number                                          | Fargate memory resources                                    |
| fargate_env_vars                 | list(object({ name = string, value = string })) | List of fargate env vars in form of names and values        |
| fargate_container_host_port      | number                                          | Fargate container host port                                 |
| fargate_container_container_port | number                                          | Fargate container container port                            |
| fargate_volume_size_gb           | number                                          | Fargate volume size in GB                                   |
| fargate_container_mount_path     | string                                          | Container mount point container path                        |
| fargate_desired_count            | string                                          | Fargate number of containers                                |
| fargate_subnets_id_list          | list(string)                                    | Fargate subnets list                                        |
| fargate_public_ip                | bool                                            | Assign public ip to fargate tasks                           |
| route53_main_domain              | string                                          | Route 53 zone domain, e.g: example.com                      |
| route53_app_domain               | string                                          | Route 53 application domain                                 |

### terraform.tfvars

File that can be used to assign values to the variables defined in `variables.tf`. My terraform.tfvars values is provided.

### output.tf

The `output.tf` file contains output variables that are printed to the console after applying the Terraform code. These outputs can be used by other modules or scripts to reference the resources created by Terraform. The outputs include the ARN for IAM roles, ALB, Cloudwatch Logs, Fargate cluster, and Security groups.

The exported values are the following:

| Terraform Output Variable   | Description                          |
|-----------------------------|--------------------------------------|
| iam_task_execution_role_arn | IAM task execution role ARN          |
| iam_task_role_arn           | IAM task role ARN                    |
| efs_arn                     | EFS ARN                              |
| alb_arn                     | Application Load Balancer ARN        |
| alb_listener_arn            | ALB listener ARN                     |
| alb_target_group_arn        | ALB target group ARN                 |
| sg_alb_id                   | Security group of ALB                |
| sg_fargate_service_id       | Security group of Fargate service    |
| sg_efs_id                   | Security group of EFS                |
| cw_logs_arn                 | Cloudwatch Logs ARN                  |
| fargate_cluster_arn         | Fargate cluster ARN                  |
| fargate_taskdef_arn         | Fargate task definition ARN          |
| fargate_service_name        | Fargate service name                 |
| route53_domain              | Application domain name for Route 53 |

# Additional notes and best practices

- The image is not gonna work correctly because there is a script acting as an entryport and therefore, the signals from ecs daemon won't be catched from docker container! Anyway this is a general best-practice recommendation and it's outside this project scope.
- As a best-practice approach ACM should be created sepparately (with another terraform code or manually in the console. It deppends on the company-based approach). As this can involve more than one subdomain, e.g: `*.example.com`. As a result, we will need to provide the ACM arn certificate.
- As a best practice the terraform backend should be hosted somewhere to keep tfstate stored. As well as Dynamodb to keep lock state.
- This terraform code, takes into consideration that we make use of existing VPC and subnets. This is done like this because it's a bad practice to create networking shared resources within a single app. It also deppends on how is the company approach, e.g: ALB in public subnets, Fargate in private subnets using a NAT gateway or all subnets with direct internet gateway IG routing.