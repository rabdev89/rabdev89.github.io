import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { prisma } from "~/db.server";
import { getPaymentStatus } from "~/utils/altpaynet.server";
import { getShopEncryptedCredentials } from "~/models/shop.server";
import { Shopify } from "@shopify/shopify-api";

const RESOLVE_MUTATION = `
  mutation paymentSessionResolve($id: ID!) {
    paymentSessionResolve(id: $id) {
      paymentSession {
        id
        status {
          code
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const REJECT_MUTATION = `
  mutation paymentSessionReject($id: ID!, $reason: PaymentSessionRejectionReasonInput!) {
    paymentSessionReject(id: $id, reason: $reason) {
      paymentSession {
        id
        status {
          code
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

async function getOfflineAccessToken(shopDomain: string): Promise<string | null> {
  const session = await prisma.session.findFirst({
    where: {
      shop: shopDomain,
      isOnline: false,
    },
    select: { accessToken: true },
  });
  return session?.accessToken || null;
}

async function shopifyGraphQL(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown>,
) {
  const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-10";
  const url = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Shopify GraphQL error: ${response.status}`);
  }

  return response.json();
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  const altpaynetStatus = url.searchParams.get("status");
  const transactionId = url.searchParams.get("txn_id");

  if (!sessionId) {
    return new Response("Missing session_id", { status: 400 });
  }

  const paymentSession = await prisma.paymentSession.findUnique({
    where: { id: sessionId },
  });

  if (!paymentSession) {
    return new Response("Payment session not found", { status: 404 });
  }

  if (paymentSession.status === "resolved" || paymentSession.status === "rejected") {
    return redirect(paymentSession.cancelUrl || "/");
  }

  const credentials = await getShopEncryptedCredentials(paymentSession.shopDomain);
  if (!credentials) {
    return new Response("Shop not configured", { status: 500 });
  }

  const accessToken = await getOfflineAccessToken(paymentSession.shopDomain);
  if (!accessToken) {
    return new Response("Shop authentication expired", { status: 500 });
  }

  try {
    let verifiedStatus = altpaynetStatus;

    if (paymentSession.altpaynetSessionId) {
      const statusCheck = await getPaymentStatus(
        credentials,
        paymentSession.altpaynetSessionId,
      );
      verifiedStatus = statusCheck.status;

      if (transactionId || statusCheck.transaction_id) {
        await prisma.paymentSession.update({
          where: { id: sessionId },
          data: {
            altpaynetTransactionId:
              transactionId || statusCheck.transaction_id,
          },
        });
      }
    }

    if (verifiedStatus === "success") {
      const result = await shopifyGraphQL(
        paymentSession.shopDomain,
        accessToken,
        RESOLVE_MUTATION,
        { id: paymentSession.shopifyGid },
      );

      const userErrors = result?.data?.paymentSessionResolve?.userErrors;
      if (userErrors?.length) {
        console.error("Shopify resolve errors:", userErrors);
        throw new Error(userErrors[0].message);
      }

      await prisma.paymentSession.update({
        where: { id: sessionId },
        data: { status: "resolved" },
      });
    } else {
      const reason =
        verifiedStatus === "cancelled"
          ? { code: "BUYER_CANCELED", merchantMessage: "Customer cancelled payment" }
          : { code: "PROCESSING_ERROR", merchantMessage: "Payment was not completed" };

      await shopifyGraphQL(
        paymentSession.shopDomain,
        accessToken,
        REJECT_MUTATION,
        {
          id: paymentSession.shopifyGid,
          reason,
        },
      );

      await prisma.paymentSession.update({
        where: { id: sessionId },
        data: {
          status: "rejected",
          errorMessage: `Payment ${verifiedStatus}: ${reason.merchantMessage}`,
        },
      });
    }
  } catch (error) {
    console.error("Payment callback processing failed:", error);

    try {
      await shopifyGraphQL(
        paymentSession.shopDomain,
        accessToken,
        REJECT_MUTATION,
        {
          id: paymentSession.shopifyGid,
          reason: {
            code: "PROCESSING_ERROR",
            merchantMessage: "An error occurred processing the payment",
          },
        },
      );

      await prisma.paymentSession.update({
        where: { id: sessionId },
        data: {
          status: "rejected",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      });
    } catch (rejectError) {
      console.error("Failed to reject payment session:", rejectError);
    }
  }

  return redirect(paymentSession.cancelUrl || "/");
};
