# Github Actions

# Authorization
In order to authenticate to AWS, we use the `aws-actions/configure-aws-credentials@v1` action supplied by aws on the github actions marketplace. It expects us to assume a "role" with a set of permissions from AWS, and authenticates using OIDC. This means that we don't have to store AWS secrets or keys in the repo - the role will only be authenticated when connections come from this repo, as authenticated by github.

On the AWS console, I created a role called `deliberation-github-deploy`. This role has permissions:

- ElasticLoadBalancingFullAccess
- AWSElasticBeanstalkWebTier
- AWSElasticBeanstalkManagedUpdatesCustomerRolePolicy

There is also a custom inline policy:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "elasticbeanstalk:Check*",
                "autoscaling:Describe*",
                "ec2:AuthorizeSecurityGroupIngress",
                "cloudwatch:DeleteAlarms",
                "s3:Get*",
                "elasticbeanstalk:ValidateConfigurationSettings",
                "elasticbeanstalk:CreateApplicationVersion",
                "cloudwatch:Describe*",
                "s3:List*",
                "elasticbeanstalk:RequestEnvironmentInfo",
                "elasticbeanstalk:UpdateApplicationVersion",
                "rds:Describe*",
                "sns:Get*",
                "autoscaling:UpdateAutoScalingGroup",
                "cloudformation:Estimate*",
                "cloudformation:UpdateStack",
                "elasticloadbalancing:Describe*",
                "cloudwatch:Get*",
                "cloudformation:List*",
                "s3:DeleteObject",
                "elasticloadbalancing:RegisterInstancesWithLoadBalancer",
                "s3:PutObjectAcl",
                "autoscaling:ResumeProcesses",
                "ec2:CreateTags",
                "cloudwatch:List*",
                "autoscaling:SuspendProcesses",
                "elasticbeanstalk:Describe*",
                "elasticbeanstalk:CreateStorageLocation",
                "elasticbeanstalk:CreateConfigurationTemplate",
                "sqs:Get*",
                "elasticbeanstalk:UpdateConfigurationTemplate",
                "sns:List*",
                "sqs:List*",
                "cloudformation:Describe*",
                "ec2:RevokeSecurityGroupIngress",
                "s3:PutObject",
                "ec2:Describe*",
                "cloudformation:Validate*",
                "elasticbeanstalk:List*",
                "elasticbeanstalk:UpdateEnvironment",
                "elasticbeanstalk:RetrieveEnvironmentInfo",
                "cloudformation:Get*"
            ],
            "Resource": "*"
        }
    ]
}

```
This may be more permissions than we actually need, but I don't know enough about AWS security policies to figure out which ones.

The role also has the following security profile:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Federated": "arn:aws:iam::088838630371:oidc-provider/token.actions.githubusercontent.com"
            },
            "Action": "sts:AssumeRoleWithWebIdentity",
            "Condition": {
                "StringEquals": {
                    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
                },
                "StringLike": {
                    "token.actions.githubusercontent.com:sub": "repo:Watts-Lab/deliberation-empirica:*"
                }
            }
        }
    ]
}

```

The role is also tagged: "project:deliberation".


# Set up environment
The `create_env.yml` file defines a GH action "Create EB environment". This action sets up an environment in the "deliberation" project, calling it "empirica". This takes a while to run, and doesn't check that the command it sent to AWS succeedeed, only that the command was properly submitted. 

# Deploy
The `deploy.yml` file defines a GH action called "Deploy AWS Production". This action will build and package the code and launch the app on AWS. It needs some work.

# Teardown
The 'teardownn.yml' file defines a GH action called "Tear down AWS Production", which terminates the "empirica" environment. It doesn't check that the teardown succeeded, only that the command was submitted
properly.
