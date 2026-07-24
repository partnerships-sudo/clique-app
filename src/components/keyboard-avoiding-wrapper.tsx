import { KeyboardAvoidingView, Platform, type ViewStyle } from 'react-native';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

// Standard KAV for full-screen content with an input at the bottom.
// behavior='padding' on iOS grows the bottom padding so the input stays
// above the keyboard; undefined on Android (the system handles it natively).
// keyboardVerticalOffset is 0 because all screens using this set headerShown: false.
//
// Note: screens where the KAV wraps an absolutely-positioned bottom overlay
// (e.g. stories-modal) must use behavior='position' instead — see that file.
export function KeyboardAvoidingWrapper({ children, style }: Props) {
  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {children}
    </KeyboardAvoidingView>
  );
}
