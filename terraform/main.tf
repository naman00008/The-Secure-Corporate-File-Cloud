terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# VPC and Networking
resource "aws_vpc" "corp_vault_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = { Name = "CorpVault-VPC" }
}

resource "aws_subnet" "public_subnet" {
  vpc_id                  = aws_vpc.corp_vault_vpc.id
  cidr_block              = "10.0.1.0/24"
  map_public_ip_on_launch = true
  availability_zone       = "us-east-1a"
  tags = { Name = "VM1-Gateway-Subnet" }
}

resource "aws_subnet" "private_subnet_app" {
  vpc_id            = aws_vpc.corp_vault_vpc.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "us-east-1b"
  tags = { Name = "VM2-Processor-Subnet" }
}

resource "aws_subnet" "private_subnet_db" {
  vpc_id            = aws_vpc.corp_vault_vpc.id
  cidr_block        = "10.0.3.0/24"
  availability_zone = "us-east-1c"
  tags = { Name = "VM3-Vault-Subnet" }
}

# Internet Gateway for VM 1
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.corp_vault_vpc.id
}

resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.corp_vault_vpc.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
}

resource "aws_route_table_association" "public_rta" {
  subnet_id      = aws_subnet.public_subnet.id
  route_table_id = aws_route_table.public_rt.id
}

# Security Groups
resource "aws_security_group" "sg_vm1" {
  name        = "VM1-SG"
  description = "Allow HTTP for Gateway"
  vpc_id      = aws_vpc.corp_vault_vpc.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "sg_vm2" {
  name        = "VM2-SG"
  description = "Allow Node API from VM1"
  vpc_id      = aws_vpc.corp_vault_vpc.id

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.sg_vm1.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "sg_vm3" {
  name        = "VM3-SG"
  description = "Allow API from VM2 only"
  vpc_id      = aws_vpc.corp_vault_vpc.id

  ingress {
    from_port       = 4000
    to_port         = 4000
    protocol        = "tcp"
    security_groups = [aws_security_group.sg_vm2.id]
  }
}

# EC2 Instances
resource "aws_instance" "vm1_gateway" {
  ami           = "ami-0c7217cdde317cfec" # Ubuntu 22.04 LTS
  instance_type = "t2.micro"
  subnet_id     = aws_subnet.public_subnet.id
  vpc_security_group_ids = [aws_security_group.sg_vm1.id]
  
  user_data = <<-EOF
              #!/bin/bash
              apt-get update
              apt-get install -y docker.io
              # Fetch docker image from registry (mock step)
              docker run -d -p 80:80 vm1-gateway:latest
              EOF
  tags = { Name = "VM1-Gateway" }
}

resource "aws_instance" "vm2_processor" {
  ami           = "ami-0c7217cdde317cfec"
  instance_type = "t2.micro"
  subnet_id     = aws_subnet.private_subnet_app.id
  vpc_security_group_ids = [aws_security_group.sg_vm2.id]
  tags = { Name = "VM2-Processor" }
}

resource "aws_instance" "vm3_vault" {
  ami           = "ami-0c7217cdde317cfec"
  instance_type = "t2.micro"
  subnet_id     = aws_subnet.private_subnet_db.id
  vpc_security_group_ids = [aws_security_group.sg_vm3.id]
  tags = { Name = "VM3-Vault" }
}
