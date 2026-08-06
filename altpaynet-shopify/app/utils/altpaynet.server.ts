import { decrypt } from "./encryption.server";

const ALTPAYNET_API_BASE = "https://api.altpaynet.com";
const ALTPAYNET_SANDBOX_BASE = "https://sandbox-api.altpaynet.com";

interface AltPayNetConfig {
  token: string;
  secret: string;
  testMode: boolean;
}

interface CreateSessionParams {
  amount: number;
  currency: string;
  reference: string;
  description?: string;
  returnUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  customerName?: string;
}

interface AltPayNetSessionResponse {
  session_id: string;
  checkout_url: string;
  status: string;
}

interface AltPayNetPaymentStatus {
  session_id: string;
  transaction_id: string;
  status: "success" | "failed" | "pending" | "cancelled";
  amount: number;
  currency: string;
  payment_method: string;
}

interface AltPayNetRefundResponse {
  refund_id: string;
  status: "success" | "failed" | "pending";
  amount: number;
}

function getBaseUrl(testMode: boolean): string {
  return testMode ? ALTPAYNET_SANDBOX_BASE : ALTPAYNET_API_BASE;
}

function decryptConfig(config: {
  encryptedToken: string;
  encryptedSecret: string;
  testMode: boolean;
}): AltPayNetConfig {
  return {
    token: decrypt(config.encryptedToken),
    secret: decrypt(config.encryptedSecret),
    testMode: config.testMode,
  };
}

export async function createPaymentSession(
  config: { encryptedToken: string; encryptedSecret: string; testMode: boolean },
  params: CreateSessionParams,
): Promise<AltPayNetSessionResponse> {
  const { token, secret, testMode } = decryptConfig(config);
  const baseUrl = getBaseUrl(testMode);

  const response = await fetch(`${baseUrl}/v1/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Secret-Key": secret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amount,
      currency: params.currency,
      reference: params.reference,
      description: params.description || `Payment for order ${params.reference}`,
      return_url: params.returnUrl,
      cancel_url: params.cancelUrl,
      customer_email: params.customerEmail,
      customer_name: params.customerName,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AltPayNet API error (${response.status}): ${error}`);
  }

  return response.json();
}

export async function getPaymentStatus(
  config: { encryptedToken: string; encryptedSecret: string; testMode: boolean },
  sessionId: string,
): Promise<AltPayNetPaymentStatus> {
  const { token, secret, testMode } = decryptConfig(config);
  const baseUrl = getBaseUrl(testMode);

  const response = await fetch(`${baseUrl}/v1/sessions/${sessionId}/status`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Secret-Key": secret,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AltPayNet status check failed (${response.status}): ${error}`);
  }

  return response.json();
}

export async function createRefund(
  config: { encryptedToken: string; encryptedSecret: string; testMode: boolean },
  transactionId: string,
  amount: number,
  currency: string,
): Promise<AltPayNetRefundResponse> {
  const { token, secret, testMode } = decryptConfig(config);
  const baseUrl = getBaseUrl(testMode);

  const response = await fetch(`${baseUrl}/v1/refunds`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Secret-Key": secret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transaction_id: transactionId,
      amount,
      currency,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AltPayNet refund failed (${response.status}): ${error}`);
  }

  return response.json();
}
