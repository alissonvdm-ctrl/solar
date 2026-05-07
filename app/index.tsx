import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { MaterialCommunityIcons, Ionicons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import type { Simulation } from "@/lib/types";
import { loadAllSimulations, deleteSimulation } from "@/lib/storage";

function SimulationCard({
  item,
  onDelete,
}: {
  item: Simulation;
  onDelete: (id: string) => void;
}) {
  const date = new Date(item.updatedAt || item.createdAt).toLocaleDateString(
    "pt-BR",
    { day: "2-digit", month: "short", year: "numeric" }
  );

  const handlePress = () => {
    router.push({ pathname: "/simulation", params: { id: item.id } });
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Excluir Simulação",
      `Deseja excluir "${item.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => onDelete(item.id),
        },
      ]
    );
  };

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardLeft}>
        <View style={styles.cardIconContainer}>
          <MaterialCommunityIcons
            name="solar-panel"
            size={24}
            color={Colors.primary}
          />
        </View>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.cardDate}>{date}</Text>
        <View style={styles.cardMeta}>
          <View style={styles.cardBadge}>
            <Ionicons name="flash" size={12} color={Colors.accent} />
            <Text style={styles.cardBadgeText}>
              {item.energyData.monthlyGenerationKWh} kWh/mês
            </Text>
          </View>
          <View style={styles.cardBadge}>
            <MaterialCommunityIcons
              name="grid"
              size={12}
              color={Colors.primaryLight}
            />
            <Text style={styles.cardBadgeText}>
              {item.energyData.panelCount} placas
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.cardRight}>
        <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [loading, setLoading] = useState(true);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  useFocusEffect(
    useCallback(() => {
      loadAllSimulations().then((data) => {
        setSimulations(data.sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        ));
        setLoading(false);
      });
    }, [])
  );

  const handleDelete = async (id: string) => {
    await deleteSimulation(id);
    setSimulations((prev) => prev.filter((s) => s.id !== id));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleNewSimulation = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/map");
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <View>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons
              name="white-balance-sunny"
              size={28}
              color={Colors.accent}
            />
            <Text style={styles.title}>SolarSim</Text>
          </View>
          <Text style={styles.subtitle}>Simulador de Energia Solar</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : simulations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <MaterialCommunityIcons
              name="solar-panel-large"
              size={64}
              color={Colors.textMuted}
            />
          </View>
          <Text style={styles.emptyTitle}>Nenhuma simulação</Text>
          <Text style={styles.emptyText}>
            Crie sua primeira simulação de energia solar
          </Text>
        </View>
      ) : (
        <FlatList
          data={simulations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SimulationCard item={item} onDelete={handleDelete} />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: bottomInset + 100 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={[styles.fabContainer, { bottom: bottomInset + 24 }]}>
        <Pressable
          onPress={handleNewSimulation}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.primaryDark]}
            style={styles.fabGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="add" size={28} color="#fff" />
            <Text style={styles.fabText}>Nova Simulação</Text>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "800" as const,
    color: Colors.text,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    marginLeft: 38,
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  cardLeft: {
    marginRight: 14,
  },
  cardIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
  },
  cardDate: {
    fontSize: 12,
    color: Colors.textMuted,
    fontFamily: "Inter_400Regular",
  },
  cardMeta: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  cardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardBadgeText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  cardRight: {
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  fabContainer: {
    position: "absolute",
    left: 20,
    right: 20,
    alignItems: "center",
  },
  fab: {
    borderRadius: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  fabGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 8,
  },
  fabText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#fff",
    fontFamily: "Inter_700Bold",
  },
});
