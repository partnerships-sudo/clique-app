import Purchases, { LOG_LEVEL, type CustomerInfo } from 'react-native-purchases';
import { Platform } from 'react-native';

const RC_API_KEY = 'test_FIrxpjlVDRgQWywmHBjpjftHEPl';
export const VERIFIED_ENTITLEMENT = 'Verified';

let configured = false;

export function configureRevenueCat(userId?: string) {
  if (configured) return;
  Purchases.setLogLevel(LOG_LEVEL.ERROR);
  Purchases.configure({ apiKey: RC_API_KEY, appUserID: userId });
  configured = true;
}

export async function getCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}

export function isVerifiedEntitled(customerInfo: CustomerInfo): boolean {
  return customerInfo.entitlements.active[VERIFIED_ENTITLEMENT] !== undefined;
}

export async function purchaseVerified(): Promise<CustomerInfo> {
  const offerings = await Purchases.getOfferings();
  const monthly = offerings.current?.monthly;
  if (!monthly) throw new Error('No monthly package available');
  const { customerInfo } = await Purchases.purchasePackage(monthly);
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}
