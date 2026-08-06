import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Badge,
  Text,
  EmptyState,
  BlockStack,
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";
import { prisma } from "~/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const payments = await prisma.paymentSession.findMany({
    where: { shopDomain: session.shop },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      refunds: true,
    },
  });

  return json({
    payments: payments.map((p) => ({
      id: p.id,
      shopifySessionId: p.shopifySessionId,
      amount: p.amount.toString(),
      currency: p.currency,
      status: p.status,
      test: p.test,
      createdAt: p.createdAt.toISOString(),
      refundCount: p.refunds.length,
    })),
  });
};

function statusBadge(status: string) {
  switch (status) {
    case "resolved":
      return <Badge tone="success">Resolved</Badge>;
    case "rejected":
      return <Badge tone="critical">Rejected</Badge>;
    case "redirected":
      return <Badge tone="attention">Redirected</Badge>;
    default:
      return <Badge>Pending</Badge>;
  }
}

export default function Transactions() {
  const { payments } = useLoaderData<typeof loader>();

  const resourceName = {
    singular: "payment",
    plural: "payments",
  };

  const rowMarkup = payments.map((payment, index) => (
    <IndexTable.Row id={payment.id} key={payment.id} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {payment.shopifySessionId.substring(0, 20)}...
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {payment.currency} {payment.amount}
      </IndexTable.Cell>
      <IndexTable.Cell>{statusBadge(payment.status)}</IndexTable.Cell>
      <IndexTable.Cell>
        {payment.test ? (
          <Badge tone="info">Test</Badge>
        ) : (
          <Badge>Live</Badge>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        {new Date(payment.createdAt).toLocaleString()}
      </IndexTable.Cell>
      <IndexTable.Cell>
        {payment.refundCount > 0 && (
          <Badge tone="warning">{payment.refundCount} refund(s)</Badge>
        )}
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Transactions"
      backAction={{ content: "Home", url: "/app" }}
    >
      <Layout>
        <Layout.Section>
          {payments.length === 0 ? (
            <Card>
              <EmptyState
                heading="No transactions yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  Transactions will appear here once customers start paying with
                  AltPayNet.
                </p>
              </EmptyState>
            </Card>
          ) : (
            <Card padding="0">
              <IndexTable
                resourceName={resourceName}
                itemCount={payments.length}
                headings={[
                  { title: "Session ID" },
                  { title: "Amount" },
                  { title: "Status" },
                  { title: "Mode" },
                  { title: "Date" },
                  { title: "Refunds" },
                ]}
                selectable={false}
              >
                {rowMarkup}
              </IndexTable>
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
