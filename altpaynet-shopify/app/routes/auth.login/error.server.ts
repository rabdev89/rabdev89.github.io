import type { LoginError } from "@shopify/shopify-app-remix/server";

export function loginErrorMessage(loginErrors: LoginError[]) {
  if (!loginErrors?.length) return undefined;

  const errorMap: Record<string, string> = {};

  for (const error of loginErrors) {
    if (error.shop) {
      errorMap.shop =
        typeof error.shop === "string"
          ? error.shop
          : "Please enter a valid shop domain.";
    }
  }

  return Object.keys(errorMap).length > 0 ? errorMap : undefined;
}
