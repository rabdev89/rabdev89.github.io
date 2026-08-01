import { STSClient, AssumeRoleWithWebIdentityCommand } from "@aws-sdk/client-sts";

const GCP_STS_URL = "https://sts.googleapis.com/v1/token";
const GCP_IAM_URL = "https://iamcredentials.googleapis.com/v1";

interface GcpCredentials {
  accessToken: string;
  expireTime: string;
}

let cachedCreds: GcpCredentials | null = null;
let cacheExpiry = 0;

export async function getGcpAccessToken(): Promise<string> {
  if (cachedCreds && Date.now() < cacheExpiry) {
    return cachedCreds.accessToken;
  }

  const gcpProjectNumber = process.env.GCP_PROJECT_NUMBER!;
  const gcpPoolId = process.env.GCP_WIF_POOL_ID || "documind-aws-pool";
  const gcpProviderId = process.env.GCP_WIF_PROVIDER_ID || "documind-aws-provider";
  const gcpServiceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL!;

  const callerIdentityToken = await getAwsOidcToken();

  const stsResponse = await fetch(GCP_STS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      audience: `//iam.googleapis.com/projects/${gcpProjectNumber}/locations/global/workloadIdentityPools/${gcpPoolId}/providers/${gcpProviderId}`,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
      subject_token: callerIdentityToken,
    }),
  });

  if (!stsResponse.ok) {
    const err = await stsResponse.text();
    throw new Error(`GCP STS token exchange failed: ${stsResponse.status} ${err}`);
  }

  const stsData = await stsResponse.json();
  const federatedToken = stsData.access_token;

  const iamResponse = await fetch(
    `${GCP_IAM_URL}/projects/-/serviceAccounts/${gcpServiceAccountEmail}:generateAccessToken`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${federatedToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        scope: ["https://www.googleapis.com/auth/cloud-platform"],
        lifetime: "3600s",
      }),
    }
  );

  if (!iamResponse.ok) {
    const err = await iamResponse.text();
    throw new Error(`GCP IAM generateAccessToken failed: ${iamResponse.status} ${err}`);
  }

  const iamData = await iamResponse.json();
  cachedCreds = {
    accessToken: iamData.accessToken,
    expireTime: iamData.expireTime,
  };
  cacheExpiry = Date.now() + 50 * 60 * 1000; // refresh 10 min before expiry

  return cachedCreds.accessToken;
}

async function getAwsOidcToken(): Promise<string> {
  const tokenUrl = process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI;
  const tokenAuthHeader = process.env.AWS_CONTAINER_AUTHORIZATION_TOKEN;

  if (tokenUrl && tokenAuthHeader) {
    const res = await fetch(tokenUrl, {
      headers: { Authorization: tokenAuthHeader },
    });
    const data = await res.json();
    return data.Token;
  }

  const sts = new STSClient({});
  const roleArn = process.env.GCP_WIF_AWS_ROLE_ARN!;

  const command = new AssumeRoleWithWebIdentityCommand({
    RoleArn: roleArn,
    RoleSessionName: "documind-gcp-wif",
    WebIdentityToken: process.env.AWS_WEB_IDENTITY_TOKEN || "",
  });

  const response = await sts.send(command);
  if (!response.Credentials?.SessionToken) {
    throw new Error("Failed to get AWS STS session token for WIF");
  }

  return response.Credentials.SessionToken;
}
