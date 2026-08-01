variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "aws_account_id" {
  description = "AWS account ID for Workload Identity Federation"
  type        = string
}

variable "db_password" {
  description = "Cloud SQL database password"
  type        = string
  sensitive   = true
}

variable "vector_search_dimensions" {
  description = "Embedding dimensions for Vector Search index"
  type        = number
  default     = 768
}
