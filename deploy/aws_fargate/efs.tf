locals {
  efs_name = "${var.project_name}-efs"
}
# Define the EFS file system
resource "aws_efs_file_system" "efs" {
  creation_token = local.efs_name
  tags = {
    Name = local.efs_name
  }
  encrypted = true
}

# Define the EFS mount target (must be in at least one availability zone)
resource "aws_efs_mount_target" "efs_mount_target" {
  file_system_id  = aws_efs_file_system.efs.id
  subnet_id       = var.efs_subnet_id
  security_groups = [aws_security_group.efs_sg.id]
}
