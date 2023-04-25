# Create route53 zone
resource "aws_route53_zone" "primary" {
  name = var.route53_main_domain
}

# Create route53 subdomain
resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = var.route53_app_domain
  type    = "CNAME"
  ttl     = 300
  records = [aws_lb.alb.dns_name]
}
