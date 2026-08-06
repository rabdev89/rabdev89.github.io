import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma } from "~/db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);

  switch (topic) {
    case "APP_UNINSTALLED":
      await prisma.shop.deleteMany({ where: { shopDomain: shop } });
      await prisma.session.deleteMany({ where: { shop } });
      break;

    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
    case "SHOP_REDACT":
      // Required GDPR webhooks — no customer data stored beyond Shopify session
      break;

    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  return new Response();
};
