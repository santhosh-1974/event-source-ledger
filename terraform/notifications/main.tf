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

data "aws_iam_policy_document" "notification_worker" {
  statement {
    sid    = "ConsumeBankingEvents"
    effect = "Allow"
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
    ]
    resources = [var.queue_arn]
  }

  statement {
    sid       = "SendConsentApprovedEmail"
    effect    = "Allow"
    actions   = ["ses:SendEmail"]
    resources = [var.ses_identity_arn]
  }
}

resource "aws_iam_policy" "notification_worker" {
  name        = var.policy_name
  description = "Allows Notification Service to consume its queue and send through one SES identity"
  policy      = data.aws_iam_policy_document.notification_worker.json

  tags = var.tags
}
