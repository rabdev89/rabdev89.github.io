interface Input {
  workspaceId: string;
  documentId: string;
  s3Key: string;
  bucketName: string;
}

export async function handler(event: Input) {
  console.log("Calling GCP Document AI", event);

  // TODO: use Workload Identity Federation to get GCP credentials
  // TODO: download file from S3, send to Document AI Layout Processor
  // TODO: parse Document AI response into structured pages/sections

  return {
    ...event,
    docAiOutputUri: `gs://documind-docai-output/${event.documentId}/output.json`,
    pages: [],
  };
}
