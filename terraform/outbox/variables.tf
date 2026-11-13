variable "aws_region" {
  description = "AWS region for the banking event queues."
  type        = string
}

variable "queue_name" {
  description = "Name of the standard banking events queue."
  type        = string

  validation {
    condition     = length(var.queue_name) <= 76 && can(regex("^[A-Za-z0-9_-]+$", var.queue_name))
    error_message = "queue_name must use only letters, numbers, hyphens, or underscores and leave room for the -dlq suffix."
  }
}

variable "queue_retention_seconds" {
  description = "Retention period for the banking events queue."
  type        = number
  default     = 345600

  validation {
    condition     = var.queue_retention_seconds >= 60 && var.queue_retention_seconds <= 1209600
    error_message = "Queue retention must be between 60 and 1209600 seconds."
  }
}

variable "dlq_retention_seconds" {
  description = "Retention period for messages in the dead-letter queue."
  type        = number
  default     = 1209600

  validation {
    condition     = var.dlq_retention_seconds >= 60 && var.dlq_retention_seconds <= 1209600
    error_message = "DLQ retention must be between 60 and 1209600 seconds."
  }
}

variable "visibility_timeout_seconds" {
  description = "Visibility timeout for messages consumed from the queue."
  type        = number
  default     = 300

  validation {
    condition     = var.visibility_timeout_seconds >= 0 && var.visibility_timeout_seconds <= 43200
    error_message = "Visibility timeout must be between 0 and 43200 seconds."
  }
}

variable "max_receive_count" {
  description = "Receive count before SQS moves a message to the DLQ."
  type        = number
  default     = 5

  validation {
    condition     = var.max_receive_count >= 1
    error_message = "max_receive_count must be at least 1."
  }
}

variable "tags" {
  description = "Tags applied to the queues and IAM policy."
  type        = map(string)
  default     = {}
}
