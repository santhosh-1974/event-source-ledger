variable "aws_region" {
  description = "AWS region containing the SQS queue and SES identity."
  type        = string
}

variable "queue_arn" {
  description = "ARN of the standard banking events queue, not its DLQ."
  type        = string
}

variable "ses_identity_arn" {
  description = "ARN of the verified SES sender identity."
  type        = string
}

variable "policy_name" {
  description = "Name of the Notification Service workload IAM policy."
  type        = string
  default     = "notification-service-worker"
}

variable "tags" {
  description = "Tags applied to the IAM policy."
  type        = map(string)
  default     = {}
}
