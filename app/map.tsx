import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { NativeMapView, MAP_AVAILABLE } from "@/components/NativeMap";

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const mapRef = useRef<any>(null);

  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [region, setRegion] = useState({
    latitude: -15.7801,
    longitude: -47.9292,
    latitudeDelta: 20,
    longitudeDelta: 20,
  });
  const [loading, setLoading] = useState(true);
  const [permission, requestPermission] = Location.useForegroundPermissions();
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const showManualInput = !MAP_AVAILABLE || Platform.OS === "web";
  const [showManual, setShowManual] = useState(showManualInput);

  useEffect(() => {
    if (showManualInput) {
      setLoading(false);
      return;
    }
    if (permission?.granted) {
      getCurrentLocation();
    } else if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission().then((result) => {
        if (result.granted) {
          getCurrentLocation();
        } else {
          setLoading(false);
        }
      });
    } else {
      setLoading(false);
    }
  }, [permission?.granted]);

  const getCurrentLocation = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const newRegion = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
      setRegion(newRegion);
      setSelectedLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (mapRef.current?.animateToRegion) {
        mapRef.current.animateToRegion(newRegion, 1000);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleMapPress = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setSelectedLocation({ latitude, longitude });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleConfirm = () => {
    if (showManual) {
      const lat = parseFloat(manualLat);
      const lng = parseFloat(manualLng);
      if (isNaN(lat) || isNaN(lng)) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.replace({
        pathname: "/roof-trace",
        params: { lat: lat.toString(), lng: lng.toString() },
      });
      return;
    }
    if (!selectedLocation) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace({
      pathname: "/roof-trace",
      params: {
        lat: selectedLocation.latitude.toString(),
        lng: selectedLocation.longitude.toString(),
      },
    });
  };

  const handleMyLocation = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    getCurrentLocation();
  };

  const canConfirm = showManual
    ? !isNaN(parseFloat(manualLat)) && !isNaN(parseFloat(manualLng))
    : !!selectedLocation;

  const renderManualInput = () => (
    <View style={styles.manualContainer}>
      <View style={styles.manualContent}>
        <View style={styles.manualIconWrap}>
          <Ionicons name="location" size={48} color={Colors.primary} />
        </View>
        <Text style={styles.manualTitle}>Inserir Coordenadas</Text>
        <Text style={styles.manualSubtitle}>
          Digite a latitude e longitude do local
        </Text>
        <View style={styles.inputRow}>
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Latitude</Text>
            <TextInput
              style={styles.input}
              value={manualLat}
              onChangeText={setManualLat}
              placeholder="-23.5505"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Longitude</Text>
            <TextInput
              style={styles.input}
              value={manualLng}
              onChangeText={setManualLng}
              placeholder="-46.6333"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
            />
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Selecionar Localização</Text>
        {MAP_AVAILABLE && Platform.OS !== "web" && (
          <Pressable
            onPress={() => setShowManual(!showManual)}
            style={styles.toggleButton}
          >
            <Feather
              name={showManual ? "map" : "edit-3"}
              size={20}
              color={Colors.primaryLight}
            />
          </Pressable>
        )}
        {(!MAP_AVAILABLE || Platform.OS === "web") && <View style={{ width: 40 }} />}
      </View>

      {showManual ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {renderManualInput()}
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.mapContainer}>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          )}
          <NativeMapView
            ref={mapRef}
            initialRegion={region}
            onPress={handleMapPress}
            showsUserLocation={!!permission?.granted}
            selectedLocation={selectedLocation}
          />
          <Pressable
            style={[styles.myLocationBtn, { top: 16 }]}
            onPress={handleMyLocation}
          >
            <Ionicons name="locate" size={22} color={Colors.primary} />
          </Pressable>
        </View>
      )}

      <View style={[styles.bottomBar, { paddingBottom: bottomInset + 16 }]}>
        {selectedLocation && !showManual && (
          <View style={styles.coordCard}>
            <Ionicons name="location" size={16} color={Colors.primary} />
            <Text style={styles.coordText}>
              {selectedLocation.latitude.toFixed(6)},{" "}
              {selectedLocation.longitude.toFixed(6)}
            </Text>
          </View>
        )}
        <Pressable
          onPress={handleConfirm}
          disabled={!canConfirm}
          style={({ pressed }) => [
            styles.confirmBtn,
            !canConfirm && styles.confirmBtnDisabled,
            pressed && canConfirm && styles.confirmBtnPressed,
          ]}
        >
          <LinearGradient
            colors={
              canConfirm
                ? [Colors.primary, Colors.primaryDark]
                : [Colors.surfaceLight, Colors.surfaceLight]
            }
            style={styles.confirmGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text
              style={[
                styles.confirmText,
                !canConfirm && styles.confirmTextDisabled,
              ]}
            >
              Confirmar Localização
            </Text>
            <Ionicons
              name="arrow-forward"
              size={20}
              color={canConfirm ? "#fff" : Colors.textMuted}
            />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600" as const,
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
  },
  toggleButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  mapContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  myLocationBtn: {
    position: "absolute",
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  manualContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  manualContent: {
    alignItems: "center",
    gap: 12,
  },
  manualIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  manualTitle: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: Colors.text,
    fontFamily: "Inter_700Bold",
  },
  manualSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  inputWrap: {
    flex: 1,
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: Colors.text,
    fontFamily: "Inter_500Medium",
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  coordCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  coordText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: "Inter_500Medium",
    fontVariant: ["tabular-nums"],
  },
  confirmBtn: {
    borderRadius: 14,
    overflow: "hidden",
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  confirmGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  confirmText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#fff",
    fontFamily: "Inter_700Bold",
  },
  confirmTextDisabled: {
    color: Colors.textMuted,
  },
});
