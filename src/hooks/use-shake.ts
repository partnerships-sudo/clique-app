import { useEffect, useRef } from 'react';
import { NativeModules } from 'react-native';

const THRESHOLD = 2.5;
const COOLDOWN_MS = 2000;

export function useShake(onShake: () => void) {
  const lastShakeRef = useRef(0);
  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;

  useEffect(() => {
    // ExponentPedometer is the native module backing expo-sensors Accelerometer.
    // Skip silently if not compiled into this dev client build yet.
    if (!NativeModules.ExponentPedometer) return;

    let sub: { remove: () => void } | null = null;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Accelerometer } = require('expo-sensors') as typeof import('expo-sensors');
    Accelerometer.setUpdateInterval(100);
    sub = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      if (magnitude > THRESHOLD && now - lastShakeRef.current > COOLDOWN_MS) {
        lastShakeRef.current = now;
        onShakeRef.current();
      }
    });
    return () => {
      sub?.remove();
    };
  }, []);
}
