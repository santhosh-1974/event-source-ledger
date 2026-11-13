terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0, < 7.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "aws_sqs_queue" "dead_letter" {
  name                      = "${var.queue_name}-dlq"
  message_retention_seconds = var.dlq_retention_seconds
  sqs_managed_sse_enabled   = true

  tags = var.tags
}

resource "aws_sqs_queue" "banking_events" {
  name                       = var.queue_name
  visibility_timeout_seconds = var.visibility_timeout_seconds
  message_retention_seconds  = var.queue_retention_seconds
  sqs_managed_sse_enabled    = true
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dead_letter.arn
    maxReceiveCount     = var.max_receive_count
  })

  lifecycle {
    precondition {
      condition     = var.dlq_retention_seconds > var.queue_retention_seconds
      error_message = "DLQ retention must be longer than source queue retention."
    }
  }

  tags = var.tags
}

resource "aws_sqs_queue_redrive_allow_policy" "dead_letter" {
  queue_url = aws_sqs_queue.dead_letter.id
  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.banking_events.arn]
  })
}

data "aws_iam_policy_document" "publisher" {
  statement {
    sid       = "PublishBankingEvents"
    effect    = "Allow"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.banking_events.arn]
  }
}

resource "aws_iam_policy" "publisher" {
  name        = "${var.queue_name}-publisher"
  description = "Allows the Banking outbox publisher to send events to its queue"
  policy      = data.aws_iam_policy_document.publisher.json

  tags = var.tags
}
