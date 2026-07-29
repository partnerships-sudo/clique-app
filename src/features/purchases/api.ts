import Purchases, { LOG_LEVEL, type CustomerInfo } from 'react-native-purchases';
import { NativeModules, Platform } from 'react-native';

// True only when the RevenueCat native module is actually registered
function isNativeAvailable() {
  return !!NativeModules.RNPurchases;
}

const RC_API_KEY = process.env.EXPO_PUBLIC_RC_API_KEY!;
export const VERIFIED_ENTITLEMENT = 'Verified';

let configured = false;

export function configureRevenueCat(userId?: string) {
  try {
    if (!isNativeAvailable()) return;
    if (RC_API_KEY?.startsWith('test_')) return;
    if (!configured) {
      Purchases.setLogLevel(LOG_LEVEL.ERROR);
      Purchases.configure({ apiKey: RC_API_KEY, appUserID: userId });
      configured = true;
    } else if (userId) {
      Purchases.logIn(userId).catch(() => {});
    } else {
      Purchases.logOut().catch(() => {});
    }
  } catch {
    // Native module not linked (Expo Go) — ignore
  }
}

export async function getCustomerInfo(): Promise<CustomerInfo> {
  if (!Purchases) throw new Error('RevenueCat not available');
  return Purchases.getCustomerInfo();
}

export function isVerifiedEntitled(customerInfo: CustomerInfo): boolean {
  return customerInfo.entitlements.active[VERIFIED_ENTITLEMENT] !== undefined;
}

export async function purchaseVerified(): Promise<CustomerInfo> {
  if (!Purchases) throw new Error('RevenueCat not available');
  const offerings = await Purchases.getOfferings();
  const monthly = offerings.current?.monthly;
  if (!monthly) throw new Error('No monthly package available');
  const { customerInfo } = await Purchases.purchasePackage(monthly);
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  if (!Purchases) throw new Error('RevenueCat not available');
  return Purchases.restorePurchases();
}
