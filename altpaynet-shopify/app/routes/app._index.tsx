import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Badge,
  Banner,
  InlineStack,
  Box,
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";
import { getShopSettings } from "~/models/shop.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getShopSettings(session.shop);

  return json({
    shop: session.shop,
    isConfigured: !!(settings?.altpaynetToken && settings?.altpaynetSecret),
    testMode: settings?.testMode ?? true,
    companyName: settings?.companyName || "",
  });
};

export default function Index() {
  const { shop, isConfigured, testMode, companyName } =
    useLoaderData<typeof loader>();

  return (
    <Page title="AltPayNet Payments">
      <BlockStack gap="500">
        {!isConfigured && (
          <Banner
            title="Configuration required"
            action={{ content: "Go to Settings", url: "/app/settings" }}
            tone="warning"
          >
            <p>
              Please configure your AltPayNet API credentials to start
              accepting payments.
            </p>
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Payment Gateway Status
                </Text>
                <InlineStack gap="200" align="start">
                  <Text as="span" variant="bodyMd">
                    Status:
                  </Text>
                  {isConfigured ? (
                    <Badge tone="success">Active</Badge>
                  ) : (
                    <Badge tone="attention">Not configured</Badge>
                  )}
                </InlineStack>
                <InlineStack gap="200" align="start">
                  <Text as="span" variant="bodyMd">
                    Mode:
                  </Text>
                  {testMode ? (
                    <Badge tone="info">Test Mode</Badge>
                  ) : (
                    <Badge tone="success">Live</Badge>
                  )}
                </InlineStack>
                {companyName && (
                  <InlineStack gap="200" align="start">
                    <Text as="span" variant="bodyMd">
                      Company:
                    </Text>
                    <Text as="span" variant="bodyMd">
                      {companyName}
                    </Text>
                  </InlineStack>
                )}
                <InlineStack gap="200" align="start">
                  <Text as="span" variant="bodyMd">
                    Shop:
                  </Text>
                  <Text as="span" variant="bodyMd">
                    {shop}
                  </Text>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Supported Payment Methods
                  </Text>
                  <Text as="p" variant="bodyMd">
                    GCash, Debit Cards, Credit Cards (Visa, Mastercard), Bank
                    Transfer, and other local payment methods via AltPayNet.
                  </Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Need Help?
                  </Text>
                  <Text as="p" variant="bodyMd">
                    Visit the AltPayNet documentation or contact support for
                    integration assistance.
                  </Text>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
