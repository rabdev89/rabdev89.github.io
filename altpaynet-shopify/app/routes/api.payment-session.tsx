import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/db.server";
import { createPaymentSession } from "~/utils/altpaynet.server";
import { getShopEncryptedCredentials } from "~/models/shop.server";

interface PaymentSessionBody {
  id: string;
  gid: string;
  group: string;
  amount: string;
  currency: string;
  test: boolean;
  kind: string;
  payment_method: Record<string, unknown>;
  proposed_at: string;
  customer?: {
    email?: string;
    phone_number?: string;
    locale?: string;
    billing_address?: {
      given_name?: string;
      family_name?: string;
      line1?: string;
      line2?: string;
      city?: string;
      postal_code?: string;
      province?: string;
      country_code?: string;
      company?: string;
    };
  };
  cancel_url: string;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: PaymentSessionBody;
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
    return json(
      { error: "AltPayNet is not configured for this shop" },
      { status: 422 },
    );
  }

  const appUrl = process.env.APP_URL || process.env.SHOPIFY_APP_URL || "";

  try {
    const paymentRecord = await prisma.paymentSession.create({
      data: {
        shopifySessionId: body.id,
        shopifyGid: body.gid,
        shopDomain,
        amount: parseFloat(body.amount),
        currency: body.currency,
        kind: body.kind || "sale",
        test: body.test || false,
        cancelUrl: body.cancel_url,
        status: "pending",
      },
    });

    const altpaynetSession = await createPaymentSession(credentials, {
      amount: parseFloat(body.amount),
      currency: body.currency,
      reference: paymentRecord.id,
      description: `Payment for ${shopDomain}`,
      returnUrl: `${appUrl}/api/payment/callback?session_id=${paymentRecord.id}`,
      cancelUrl: body.cancel_url,
      customerEmail: body.customer?.email,
      customerName: body.customer?.billing_address
        ? `${body.customer.billing_address.given_name || ""} ${body.customer.billing_address.family_name || ""}`.trim()
        : undefined,
    });

    await prisma.paymentSession.update({
      where: { id: paymentRecord.id },
      data: {
        altpaynetSessionId: altpaynetSession.session_id,
        status: "redirected",
      },
    });

    return json({
      redirect_url: altpaynetSession.checkout_url,
    });
  } catch (error) {
    console.error("Payment session creation failed:", error);

    return json({
      error: "Failed to create payment session",
    });
  }
};
