output "notification_worker_policy_arn" {
  description = "Attach this least-privilege policy to the Notification Service workload role."
  value       = aws_iam_policy.notification_worker.arn
}
