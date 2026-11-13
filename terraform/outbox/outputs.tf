output "queue_url" {
  description = "URL configured as OUTBOX_SQS_QUEUE_URL for the Banking service."
  value       = aws_sqs_queue.banking_events.url
}

output "queue_arn" {
  description = "ARN of the standard banking events queue."
  value       = aws_sqs_queue.banking_events.arn
}

output "dead_letter_queue_arn" {
  description = "ARN of the banking events dead-letter queue."
  value       = aws_sqs_queue.dead_letter.arn
}

output "publisher_policy_arn" {
  description = "Least-privilege policy to attach to the Banking workload role."
  value       = aws_iam_policy.publisher.arn
}
