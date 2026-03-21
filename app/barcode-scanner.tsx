import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSettings } from '@/lib/settings-context';

export default function BarcodeScannerScreen() {
  const router = useRouter();
  const { theme } = useSettings();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);

    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${data}.json`
      );
      const json = await response.json();

      if (json.status === 1 && json.product) {
        const product = json.product;
        const nutriments = product.nutriments || {};

        const name = product.product_name || product.brands || 'Unknown';
        const calories = Math.round(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0);
        const protein = Math.round(nutriments.proteins_100g || nutriments.proteins || 0);
        const carbs = Math.round(nutriments.carbohydrates_100g || nutriments.carbohydrates || 0);

        // Navigate back with the scanned data
        router.replace({
          pathname: '/(tabs)',
          params: {
            scannedMeal: JSON.stringify({ name, calories: String(calories), protein: String(protein), carbs: String(carbs) }),
          },
        });
      } else {
        Alert.alert('Not Found', 'Product not found in database. Try entering manually.', [
          { text: 'OK', onPress: () => { setScanned(false); setLoading(false); } },
        ]);
      }
    } catch {
      Alert.alert('Error', 'Failed to look up product. Check your connection.', [
        { text: 'OK', onPress: () => { setScanned(false); setLoading(false); } },
      ]);
    }
  };

  if (!permission) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Ionicons name="camera-outline" size={48} color={theme.chrome} />
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginTop: 16, textAlign: 'center' }}>
          Camera access needed
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 8, textAlign: 'center' }}>
          Allow camera access to scan barcodes on food products.
        </Text>
        <Pressable
          onPress={requestPermission}
          style={{ marginTop: 20, backgroundColor: theme.text, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
        >
          <Text style={{ color: theme.background, fontWeight: '700' }}>Grant Permission</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#fff' }}>
            Scan Barcode
          </Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Scan area guide */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{
            width: 280,
            height: 160,
            borderWidth: 2,
            borderColor: '#F59E0B',
            borderRadius: 16,
            backgroundColor: 'transparent',
          }} />
          <Text style={{ color: '#ffffffcc', fontSize: 13, marginTop: 16 }}>
            {loading ? 'Looking up product…' : 'Point at a barcode'}
          </Text>
          {loading && <ActivityIndicator color="#F59E0B" style={{ marginTop: 12 }} />}
        </View>

        {/* Retry button when scanned */}
        {scanned && !loading && (
          <View style={{ alignItems: 'center', paddingBottom: 40 }}>
            <Pressable
              onPress={() => setScanned(false)}
              style={{ backgroundColor: '#F59E0B', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
            >
              <Text style={{ color: '#000', fontWeight: '700' }}>Scan Again</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
