import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Button,
  Banner,
  BlockStack,
  Checkbox,
  Text,
} from "@shopify/polaris";
import { useState, useCallback } from "react";

import { authenticate } from "../shopify.server";
import {
  getShopSettings,
  saveShopSettings,
  type ShopSettings,
} from "~/models/shop.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getShopSettings(session.shop);

  return json({
    settings: settings || {
      altpaynetToken: "",
      altpaynetSecret: "",
      companyName: "",
      companyEmail: "",
      testMode: true,
    },
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const settings: ShopSettings = {
    altpaynetToken: formData.get("altpaynetToken") as string,
    altpaynetSecret: formData.get("altpaynetSecret") as string,
    companyName: formData.get("companyName") as string,
    companyEmail: formData.get("companyEmail") as string,
    testMode: formData.get("testMode") === "true",
  };

  if (!settings.altpaynetToken || !settings.altpaynetSecret) {
    return json(
      { status: "error", message: "API Token and Secret Key are required." },
      { status: 400 },
    );
  }

  await saveShopSettings(session.shop, settings);

  return json({ status: "success", message: "Settings saved successfully." });
};

export default function Settings() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  const [token, setToken] = useState(settings.altpaynetToken);
  const [secret, setSecret] = useState(settings.altpaynetSecret);
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [companyEmail, setCompanyEmail] = useState(settings.companyEmail);
  const [testMode, setTestMode] = useState(settings.testMode);

  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.set("altpaynetToken", token);
    formData.set("altpaynetSecret", secret);
    formData.set("companyName", companyName);
    formData.set("companyEmail", companyEmail);
    formData.set("testMode", String(testMode));
    submit(formData, { method: "post" });
  }, [token, secret, companyName, companyEmail, testMode, submit]);

  return (
    <Page
      title="AltPayNet Settings"
      backAction={{ content: "Home", url: "/app" }}
    >
      <BlockStack gap="500">
        {actionData?.status === "success" && (
          <Banner title="Settings saved" tone="success" onDismiss={() => {}}>
            <p>{actionData.message}</p>
          </Banner>
        )}
        {actionData?.status === "error" && (
          <Banner title="Error" tone="critical" onDismiss={() => {}}>
            <p>{actionData.message}</p>
          </Banner>
        )}

        <Layout>
          <Layout.AnnotatedSection
            title="API Credentials"
            description="Enter your AltPayNet API credentials. You can find these in your AltPayNet merchant dashboard."
          >
            <Card>
              <FormLayout>
                <TextField
                  label="API Token"
                  value={token}
                  onChange={setToken}
                  autoComplete="off"
                  helpText="Your AltPayNet API token for authenticating requests."
                />
                <TextField
                  label="Secret Key"
                  type="password"
                  value={secret}
                  onChange={setSecret}
                  autoComplete="off"
                  helpText="Your AltPayNet secret key. This is stored encrypted."
                />
              </FormLayout>
            </Card>
          </Layout.AnnotatedSection>

          <Layout.AnnotatedSection
            title="Company Information"
            description="Your business details shown during the payment process."
          >
            <Card>
              <FormLayout>
                <TextField
                  label="Company Name"
                  value={companyName}
                  onChange={setCompanyName}
                  autoComplete="organization"
                />
                <TextField
                  label="Company Email"
                  type="email"
                  value={companyEmail}
                  onChange={setCompanyEmail}
                  autoComplete="email"
                  helpText="Support email shown to customers during payment."
                />
              </FormLayout>
            </Card>
          </Layout.AnnotatedSection>

          <Layout.AnnotatedSection
            title="Environment"
            description="Toggle between test and live mode. Use test mode during development."
          >
            <Card>
              <Checkbox
                label="Enable test mode"
                checked={testMode}
                onChange={setTestMode}
                helpText="When enabled, payments are processed through AltPayNet's sandbox environment. No real charges are made."
              />
            </Card>
          </Layout.AnnotatedSection>
        </Layout>

        <Layout>
          <Layout.Section>
            <Button variant="primary" onClick={handleSave}>
              Save Settings
            </Button>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
