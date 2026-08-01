import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import * as path from "path";

export class IngestionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- Parameters ---
    const gcpProjectId = new cdk.CfnParameter(this, "GcpProjectId", {
      type: "String",
      description: "GCP project ID for Document AI and Vertex AI",
    });

    const gcpProjectNumber = new cdk.CfnParameter(this, "GcpProjectNumber", {
      type: "String",
      description: "GCP project number (numeric) for WIF",
    });

    const gcpRegion = new cdk.CfnParameter(this, "GcpRegion", {
      type: "String",
      default: "us-central1",
    });

    const gcpServiceAccountEmail = new cdk.CfnParameter(this, "GcpServiceAccountEmail", {
      type: "String",
      description: "GCP service account email for WIF (documind-aws-ingestion@...)",
    });

    const documentAiProcessorId = new cdk.CfnParameter(this, "DocumentAiProcessorId", {
      type: "String",
      description: "Document AI processor ID",
    });

    const vectorSearchIndexEndpoint = new cdk.CfnParameter(this, "VectorSearchIndexEndpoint", {
      type: "String",
      description: "Vertex Vector Search index endpoint resource name",
    });

    const vectorSearchIndexId = new cdk.CfnParameter(this, "VectorSearchIndexId", {
      type: "String",
      description: "Vertex Vector Search deployed index ID",
    });

    const databaseUrl = new cdk.CfnParameter(this, "DatabaseUrl", {
      type: "String",
      description: "PostgreSQL connection string for Cloud SQL",
      noEcho: true,
    });

    // --- S3 bucket ---
    const uploadBucket = new s3.Bucket(this, "UploadBucket", {
      bucketName: `documind-uploads-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedHeaders: ["*"],
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: ["*"],
          maxAge: 3600,
        },
      ],
      eventBridgeEnabled: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // --- Shared environment for all Lambdas ---
    const sharedEnv: Record<string, string> = {
      GCP_PROJECT_ID: gcpProjectId.valueAsString,
      GCP_PROJECT_NUMBER: gcpProjectNumber.valueAsString,
      GCP_REGION: gcpRegion.valueAsString,
      GCP_SERVICE_ACCOUNT_EMAIL: gcpServiceAccountEmail.valueAsString,
      DOCUMENT_AI_PROCESSOR_ID: documentAiProcessorId.valueAsString,
      VERTEX_VECTOR_SEARCH_INDEX_ENDPOINT: vectorSearchIndexEndpoint.valueAsString,
      VERTEX_VECTOR_SEARCH_INDEX_ID: vectorSearchIndexId.valueAsString,
      DATABASE_URL: databaseUrl.valueAsString,
      NODE_OPTIONS: "--enable-source-maps",
    };

    const lambdasDir = path.join(__dirname, "..", "lambdas");

    const bundlingDefaults: lambdaNode.BundlingOptions = {
      sourceMap: true,
      minify: true,
      target: "node22",
      externalModules: ["@aws-sdk/*"],
    };

    // --- Lambda functions (esbuild-bundled) ---
    const markProcessing = new lambdaNode.NodejsFunction(this, "MarkProcessing", {
      functionName: "documind-mark-processing",
      entry: path.join(lambdasDir, "mark_processing", "index.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.minutes(2),
      memorySize: 256,
      environment: sharedEnv,
      bundling: bundlingDefaults,
    });

    const callDocumentAi = new lambdaNode.NodejsFunction(this, "CallDocumentAi", {
      functionName: "documind-call-document-ai",
      entry: path.join(lambdasDir, "call_document_ai", "index.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.minutes(10),
      memorySize: 1024,
      environment: sharedEnv,
      bundling: bundlingDefaults,
    });

    const chunkAndEmbed = new lambdaNode.NodejsFunction(this, "ChunkAndEmbed", {
      functionName: "documind-chunk-and-embed",
      entry: path.join(lambdasDir, "chunk_and_embed", "index.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.minutes(10),
      memorySize: 1024,
      environment: sharedEnv,
      bundling: bundlingDefaults,
    });

    const upsertVectors = new lambdaNode.NodejsFunction(this, "UpsertVectors", {
      functionName: "documind-upsert-vectors",
      entry: path.join(lambdasDir, "upsert_vectors", "index.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: sharedEnv,
      bundling: bundlingDefaults,
    });

    const markReady = new lambdaNode.NodejsFunction(this, "MarkReady", {
      functionName: "documind-mark-ready",
      entry: path.join(lambdasDir, "mark_ready", "index.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.minutes(2),
      memorySize: 256,
      environment: sharedEnv,
      bundling: bundlingDefaults,
    });

    const markFailed = new lambdaNode.NodejsFunction(this, "MarkFailed", {
      functionName: "documind-mark-failed",
      entry: path.join(lambdasDir, "mark_failed", "index.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.minutes(2),
      memorySize: 256,
      environment: sharedEnv,
      bundling: bundlingDefaults,
    });

    // --- IAM: S3 read for Doc AI + chunking ---
    uploadBucket.grantRead(callDocumentAi);
    uploadBucket.grantRead(chunkAndEmbed);

    // --- IAM: STS for WIF (all Lambdas that call GCP) ---
    const gcpCallers = [callDocumentAi, chunkAndEmbed, upsertVectors];
    for (const fn of gcpCallers) {
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["sts:AssumeRoleWithWebIdentity", "sts:GetCallerIdentity"],
          resources: ["*"],
        })
      );
    }

    // --- Step Functions ---
    const markProcessingTask = new tasks.LambdaInvoke(this, "MarkProcessingTask", {
      lambdaFunction: markProcessing,
      outputPath: "$.Payload",
      retryOnServiceExceptions: true,
    });

    const callDocumentAiTask = new tasks.LambdaInvoke(this, "CallDocumentAiTask", {
      lambdaFunction: callDocumentAi,
      outputPath: "$.Payload",
      retryOnServiceExceptions: true,
    });
    callDocumentAiTask.addRetry({
      errors: ["States.TaskFailed"],
      interval: cdk.Duration.seconds(10),
      maxAttempts: 2,
      backoffRate: 2,
    });

    const chunkAndEmbedTask = new tasks.LambdaInvoke(this, "ChunkAndEmbedTask", {
      lambdaFunction: chunkAndEmbed,
      outputPath: "$.Payload",
      retryOnServiceExceptions: true,
    });
    chunkAndEmbedTask.addRetry({
      errors: ["States.TaskFailed"],
      interval: cdk.Duration.seconds(10),
      maxAttempts: 2,
      backoffRate: 2,
    });

    const upsertVectorsTask = new tasks.LambdaInvoke(this, "UpsertVectorsTask", {
      lambdaFunction: upsertVectors,
      outputPath: "$.Payload",
      retryOnServiceExceptions: true,
    });
    upsertVectorsTask.addRetry({
      errors: ["States.TaskFailed"],
      interval: cdk.Duration.seconds(5),
      maxAttempts: 3,
      backoffRate: 2,
    });

    const markReadyTask = new tasks.LambdaInvoke(this, "MarkReadyTask", {
      lambdaFunction: markReady,
      outputPath: "$.Payload",
    });

    const markFailedTask = new tasks.LambdaInvoke(this, "MarkFailedTask", {
      lambdaFunction: markFailed,
      outputPath: "$.Payload",
    });

    const definition = markProcessingTask
      .next(callDocumentAiTask)
      .next(chunkAndEmbedTask)
      .next(upsertVectorsTask)
      .next(markReadyTask);

    markProcessingTask.addCatch(markFailedTask, { resultPath: "$.error" });
    callDocumentAiTask.addCatch(markFailedTask, { resultPath: "$.error" });
    chunkAndEmbedTask.addCatch(markFailedTask, { resultPath: "$.error" });
    upsertVectorsTask.addCatch(markFailedTask, { resultPath: "$.error" });

    const stateMachine = new sfn.StateMachine(this, "IngestDocument", {
      stateMachineName: "DocuMindIngestDocument",
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      timeout: cdk.Duration.minutes(30),
      tracingEnabled: true,
    });

    // --- EventBridge rule: S3 ObjectCreated -> Step Functions ---
    const rule = new events.Rule(this, "S3UploadRule", {
      ruleName: "documind-s3-upload",
      eventPattern: {
        source: ["aws.s3"],
        detailType: ["Object Created"],
        detail: {
          bucket: { name: [uploadBucket.bucketName] },
        },
      },
    });

    rule.addTarget(
      new targets.SfnStateMachine(stateMachine, {
        input: events.RuleTargetInput.fromEventPath("$.detail"),
      })
    );

    // --- Outputs ---
    new cdk.CfnOutput(this, "UploadBucketName", {
      value: uploadBucket.bucketName,
    });
    new cdk.CfnOutput(this, "StateMachineArn", {
      value: stateMachine.stateMachineArn,
    });
  }
}
