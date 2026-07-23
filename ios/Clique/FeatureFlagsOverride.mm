#import "FeatureFlagsOverride.h"

#include <jsinspector-modern/InspectorFlags.h>
#include <react/featureflags/ReactNativeFeatureFlags.h>
#include <react/featureflags/ReactNativeFeatureFlagsDefaults.h>

namespace {
struct FuseboxEnabledProvider : public facebook::react::ReactNativeFeatureFlagsDefaults {
  bool fuseboxEnabledRelease() override { return true; }
};
} // namespace

@implementation FuseboxFlagPatch

+ (void)apply {
  // 1. Force-override the ReactNativeFeatureFlags provider so
  //    fuseboxEnabledRelease() returns true. This clears the accessor
  //    cache even if flags were already read.
  facebook::react::ReactNativeFeatureFlags::dangerouslyForceOverride(
      std::make_unique<FuseboxEnabledProvider>());

  // 2. Reset InspectorFlags so it re-reads fuseboxEnabled from the
  //    (now-overridden) ReactNativeFeatureFlags. Without this step,
  //    InspectorFlags keeps its cached false value.
  facebook::react::jsinspector_modern::InspectorFlags::getInstance()
      .dangerouslyResetFlags();
}

@end
