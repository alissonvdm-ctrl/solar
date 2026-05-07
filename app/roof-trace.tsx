import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { RoofTraceMap } from "@/components/RoofTraceMap";
import { apiRequest } from "@/lib/query-client";
import type { GeoPoint } from "@/lib/geo-utils";
import {
  haversineDistance,
  polygonArea,
  boundingBoxDimensions,
  formatDistance,
  formatArea,
} from "@/lib/geo-utils";

export default function RoofTraceScreen() {
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const latitude = parseFloat(params.lat || "-23.5505");
  const longitude = parseFloat(params.lng || "-46.6333");

  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [isClosed, setIsClosed] = useState(false);
  const [googleMapsKey, setGoogleMapsKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState(true);

  useEffect(() => {
    apiRequest("GET", "/api/google-maps-key")
      .then((res) => res.json())
      .then((data) => {
        if (data.key) setGoogleMapsKey(data.key);
      })
      .catch(() => {})
      .finally(() => setLoadingKey(false));
  }, []);

  const handleAddPoint = useCallback(
    (point: GeoPoint) => {
      if (isClosed) return;
      setPoints((prev) => [...prev, point]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [isClosed]
  );

  const handleMovePoint = useCallback(
    (index: number, point: GeoPoint) => {
      setPoints((prev) => {
        const next = [...prev];
        next[index] = point;
        return next;
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    []
  );

  const handleClosePolygon = useCallback(() => {
    if (points.length >= 3 && !isClosed) {
      setIsClosed(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [points.length, isClosed]);

  const handleUndo = useCallback(() => {
    if (isClosed) {
      setIsClosed(false);
    } else {
      setPoints((prev) => prev.slice(0, -1));
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isClosed]);

  const handleClear = useCallback(() => {
    setPoints([]);
    setIsClosed(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const area = useMemo(() => {
    if (!isClosed || points.length < 3) return 0;
    return polygonArea(points);
  }, [points, isClosed]);

  const dimensions = useMemo(() => {
    if (!isClosed || points.length < 3) return null;
    return boundingBoxDimensions(points);
  }, [points, isClosed]);

  const totalPerimeter = useMemo(() => {
    if (points.length < 2) return 0;
    let total = 0;
    const count = isClosed ? points.length : points.length - 1;
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % points.length;
      total += haversineDistance(points[i], points[j]);
    }
    return total;
  }, [points, isClosed]);

  const handleConfirm = useCallback(() => {
    if (!dimensions) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace({
      pathname: "/simulation",
      params: {
        lat: latitude.toString(),
        lng: longitude.toString(),
        roofWidth: dimensions.width.toString(),
        roofLength: dimensions.length.toString(),
        roofArea: area.toFixed(1),
      },
    });
  }, [dimensions, latitude, longitude, area]);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace({
      pathname: "/simulation",
      params: {
        lat: latitude.toString(),
        lng: longitude.toString(),
      },
    });
  }, [latitude, longitude]);

  if (loadingKey) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: topInset }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Carregando mapa...</Text>
      </View>
    );
  }

  if (!googleMapsKey) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: topInset }]}>
        <Ionicons name="warning" size={48} color={Colors.accent} />
        <Text style={styles.errorText}>
          Chave do Google Maps não configurada
        </Text>
        <Pressable onPress={handleSkip} style={styles.skipBtn}>
          <Text style={styles.skipBtnText}>Pular e inserir manualmente</Text>
        </Pressable>
      </View>
    );
  }

  const canClose = points.length >= 3 && !isClosed;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Traçar Telhado</Text>
          <Text style={styles.headerSubtitle}>
            {isClosed
              ? "Arraste os pontos para ajustar"
              : points.length === 0
              ? "Toque nos cantos do telhado"
              : `${points.length} ponto${points.length > 1 ? "s" : ""} marcado${points.length > 1 ? "s" : ""}`}
          </Text>
        </View>
        <Pressable onPress={handleSkip} style={styles.headerBtn}>
          <Text style={styles.skipText}>Pular</Text>
        </Pressable>
      </View>

      {!isClosed && (
        <View style={styles.instructionBar}>
          <MaterialCommunityIcons
            name={points.length === 0 ? "gesture-tap" : "gesture-swipe"}
            size={18}
            color={Colors.primary}
          />
          <Text style={styles.instructionText}>
            {points.length === 0
              ? "Toque no primeiro canto do telhado para começar"
              : points.length < 3
              ? "Continue marcando os cantos. Arraste para ajustar"
              : "Toque no ponto amarelo ou use o botão abaixo para fechar"}
          </Text>
        </View>
      )}

      {isClosed && (
        <View style={styles.instructionBar}>
          <MaterialCommunityIcons
            name="gesture-swipe"
            size={18}
            color={Colors.success}
          />
          <Text style={styles.instructionText}>
            Arraste qualquer ponto para ajustar a posição. Uma lupa aparecerá para precisão.
          </Text>
        </View>
      )}

      <View style={styles.mapContainer}>
        <RoofTraceMap
          latitude={latitude}
          longitude={longitude}
          googleMapsKey={googleMapsKey}
          points={points}
          onAddPoint={handleAddPoint}
          onMovePoint={handleMovePoint}
          onClosePolygon={handleClosePolygon}
          isClosed={isClosed}
        />
      </View>

      {(points.length > 0 || isClosed) && (
        <View style={styles.statsBar}>
          {totalPerimeter > 0 && (
            <View style={styles.statChip}>
              <Feather name="maximize-2" size={14} color={Colors.primaryLight} />
              <Text style={styles.statText}>
                {formatDistance(totalPerimeter)}
              </Text>
            </View>
          )}
          {isClosed && area > 0 && (
            <View style={styles.statChip}>
              <MaterialCommunityIcons
                name="vector-square"
                size={14}
                color={Colors.accent}
              />
              <Text style={styles.statText}>{formatArea(area)}</Text>
            </View>
          )}
          {isClosed && dimensions && (
            <>
              <View style={styles.statChip}>
                <Feather name="arrow-right" size={14} color={Colors.success} />
                <Text style={styles.statText}>{dimensions.width} m</Text>
              </View>
              <View style={styles.statChip}>
                <Feather name="arrow-down" size={14} color={Colors.success} />
                <Text style={styles.statText}>{dimensions.length} m</Text>
              </View>
            </>
          )}
        </View>
      )}

      <View style={[styles.bottomBar, { paddingBottom: bottomInset + 16 }]}>
        <View style={styles.actionRow}>
          <Pressable
            onPress={handleUndo}
            disabled={points.length === 0}
            style={[
              styles.actionBtn,
              points.length === 0 && styles.actionBtnDisabled,
            ]}
          >
            <Ionicons
              name="arrow-undo"
              size={20}
              color={points.length === 0 ? Colors.textMuted : Colors.text}
            />
            <Text
              style={[
                styles.actionBtnText,
                points.length === 0 && styles.actionBtnTextDisabled,
              ]}
            >
              Desfazer
            </Text>
          </Pressable>

          {canClose ? (
            <Pressable
              onPress={handleClosePolygon}
              style={[styles.actionBtn, styles.closeBtn]}
            >
              <MaterialCommunityIcons
                name="vector-polygon"
                size={20}
                color="#fff"
              />
              <Text style={[styles.actionBtnText, { color: "#fff" }]}>
                Fechar Contorno
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleClear}
              disabled={points.length === 0}
              style={[
                styles.actionBtn,
                points.length === 0 && styles.actionBtnDisabled,
              ]}
            >
              <Ionicons
                name="trash-outline"
                size={20}
                color={points.length === 0 ? Colors.textMuted : Colors.error}
              />
              <Text
                style={[
                  styles.actionBtnText,
                  points.length === 0 && styles.actionBtnTextDisabled,
                ]}
              >
                Limpar
              </Text>
            </Pressable>
          )}
        </View>

        {isClosed && dimensions ? (
          <View style={styles.dimensionsCard}>
            <View style={styles.dimHeader}>
              <MaterialCommunityIcons
                name="check-circle"
                size={20}
                color={Colors.success}
              />
              <Text style={styles.dimTitle}>Dimensões Detectadas</Text>
            </View>
            <View style={styles.dimRow}>
              <View style={styles.dimItem}>
                <Text style={styles.dimLabel}>Largura</Text>
                <Text style={styles.dimValue}>{dimensions.width} m</Text>
              </View>
              <View style={styles.dimDivider} />
              <View style={styles.dimItem}>
                <Text style={styles.dimLabel}>Comprimento</Text>
                <Text style={styles.dimValue}>{dimensions.length} m</Text>
              </View>
              <View style={styles.dimDivider} />
              <View style={styles.dimItem}>
                <Text style={styles.dimLabel}>Área</Text>
                <Text style={styles.dimValue}>{formatArea(area)}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <Pressable
          onPress={handleConfirm}
          disabled={!isClosed || !dimensions}
          style={({ pressed }) => [
            styles.confirmBtn,
            (!isClosed || !dimensions) && styles.confirmBtnDisabled,
            pressed && isClosed && styles.confirmBtnPressed,
          ]}
        >
          <LinearGradient
            colors={
              isClosed && dimensions
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
                (!isClosed || !dimensions) && styles.confirmTextDisabled,
              ]}
            >
              {isClosed ? "Confirmar Dimensões" : "Feche o contorno do telhado"}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={20}
              color={isClosed && dimensions ? "#fff" : Colors.textMuted}
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
  centered: {
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  skipBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skipBtnText: {
    fontSize: 14,
    color: Colors.primaryLight,
    fontFamily: "Inter_600SemiBold",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  headerBtn: {
    width: 44,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  skipText: {
    fontSize: 13,
    color: Colors.primaryLight,
    fontFamily: "Inter_600SemiBold",
  },
  instructionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  instructionText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  mapContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statsBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statText: {
    fontSize: 13,
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
    fontVariant: ["tabular-nums"],
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  closeBtn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionBtnText: {
    fontSize: 14,
    color: Colors.text,
    fontFamily: "Inter_500Medium",
  },
  actionBtnTextDisabled: {
    color: Colors.textMuted,
  },
  dimensionsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.success + "40",
    padding: 14,
    gap: 10,
  },
  dimHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dimTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.success,
    fontFamily: "Inter_600SemiBold",
  },
  dimRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dimItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  dimLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: "Inter_400Regular",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dimValue: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
    fontFamily: "Inter_700Bold",
    fontVariant: ["tabular-nums"],
  },
  dimDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
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
    fontWeight: "700",
    color: "#fff",
    fontFamily: "Inter_700Bold",
  },
  confirmTextDisabled: {
    color: Colors.textMuted,
  },
});
