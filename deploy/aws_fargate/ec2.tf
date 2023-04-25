# Application load balancer security group
resource "aws_security_group" "alb_sg" {
  # Create ALB security group 
  name        = "${var.project_name}-alb-sg"
  description = "${var.project_name} ALB security group"
  vpc_id      = var.vpc_id

  ingress {
    description = "Allow only access from ALB"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # ALB is public facing. Change me otherwise
  }

  # Pretty common approach to ease things. Only ingress rules added
  egress {
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }
}

# Create Fargate service security group 
resource "aws_security_group" "fargate_service_sg" {
  name        = "${var.project_name}-fargate-sg"
  description = "${var.project_name} fargate service security group"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Allow only access from ALB"
    from_port       = var.fargate_container_host_port
    to_port         = var.fargate_container_host_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  # Pretty common approach to ease things. Only ingress rules added
  egress {
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }
}

# EFS security group
resource "aws_security_group" "efs_sg" {
  # Create ALB security group 
  name        = "${var.project_name}-efs-sg"
  description = "${var.project_name} EFS security group"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Allow only from fargate service"
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = [aws_security_group.fargate_service_sg.id]
  }

  # Pretty common approach to ease things. Only ingress rules added
  egress {
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }
}

# Create ALB target group
resource "aws_lb_target_group" "tg" {
  name                 = "${var.project_name}-tg"
  port                 = var.fargate_container_host_port
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = var.vpc_id
  deregistration_delay = var.tg_deregistration_delay

  health_check {
    enabled             = true
    interval            = var.tg_health_check_interval
    path                = var.tg_health_check_path
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = var.tg_health_check_timeout
    healthy_threshold   = var.tg_health_check_healthy_th
    unhealthy_threshold = var.tg_health_check_unhealthy_th
    matcher             = var.tg_health_check_http_code
  }
}

# Application load balancer creation
resource "aws_lb" "alb" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = var.alb_subnets_id_list

  # Enable delete protection as AWS best practice
  enable_deletion_protection = true
}

# Create ALB listener
resource "aws_lb_listener" "alb_listener" {
  load_balancer_arn = aws_lb.alb.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tg.arn
  }
}
