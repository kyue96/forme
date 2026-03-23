import { useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';

type PermissionStatus = 'idle' | 'granted' | 'denied';

export default function PermissionsScreen() {
  const router = useRouter();
  const [cameraStatus, setCameraStatus] = useState<PermissionStatus>('idle');
  const [notifStatus, setNotifStatus] = useState<PermissionStatus>('idle');

  const requestCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      setCameraStatus(status === 'granted' ? 'granted' : 'denied');
    } catch {
      setCameraStatus('denied');
    }
  };

  const requestNotifications = async () => {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.HIGH,
        });
      }
      const { status } = await Notifications.requestPermissionsAsync();
      setNotifStatus(status === 'granted' ? 'granted' : 'denied');
    } catch {
      setNotifStatus('denied');
    }
  };

  const handleContinue = () => {
    router.replace('/quiz/1');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 32, justifyContent: 'space-between' }}>
        <View>
          {/* Header */}
          <View style={{ marginBottom: 40 }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#18181B', marginBottom: 8 }}>
              Before we begin
            </Text>
            <Text style={{ fontSize: 15, color: '#71717A', lineHeight: 22 }}>
              Forme works best with a couple of permissions. You can always change these later in Settings.
            </Text>
          </View>

          {/* Permission rows */}
          <View style={{ gap: 20 }}>
            {/* Camera */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FAFAFA',
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: '#E4E4E7',
            }}>
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: '#FEF3C7',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 14,
              }}>
                <Ionicons name="camera-outline" size={24} color="#F59E0B" />
              </View>

              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#18181B', marginBottom: 2 }}>
                  Camera
                </Text>
                <Text style={{ fontSize: 13, color: '#71717A', lineHeight: 18 }}>
                  Scan barcodes for meal tracking and share workout photos with the community.
                </Text>
              </View>

              <Pressable
                onPress={requestCamera}
                disabled={cameraStatus !== 'idle'}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 12,
                  backgroundColor: cameraStatus === 'granted' ? '#DCFCE7' : cameraStatus === 'denied' ? '#F4F4F5' : '#18181B',
                }}
              >
                {cameraStatus === 'granted' ? (
                  <Ionicons name="checkmark" size={16} color="#16A34A" />
                ) : cameraStatus === 'denied' ? (
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#A1A1AA' }}>Skipped</Text>
                ) : (
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF' }}>Allow</Text>
                )}
              </Pressable>
            </View>

            {/* Notifications */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FAFAFA',
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: '#E4E4E7',
            }}>
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: '#DBEAFE',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 14,
              }}>
                <Ionicons name="notifications-outline" size={24} color="#3B82F6" />
              </View>

              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#18181B', marginBottom: 2 }}>
                  Notifications
                </Text>
                <Text style={{ fontSize: 13, color: '#71717A', lineHeight: 18 }}>
                  Get rest timer alerts during workouts and reminders to stay on track with your plan.
                </Text>
              </View>

              <Pressable
                onPress={requestNotifications}
                disabled={notifStatus !== 'idle'}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 12,
                  backgroundColor: notifStatus === 'granted' ? '#DCFCE7' : notifStatus === 'denied' ? '#F4F4F5' : '#18181B',
                }}
              >
                {notifStatus === 'granted' ? (
                  <Ionicons name="checkmark" size={16} color="#16A34A" />
                ) : notifStatus === 'denied' ? (
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#A1A1AA' }}>Skipped</Text>
                ) : (
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF' }}>Allow</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>

        {/* Continue button */}
        <View>
          <Text style={{ fontSize: 13, color: '#A1A1AA', textAlign: 'center', marginBottom: 16 }}>
            Permissions are optional. You can enable them anytime in your device settings.
          </Text>
          <Pressable
            onPress={handleContinue}
            style={{
              backgroundColor: '#18181B',
              paddingVertical: 16,
              borderRadius: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
