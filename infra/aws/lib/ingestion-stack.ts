import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export class IngestionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const gcpProjectId = new cdk.CfnParameter(this, "GcpProjectId", {
      type: "String",
      description: "GCP project ID for Document AI and Vertex AI",
    });

    const gcpWifProviderArn = new cdk.CfnParameter(this, "GcpWifProviderArn", {
      type: "String",
      description: "ARN of the GCP Workload Identity Federation provider",
      default: "",
    });

    // S3 bucket for document uploads
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

    // Shared Lambda props
    const lambdaDefaults: Partial<lambda.FunctionProps> = {
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        GCP_PROJECT_ID: gcpProjectId.valueAsString,
      },
    };

    const markProcessing = new lambda.Function(this, "MarkProcessing", {
      ...lambdaDefaults,
      functionName: "documind-mark-processing",
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambdas/mark_processing"),
    } as lambda.FunctionProps);

    const callDocumentAi = new lambda.Function(this, "CallDocumentAi", {
      ...lambdaDefaults,
      functionName: "documind-call-document-ai",
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambdas/call_document_ai"),
      timeout: cdk.Duration.minutes(10),
      memorySize: 1024,
    } as lambda.FunctionProps);

    const chunkAndEmbed = new lambda.Function(this, "ChunkAndEmbed", {
      ...lambdaDefaults,
      functionName: "documind-chunk-and-embed",
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambdas/chunk_and_embed"),
      timeout: cdk.Duration.minutes(10),
      memorySize: 1024,
    } as lambda.FunctionProps);

    const upsertVectors = new lambda.Function(this, "UpsertVectors", {
      ...lambdaDefaults,
      functionName: "documind-upsert-vectors",
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambdas/upsert_vectors"),
    } as lambda.FunctionProps);

    const markReady = new lambda.Function(this, "MarkReady", {
      ...lambdaDefaults,
      functionName: "documind-mark-ready",
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambdas/mark_ready"),
    } as lambda.FunctionProps);

    const markFailed = new lambda.Function(this, "MarkFailed", {
      ...lambdaDefaults,
      functionName: "documind-mark-failed",
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambdas/mark_failed"),
    } as lambda.FunctionProps);

    // Grant S3 read to the processing lambdas
    uploadBucket.grantRead(callDocumentAi);
    uploadBucket.grantRead(chunkAndEmbed);

    // Step Functions state machine
    const markProcessingTask = new tasks.LambdaInvoke(this, "MarkProcessingTask", {
      lambdaFunction: markProcessing,
      outputPath: "$.Payload",
    });

    const callDocumentAiTask = new tasks.LambdaInvoke(this, "CallDocumentAiTask", {
      lambdaFunction: callDocumentAi,
      outputPath: "$.Payload",
    });

    const chunkAndEmbedTask = new tasks.LambdaInvoke(this, "ChunkAndEmbedTask", {
      lambdaFunction: chunkAndEmbed,
      outputPath: "$.Payload",
    });

    const upsertVectorsTask = new tasks.LambdaInvoke(this, "UpsertVectorsTask", {
      lambdaFunction: upsertVectors,
      outputPath: "$.Payload",
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
    });

    // EventBridge rule: S3 ObjectCreated -> Step Functions
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

    // Outputs
    new cdk.CfnOutput(this, "UploadBucketName", {
      value: uploadBucket.bucketName,
    });
    new cdk.CfnOutput(this, "StateMachineArn", {
      value: stateMachine.stateMachineArn,
    });
  }
}
