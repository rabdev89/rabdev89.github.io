import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import {
  AppProvider,
  Page,
  Card,
  FormLayout,
  TextField,
  Button,
  Text,
  BlockStack,
  Banner,
} from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));
  return json({ errors, polarisTranslations: require("@shopify/polaris/locales/en.json") });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));
  return json({ errors });
};

export default function Auth() {
  const { errors } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const loginErrors = actionData?.errors || errors;

  return (
    <AppProvider i18n={{}}>
      <Page>
        <Card>
          <Form method="post">
            <FormLayout>
              <Text variant="headingMd" as="h2">
                Log in
              </Text>
              <TextField
                type="text"
                name="shop"
                label="Shop domain"
                helpText="e.g. my-shop.myshopify.com"
                autoComplete="on"
                requiredIndicator
              />
              {loginErrors?.shop && (
                <Banner tone="critical">
                  <p>{loginErrors.shop}</p>
                </Banner>
              )}
              <Button submit variant="primary">
                Log in
              </Button>
            </FormLayout>
          </Form>
        </Card>
      </Page>
    </AppProvider>
  );
}
