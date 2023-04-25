
resource "aws_lb" "app_alb" {
  name                       = "${var.app_name}-alb"
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.app_alb_sg.id]
  subnets                    = [aws_subnet.public1.id, aws_subnet.public2.id]
  enable_deletion_protection = false
}
resource "aws_alb_target_group" "app_alb_target_group" {
  name        = "${var.app_name}-alb-target-group"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.project_vpc.id
  target_type = "ip"
  health_check {
    healthy_threshold   = "3"
    interval            = "30"
    protocol            = "HTTP"
    matcher             = "200"
    timeout             = "3"
    unhealthy_threshold = "2"
  }
}
resource "aws_alb_listener" "http" {
  load_balancer_arn = aws_lb.app_alb.id
  port              = 3000
  protocol          = "HTTPS"
  certificate_arn   = var.acm_certificate_arn
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  default_action {
    target_group_arn = aws_alb_target_group.app_alb_target_group.arn
    type             = "forward"
  }
}