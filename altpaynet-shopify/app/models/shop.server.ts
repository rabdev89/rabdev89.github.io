import { prisma } from "~/db.server";
import { encrypt, decrypt } from "~/utils/encryption.server";

export interface ShopSettings {
  altpaynetToken: string;
  altpaynetSecret: string;
  companyName: string;
  companyEmail: string;
  testMode: boolean;
}

export async function getShopSettings(
  shopDomain: string,
): Promise<ShopSettings | null> {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
  });

  if (!shop) return null;

  return {
    altpaynetToken: shop.altpaynetToken ? decrypt(shop.altpaynetToken) : "",
    altpaynetSecret: shop.altpaynetSecret ? decrypt(shop.altpaynetSecret) : "",
    companyName: shop.companyName || "",
    companyEmail: shop.companyEmail || "",
    testMode: shop.testMode,
  };
}

export async function getShopEncryptedCredentials(shopDomain: string) {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: {
      altpaynetToken: true,
      altpaynetSecret: true,
      testMode: true,
    },
  });

  if (!shop?.altpaynetToken || !shop?.altpaynetSecret) {
    return null;
  }

  return {
    encryptedToken: shop.altpaynetToken,
    encryptedSecret: shop.altpaynetSecret,
    testMode: shop.testMode,
  };
}

export async function saveShopSettings(
  shopDomain: string,
  settings: ShopSettings,
) {
  const encryptedToken = settings.altpaynetToken
    ? encrypt(settings.altpaynetToken)
    : null;
  const encryptedSecret = settings.altpaynetSecret
    ? encrypt(settings.altpaynetSecret)
    : null;

  return prisma.shop.upsert({
    where: { shopDomain },
    create: {
      shopDomain,
      altpaynetToken: encryptedToken,
      altpaynetSecret: encryptedSecret,
      companyName: settings.companyName || null,
      companyEmail: settings.companyEmail || null,
      testMode: settings.testMode,
    },
    update: {
      altpaynetToken: encryptedToken,
      altpaynetSecret: encryptedSecret,
      companyName: settings.companyName || null,
      companyEmail: settings.companyEmail || null,
      testMode: settings.testMode,
    },
  });
}
