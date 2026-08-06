import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/db.server";
import { createRefund } from "~/utils/altpaynet.server";
import { getShopEncryptedCredentials } from "~/models/shop.server";

interface RefundSessionBody {
  id: string;
  gid: string;
  payment_id: string;
  amount: string;
  currency: string;
  test: boolean;
  proposed_at: string;
}

const REFUND_RESOLVE_MUTATION = `
  mutation refundSessionResolve($id: ID!) {
    refundSessionResolve(id: $id) {
      refundSession {
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

const REFUND_REJECT_MUTATION = `
  mutation refundSessionReject($id: ID!, $reason: RefundSessionRejectionReasonInput!) {
    refundSessionReject(id: $id, reason: $reason) {
      refundSession {
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
    where: { shop: shopDomain, isOnline: false },
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

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: RefundSessionBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const shopDomain = request.headers.get("X-Shopify-Shop-Domain") || "";
  if (!shopDomain) {
    return json({ error: "Missing shop domain" }, { status: 400 });
  }

  const credentials = await getShopEncryptedCredentials(shopDomain);
  if (!credentials) {
    return json({ error: "Shop not configured" }, { status: 422 });
  }

  const accessToken = await getOfflineAccessToken(shopDomain);
  if (!accessToken) {
    return json({ error: "Shop authentication expired" }, { status: 401 });
  }

  const originalPayment = await prisma.paymentSession.findFirst({
    where: { shopifyGid: body.payment_id },
  });

  if (!originalPayment?.altpaynetTransactionId) {
    try {
      await shopifyGraphQL(shopDomain, accessToken, REFUND_REJECT_MUTATION, {
        id: body.gid,
        reason: {
          code: "PROCESSING_ERROR",
          merchantMessage: "Original payment transaction not found",
        },
      });
    } catch (e) {
      console.error("Failed to reject refund:", e);
    }
    return json({ error: "Original payment not found" });
  }

  try {
    const refundRecord = await prisma.refundSession.create({
      data: {
        shopifyRefundId: body.id,
        shopifyGid: body.gid,
        paymentSessionId: originalPayment.id,
        amount: parseFloat(body.amount),
        currency: body.currency,
        status: "pending",
      },
    });

    const refundResult = await createRefund(
      credentials,
      originalPayment.altpaynetTransactionId,
      parseFloat(body.amount),
      body.currency,
    );

    if (refundResult.status === "success") {
      await shopifyGraphQL(shopDomain, accessToken, REFUND_RESOLVE_MUTATION, {
        id: body.gid,
      });

      await prisma.refundSession.update({
        where: { id: refundRecord.id },
        data: {
          status: "resolved",
          altpaynetRefundId: refundResult.refund_id,
        },
      });
    } else {
      await shopifyGraphQL(shopDomain, accessToken, REFUND_REJECT_MUTATION, {
        id: body.gid,
        reason: {
          code: "PROCESSING_ERROR",
          merchantMessage: "Refund was not processed by payment provider",
        },
      });

      await prisma.refundSession.update({
        where: { id: refundRecord.id },
        data: {
          status: "rejected",
          errorMessage: "Refund failed at payment provider",
        },
      });
    }

    return json({ success: true });
  } catch (error) {
    console.error("Refund processing failed:", error);

    try {
      await shopifyGraphQL(shopDomain, accessToken, REFUND_REJECT_MUTATION, {
        id: body.gid,
        reason: {
          code: "PROCESSING_ERROR",
          merchantMessage: "An error occurred processing the refund",
        },
      });
    } catch (rejectError) {
      console.error("Failed to reject refund session:", rejectError);
    }

    return json({ error: "Refund processing failed" });
  }
};
