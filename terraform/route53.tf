data "aws_route53_zone" "selected" {
  name = "deliberation-lab.org"
}

/* resource "aws_route53_record" "study" {
  zone_id = data.aws_route53_zone.selected.zone_id
  name    = "study"
  type    = "A"
  ttl     = 300
  records = [aws_lb.app_alb.dns_name]
} */

resource "aws_route53_record" "study" {
  zone_id = data.aws_route53_zone.selected.zone_id
  name    = "study"
  type    = "A"
  alias {
    name                   = aws_lb.app_alb.dns_name
    zone_id                = aws_lb.app_alb.zone_id
    evaluate_target_health = true
  }
}