import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

interface HealthKitData {
  steps: number | null;
  loading: boolean;
  available: boolean;
}

let AppleHealthKit: any = null;
if (Platform.OS === 'ios') {
  try {
    AppleHealthKit = require('react-native-health').default;
  } catch {
    // react-native-health not available (e.g., Expo Go)
  }
}

export function useHealthKit(): HealthKitData {
  const [steps, setSteps] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !AppleHealthKit) {
      setAvailable(false);
      setLoading(false);
      return;
    }

    const initAndFetch = () => {
      const permissions = {
        permissions: {
          read: [AppleHealthKit.Constants.Permissions.StepCount],
        },
      };

      AppleHealthKit.initHealthKit(permissions, (initErr: string) => {
        if (initErr) {
          console.warn('HealthKit init error:', initErr);
          setAvailable(false);
          setLoading(false);
          return;
        }

        initialized.current = true;
        setAvailable(true);
        fetchSteps();
      });
    };

    const fetchSteps = () => {
      if (!initialized.current) return;

      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

      AppleHealthKit.getStepCount(
        { date: startDate.toISOString() },
        (err: string, result: { value: number } | undefined) => {
          if (err) {
            console.warn('HealthKit getStepCount error:', err);
            setSteps(null);
          } else {
            setSteps(result?.value != null ? Math.round(result.value) : null);
          }
          setLoading(false);
        },
      );
    };

    initAndFetch();

    // Refresh steps when app returns to foreground
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && initialized.current) {
        fetchSteps();
      }
    });

    return () => sub.remove();
  }, []);

  return { steps, loading, available };
}
