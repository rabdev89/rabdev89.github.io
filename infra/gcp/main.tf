terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  backend "gcs" {
    # Configure: bucket = "documind-tf-state-<project_id>"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# --- APIs ---
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "aiplatform.googleapis.com",
    "documentai.googleapis.com",
    "iam.googleapis.com",
    "secretmanager.googleapis.com",
    "sts.googleapis.com",
    "iamcredentials.googleapis.com",
  ])
  service            = each.value
  disable_on_destroy = false
}

# --- Cloud SQL (PostgreSQL) ---
resource "google_sql_database_instance" "main" {
  name             = "documind-db"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier              = "db-f1-micro"
    availability_type = "ZONAL"

    ip_configuration {
      ipv4_enabled = true
      authorized_networks {
        name  = "all"
        value = "0.0.0.0/0"
      }
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }
  }

  deletion_protection = false

  depends_on = [google_project_service.apis]
}

resource "google_sql_database" "documind" {
  name     = "documind"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "documind" {
  name     = "documind"
  instance = google_sql_database_instance.main.name
  password = var.db_password
}

# --- Service Account for Cloud Run agent service ---
resource "google_service_account" "agent_svc" {
  account_id   = "documind-agent-svc"
  display_name = "DocuMind Agent Service"
}

resource "google_project_iam_member" "agent_vertex" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.agent_svc.email}"
}

resource "google_project_iam_member" "agent_sql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.agent_svc.email}"
}

# --- Cloud Run (agent service) ---
resource "google_cloud_run_v2_service" "agent" {
  name     = "documind-agents"
  location = var.region

  template {
    service_account = google_service_account.agent_svc.email

    containers {
      image = "gcr.io/${var.project_id}/documind-agents:latest"

      ports {
        container_port = 8001
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GCP_REGION"
        value = var.region
      }
      env {
        name  = "DATABASE_URL"
        value = "postgresql://documind:${var.db_password}@/${google_sql_database.documind.name}?host=/cloudsql/${google_sql_database_instance.main.connection_name}"
      }

      resources {
        limits = {
          cpu    = "2"
          memory = "1Gi"
        }
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }
  }

  depends_on = [google_project_service.apis]
}

resource "google_cloud_run_v2_service_iam_member" "agent_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.agent.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# --- Vertex AI Vector Search ---
resource "google_vertex_ai_index" "documents" {
  display_name = "documind-documents"
  region       = var.region

  metadata {
    contents_delta_uri = "gs://documind-vector-data-${var.project_id}/index"

    config {
      dimensions                  = var.vector_search_dimensions
      approximate_neighbors_count = 50
      shard_size                  = "SHARD_SIZE_SMALL"

      algorithm_config {
        tree_ah_config {
          leaf_node_embedding_count    = 1000
          leaf_nodes_to_search_percent = 10
        }
      }
    }
  }

  index_update_method = "STREAM_UPDATE"

  depends_on = [google_project_service.apis]
}

resource "google_vertex_ai_index_endpoint" "documents" {
  display_name = "documind-documents-endpoint"
  region       = var.region
  network      = ""

  depends_on = [google_project_service.apis]
}

# --- Document AI Processor ---
resource "google_document_ai_processor" "layout" {
  location     = var.region
  display_name = "documind-layout"
  type         = "LAYOUT_PARSER_PROCESSOR"

  depends_on = [google_project_service.apis]
}

# --- Workload Identity Federation (AWS -> GCP) ---
resource "google_iam_workload_identity_pool" "aws" {
  workload_identity_pool_id = "documind-aws-pool"
  display_name              = "DocuMind AWS Pool"
}

resource "google_iam_workload_identity_pool_provider" "aws" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.aws.workload_identity_pool_id
  workload_identity_pool_provider_id = "documind-aws-provider"
  display_name                       = "AWS Provider"

  aws {
    account_id = var.aws_account_id
  }

  attribute_mapping = {
    "google.subject"        = "assertion.arn"
    "attribute.aws_role"    = "assertion.arn.extract('/assumed-role/{role}/')"
    "attribute.account"     = "assertion.account"
  }
}

resource "google_service_account" "aws_ingestion" {
  account_id   = "documind-aws-ingestion"
  display_name = "DocuMind AWS Ingestion (WIF)"
}

resource "google_project_iam_member" "aws_docai" {
  project = var.project_id
  role    = "roles/documentai.apiUser"
  member  = "serviceAccount:${google_service_account.aws_ingestion.email}"
}

resource "google_project_iam_member" "aws_vertex" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.aws_ingestion.email}"
}

resource "google_service_account_iam_member" "aws_wif_binding" {
  service_account_id = google_service_account.aws_ingestion.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.aws.name}/attribute.account/${var.aws_account_id}"
}

# --- Outputs ---
output "cloud_run_url" {
  value = google_cloud_run_v2_service.agent.uri
}

output "cloud_sql_connection_name" {
  value = google_sql_database_instance.main.connection_name
}

output "vector_search_index_id" {
  value = google_vertex_ai_index.documents.name
}

output "vector_search_endpoint_id" {
  value = google_vertex_ai_index_endpoint.documents.name
}

output "document_ai_processor_id" {
  value = google_document_ai_processor.layout.name
}

output "wif_pool_provider" {
  value = google_iam_workload_identity_pool_provider.aws.name
}
