// RevenueCat disabled — re-enable when App Store Connect products are configured
// import Purchases, { LOG_LEVEL, type CustomerInfo } from 'react-native-purchases';

export const VERIFIED_ENTITLEMENT = 'Verified';

export function configureRevenueCat(_userId?: string) {
  // no-op
}

export async function getCustomerInfo() {
  throw new Error('Purchases not available');
}

export function isVerifiedEntitled(_customerInfo: unknown): boolean {
  return false;
}

export async function purchaseVerified() {
  throw new Error('Purchases not available');
}

export async function restorePurchases() {
  throw new Error('Purchases not available');
}
