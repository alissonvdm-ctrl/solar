import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  Ionicons,
  Feather,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { RoofView } from "@/components/RoofView";
import { ThreeDRoofView } from "@/components/ThreeDRoofView";
import type {
  Simulation,
  SimulationLocation,
  BuildingConfig,
  PanelPosition,
  SolarApiData,
} from "@/lib/types";
import {
  calculateEnergyData,
  autoPlacePanels,
  getMaxPanelGrid,
} from "@/lib/solar-utils";
import { saveSimulation, loadSimulation } from "@/lib/storage";
import { generateReportHTML } from "@/lib/report-html";
import { apiRequest } from "@/lib/query-client";

function NumericInput({
  label,
  value,
  onChangeText,
  unit,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  unit: string;
  placeholder?: string;
}) {
  return (
    <View style={inputStyles.wrap}>
      <Text style={inputStyles.label}>{label}</Text>
      <View style={inputStyles.inputRow}>
        <TextInput
          style={inputStyles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="numeric"
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
        />
        <View style={inputStyles.unitBadge}>
          <Text style={inputStyles.unitText}>{unit}</Text>
        </View>
      </View>
    </View>
  );
}

function StatCard({
  icon,
  iconColor,
  label,
  value,
  unit,
}: {
  icon: string;
  iconColor: string;
  label: string;
  value: string | number;
  unit: string;
}) {
  return (
    <View style={statStyles.card}>
      <View style={[statStyles.iconWrap, { backgroundColor: iconColor + "15" }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <Text style={statStyles.value}>
        {value}
        <Text style={statStyles.unit}> {unit}</Text>
      </Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

function SolarApiBadge({ label, value }: { label: string; value: string }) {
  return (
    <View style={solarBadgeStyles.badge}>
      <Text style={solarBadgeStyles.value}>{value}</Text>
      <Text style={solarBadgeStyles.label}>{label}</Text>
    </View>
  );
}

export default function SimulationScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    lat?: string;
    lng?: string;
    roofWidth?: string;
    roofLength?: string;
    roofArea?: string;
  }>();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [simulationId, setSimulationId] = useState("");
  const [name, setName] = useState("Nova Simulação");
  const [location, setLocation] = useState<SimulationLocation>({
    latitude: -23.5505,
    longitude: -46.6333,
  });

  const [widthStr, setWidthStr] = useState(params.roofWidth || "10");
  const [lengthStr, setLengthStr] = useState(params.roofLength || "8");
  const [tiltStr, setTiltStr] = useState("15");
  const [targetStr, setTargetStr] = useState("300");
  const hasTracedRoof = !!(params.roofWidth && params.roofLength);
  const [panels, setPanels] = useState<PanelPosition[]>([]);

  const [solarApiData, setSolarApiData] = useState<SolarApiData | null>(null);
  const [solarLoading, setSolarLoading] = useState(false);
  const [solarError, setSolarError] = useState<string | null>(null);
  const [threeDImageBase64, setThreeDImageBase64] = useState<string | null>(null);
  const [googleMapsKey, setGoogleMapsKey] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"2d" | "3d">("3d");

  const building: BuildingConfig = useMemo(
    () => ({
      width: Math.max(2, parseFloat(widthStr) || 2),
      length: Math.max(2, parseFloat(lengthStr) || 2),
      roofTilt: Math.max(0, Math.min(90, parseFloat(tiltStr) || 0)),
      roofOrientation: 0,
    }),
    [widthStr, lengthStr, tiltStr]
  );

  const targetEnergy = useMemo(
    () => Math.max(0, parseFloat(targetStr) || 0),
    [targetStr]
  );

  const energyData = useMemo(() => {
    const base = calculateEnergyData(panels, location.latitude, building.roofTilt);
    if (solarApiData && panels.length > 0) {
      const realSunHours = solarApiData.maxSunshineHoursPerYear / 365;
      const realIrradiance = solarApiData.annualFluxKwhPerM2 / 365;
      const tiltFactor = 1.0;
      const panelPower = 0.4;
      const tempDerating = 0.85;
      const monthlyGen = panels.length * panelPower * realSunHours * 30 * tiltFactor * tempDerating;
      const annualGen = monthlyGen * 12;
      return {
        ...base,
        peakSunHours: Math.round(realSunHours * 10) / 10,
        solarIrradiance: Math.round(realIrradiance * 10) / 10,
        monthlyGenerationKWh: Math.round(monthlyGen * 10) / 10,
        annualGenerationKWh: Math.round(annualGen * 10) / 10,
      };
    }
    return base;
  }, [panels, location.latitude, building.roofTilt, solarApiData]);

  const { rows, cols } = useMemo(() => getMaxPanelGrid(building), [building]);

  const fetchGoogleMapsKey = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/google-maps-key");
      const data = await res.json();
      if (data.key) {
        setGoogleMapsKey(data.key);
      }
    } catch {}
  }, []);

  const fetchSolarData = useCallback(async (lat: number, lng: number) => {
    setSolarLoading(true);
    setSolarError(null);
    try {
      const res = await apiRequest("GET", `/api/solar-data?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      setSolarApiData(data);
    } catch (err: any) {
      setSolarError("Dados solares indisponíveis para esta localização");
      setSolarApiData(null);
    } finally {
      setSolarLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoogleMapsKey();
  }, []);

  useEffect(() => {
    if (params.id) {
      loadSimulation(params.id).then((sim) => {
        if (sim) {
          setSimulationId(sim.id);
          setName(sim.name);
          setLocation(sim.location);
          setWidthStr(sim.building.width.toString());
          setLengthStr(sim.building.length.toString());
          setTiltStr(sim.building.roofTilt.toString());
          setTargetStr(sim.targetEnergy.toString());
          setPanels(sim.panels);
          if (sim.solarApiData) setSolarApiData(sim.solarApiData);
          if (sim.threeDImageBase64) setThreeDImageBase64(sim.threeDImageBase64);
          fetchSolarData(sim.location.latitude, sim.location.longitude);
        }
        setLoading(false);
      });
    } else {
      const newId =
        Date.now().toString() + Math.random().toString(36).substr(2, 9);
      setSimulationId(newId);
      if (params.lat && params.lng) {
        const lat = parseFloat(params.lat);
        const lng = parseFloat(params.lng);
        setLocation({ latitude: lat, longitude: lng });
        fetchSolarData(lat, lng);
      }
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const { rows: maxRows, cols: maxCols } = getMaxPanelGrid(building);
    setPanels((prev) =>
      prev.filter((p) => p.row < maxRows && p.col < maxCols)
    );
  }, [building]);

  const togglePanel = useCallback((row: number, col: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPanels((prev) => {
      const exists = prev.some((p) => p.row === row && p.col === col);
      if (exists) {
        return prev.filter((p) => !(p.row === row && p.col === col));
      }
      return [...prev, { row, col }];
    });
  }, []);

  const handleAutoPlace = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newPanels = autoPlacePanels(building, targetEnergy, location.latitude);
    setPanels(newPanels);
  }, [building, targetEnergy, location.latitude]);

  const handleClearPanels = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPanels([]);
  }, []);

  const handleFillAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const all: PanelPosition[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        all.push({ row: r, col: c });
      }
    }
    setPanels(all);
  }, [rows, cols]);

  const handleCapture3D = useCallback((base64: string) => {
    setThreeDImageBase64(base64);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const sim: Simulation = {
      id: simulationId,
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      location,
      building,
      panels,
      targetEnergy,
      energyData,
      solarApiData: solarApiData || undefined,
      threeDImageBase64: threeDImageBase64 || undefined,
    };
    await saveSimulation(sim);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(false);
    Alert.alert("Salvo", "Simulação salva com sucesso!");
  }, [simulationId, name, location, building, panels, targetEnergy, energyData, solarApiData, threeDImageBase64]);

  const handleGenerateReport = useCallback(async () => {
    if (panels.length === 0) {
      Alert.alert("Atenção", "Adicione pelo menos uma placa solar antes de gerar o relatório.");
      return;
    }

    const sim: Simulation = {
      id: simulationId,
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      location,
      building,
      panels,
      targetEnergy,
      energyData,
      solarApiData: solarApiData || undefined,
      threeDImageBase64: threeDImageBase64 || undefined,
    };

    await saveSimulation(sim);

    try {
      const html = generateReportHTML(sim);
      const { uri } = await Print.printToFileAsync({ html, base64: false });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Exportar Relatório PDF",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("PDF Gerado", "O relatório foi gerado com sucesso.");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert("Erro", "Não foi possível gerar o relatório.");
    }
  }, [simulationId, name, location, building, panels, targetEnergy, energyData, solarApiData, threeDImageBase64]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: topInset }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Simulação
          </Text>
        </View>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={styles.headerBtn}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Feather name="save" size={20} color={Colors.primary} />
          )}
        </Pressable>
        <Pressable onPress={handleGenerateReport} style={styles.headerBtn}>
          <Feather name="file-text" size={20} color={Colors.accent} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomInset + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.nameSection}>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Nome da simulação"
            placeholderTextColor={Colors.textMuted}
          />
          <View style={styles.coordRow}>
            <Ionicons name="location" size={14} color={Colors.primary} />
            <Text style={styles.coordText}>
              {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </Text>
          </View>
        </View>

        {(solarApiData || solarLoading) && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Potencial Solar (Google)</Text>
              {solarLoading && <ActivityIndicator size="small" color={Colors.primary} />}
            </View>
            {solarApiData && (
              <View style={solarBadgeStyles.container}>
                <SolarApiBadge
                  label="Horas Sol/Ano"
                  value={`${Math.round(solarApiData.maxSunshineHoursPerYear)}h`}
                />
                <SolarApiBadge
                  label="Horas Sol/Dia"
                  value={`${(solarApiData.maxSunshineHoursPerYear / 365).toFixed(1)}h`}
                />
                <SolarApiBadge
                  label="Área Máx. Painéis"
                  value={`${Math.round(solarApiData.maxArrayAreaMeters2)}m²`}
                />
                <SolarApiBadge
                  label="Fluxo Anual"
                  value={`${Math.round(solarApiData.annualFluxKwhPerM2)} kWh/m²`}
                />
                <SolarApiBadge
                  label="Offset CO²"
                  value={`${Math.round(solarApiData.carbonOffsetFactorKgPerMwh)} kg/MWh`}
                />
                {solarApiData.roofSegments.length > 0 && (
                  <SolarApiBadge
                    label="Segmentos Telhado"
                    value={`${solarApiData.roofSegments.length}`}
                  />
                )}
                {solarApiData.imageryQuality && (
                  <SolarApiBadge
                    label="Qualidade Imagem"
                    value={solarApiData.imageryQuality === "HIGH" ? "Alta" : "Média"}
                  />
                )}
                {solarApiData.imageryDate && (
                  <SolarApiBadge
                    label="Data da Imagem"
                    value={solarApiData.imageryDate}
                  />
                )}
              </View>
            )}
            {solarError && (
              <View style={solarBadgeStyles.errorBox}>
                <Ionicons name="alert-circle" size={14} color={Colors.accent} />
                <Text style={solarBadgeStyles.errorText}>{solarError}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Configuração do Telhado</Text>
            {hasTracedRoof && (
              <View style={styles.tracedBadge}>
                <Ionicons name="locate" size={12} color={Colors.success} />
                <Text style={styles.tracedBadgeText}>Medido no mapa</Text>
              </View>
            )}
          </View>
          <View style={styles.inputGrid}>
            <NumericInput
              label="Largura"
              value={widthStr}
              onChangeText={setWidthStr}
              unit="m"
              placeholder="10"
            />
            <NumericInput
              label="Comprimento"
              value={lengthStr}
              onChangeText={setLengthStr}
              unit="m"
              placeholder="8"
            />
            <NumericInput
              label="Inclinação"
              value={tiltStr}
              onChangeText={setTiltStr}
              unit="°"
              placeholder="15"
            />
            <NumericInput
              label="Energia Alvo"
              value={targetStr}
              onChangeText={setTargetStr}
              unit="kWh"
              placeholder="300"
            />
          </View>

          <View style={styles.actionRow}>
            <Pressable
              onPress={handleAutoPlace}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionBtnPrimary,
                pressed && styles.actionBtnPressed,
              ]}
            >
              <MaterialCommunityIcons
                name="auto-fix"
                size={18}
                color="#fff"
              />
              <Text style={styles.actionBtnTextLight}>Auto-posicionar</Text>
            </Pressable>
            <Pressable
              onPress={handleFillAll}
              style={({ pressed }) => [
                styles.actionBtn,
                pressed && styles.actionBtnPressed,
              ]}
            >
              <MaterialCommunityIcons
                name="grid"
                size={18}
                color={Colors.primaryLight}
              />
              <Text style={styles.actionBtnText}>Preencher</Text>
            </Pressable>
            <Pressable
              onPress={handleClearPanels}
              style={({ pressed }) => [
                styles.actionBtn,
                pressed && styles.actionBtnPressed,
              ]}
            >
              <Feather name="trash-2" size={16} color={Colors.error} />
              <Text style={[styles.actionBtnText, { color: Colors.error }]}>
                Limpar
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.viewToggleRow}>
            <Pressable
              onPress={() => setViewMode("3d")}
              style={[
                styles.viewToggleBtn,
                viewMode === "3d" && styles.viewToggleBtnActive,
              ]}
            >
              <MaterialCommunityIcons
                name="cube-outline"
                size={16}
                color={viewMode === "3d" ? "#fff" : Colors.textSecondary}
              />
              <Text style={[
                styles.viewToggleBtnText,
                viewMode === "3d" && styles.viewToggleBtnTextActive,
              ]}>3D</Text>
            </Pressable>
            <Pressable
              onPress={() => setViewMode("2d")}
              style={[
                styles.viewToggleBtn,
                viewMode === "2d" && styles.viewToggleBtnActive,
              ]}
            >
              <MaterialCommunityIcons
                name="floor-plan"
                size={16}
                color={viewMode === "2d" ? "#fff" : Colors.textSecondary}
              />
              <Text style={[
                styles.viewToggleBtnText,
                viewMode === "2d" && styles.viewToggleBtnTextActive,
              ]}>2D</Text>
            </Pressable>
          </View>

          {viewMode === "3d" ? (
            <ThreeDRoofView
              building={building}
              panels={panels}
              solarData={solarApiData}
              onCapture={handleCapture3D}
              googleMapsKey={googleMapsKey || undefined}
              latitude={location.latitude}
              longitude={location.longitude}
            />
          ) : (
            <RoofView
              building={building}
              panels={panels}
              onTogglePanel={togglePanel}
            />
          )}

          {viewMode === "2d" && (
            <Text style={styles.hint}>Toque nas células para adicionar ou remover placas</Text>
          )}
          {viewMode === "3d" && threeDImageBase64 && (
            <View style={styles.capturedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
              <Text style={styles.capturedText}>Imagem 3D capturada para o relatório</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Dados de Geração {solarApiData ? "(Google Solar)" : ""}
          </Text>
          <View style={styles.statsGrid}>
            <StatCard
              icon="grid-outline"
              iconColor={Colors.primaryLight}
              label="Placas"
              value={energyData.panelCount}
              unit=""
            />
            <StatCard
              icon="flash"
              iconColor={Colors.accent}
              label="Potência"
              value={energyData.totalPowerKW}
              unit="kW"
            />
            <StatCard
              icon="trending-up"
              iconColor={Colors.success}
              label="Mensal"
              value={energyData.monthlyGenerationKWh}
              unit="kWh"
            />
            <StatCard
              icon="calendar"
              iconColor="#A78BFA"
              label="Anual"
              value={energyData.annualGenerationKWh.toLocaleString("pt-BR")}
              unit="kWh"
            />
            <StatCard
              icon="sunny"
              iconColor={Colors.accent}
              label="Horas Sol"
              value={energyData.peakSunHours}
              unit="h/dia"
            />
            <StatCard
              icon="analytics"
              iconColor={Colors.primary}
              label="Irradiância"
              value={energyData.solarIrradiance}
              unit="kWh/m²"
            />
          </View>
        </View>

        {energyData.panelCount > 0 && (
          <View style={styles.highlightCard}>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryDark]}
              style={styles.highlightGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="flash" size={24} color="rgba(255,255,255,0.8)" />
              <Text style={styles.highlightValue}>
                {energyData.monthlyGenerationKWh.toLocaleString("pt-BR")} kWh
              </Text>
              <Text style={styles.highlightLabel}>
                Geração Mensal Estimada
              </Text>
              {solarApiData && (
                <View style={styles.googleBadge}>
                  <Text style={styles.googleBadgeText}>Dados Google Solar API</Text>
                </View>
              )}
              {targetEnergy > 0 && (
                <View style={styles.targetCompare}>
                  <Text style={styles.targetText}>
                    {energyData.monthlyGenerationKWh >= targetEnergy
                      ? `Atende ${((energyData.monthlyGenerationKWh / targetEnergy) * 100).toFixed(0)}% da meta`
                      : `Faltam ${(targetEnergy - energyData.monthlyGenerationKWh).toFixed(0)} kWh para a meta`}
                  </Text>
                </View>
              )}
            </LinearGradient>
          </View>
        )}

        <Pressable
          onPress={handleGenerateReport}
          style={({ pressed }) => [
            styles.reportBtn,
            pressed && styles.reportBtnPressed,
          ]}
        >
          <Feather name="download" size={20} color={Colors.accent} />
          <Text style={styles.reportBtnText}>Gerar Relatório PDF</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const solarBadgeStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: "30%" as any,
    flex: 1,
  },
  value: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.accent,
    fontFamily: "Inter_700Bold",
  },
  label: {
    fontSize: 10,
    color: Colors.textMuted,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(245,158,11,0.1)",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.2)",
  },
  errorText: {
    fontSize: 12,
    color: Colors.accent,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
});

const inputStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: "45%" as any,
    gap: 6,
  },
  label: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    overflow: "hidden",
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 15,
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
  },
  unitBadge: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: Colors.surfaceLight,
  },
  unitText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontFamily: "Inter_500Medium",
  },
});

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "30%" as any,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
    fontFamily: "Inter_700Bold",
  },
  unit: {
    fontSize: 12,
    fontWeight: "400" as const,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  label: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: "Inter_500Medium",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  headerBtn: {
    width: 40,
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
    fontWeight: "600" as const,
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 20,
  },
  nameSection: {
    gap: 8,
  },
  nameInput: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: Colors.text,
    fontFamily: "Inter_700Bold",
    padding: 0,
  },
  coordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  coordText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: "Inter_500Medium",
    fontVariant: ["tabular-nums"],
  },
  section: {
    gap: 14,
  },
  sectionRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  tracedBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    backgroundColor: Colors.success + "18",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.success + "30",
  },
  tracedBadgeText: {
    fontSize: 11,
    color: Colors.success,
    fontFamily: "Inter_600SemiBold",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inputGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  actionBtnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    fontFamily: "Inter_600SemiBold",
  },
  actionBtnTextLight: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
  },
  viewToggleRow: {
    flexDirection: "row",
    gap: 8,
    alignSelf: "center",
  },
  viewToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  viewToggleBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  viewToggleBtnText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    fontFamily: "Inter_600SemiBold",
  },
  viewToggleBtnTextActive: {
    color: "#fff",
  },
  hint: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
  capturedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
  },
  capturedText: {
    fontSize: 11,
    color: Colors.success,
    fontFamily: "Inter_500Medium",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  highlightCard: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  highlightGradient: {
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  highlightValue: {
    fontSize: 32,
    fontWeight: "800" as const,
    color: "#fff",
    fontFamily: "Inter_700Bold",
  },
  highlightLabel: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    fontFamily: "Inter_500Medium",
  },
  googleBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  googleBadgeText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.9)",
    fontFamily: "Inter_600SemiBold",
  },
  targetCompare: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
  },
  targetText: {
    fontSize: 12,
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
  },
  reportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  reportBtnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  reportBtnText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.accent,
    fontFamily: "Inter_600SemiBold",
  },
});
