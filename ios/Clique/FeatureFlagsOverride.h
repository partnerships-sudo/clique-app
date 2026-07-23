#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

// Sets ReactNativeFeatureFlags::fuseboxEnabledRelease = true so the
// Hermes inspector takes the modern CDPDebugAPI path instead of the
// legacy DecoratedRuntime path that crashes via debugJavaScript on
// iOS 26 / Hermes 0.81.5. Call before startReactNative.
@interface FuseboxFlagPatch : NSObject
+ (void)apply;
@end

NS_ASSUME_NONNULL_END
