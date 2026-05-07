import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions, Pressable, Text } from 'react-native';
import Svg, { Rect, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import Colors from '@/constants/colors';
import { CompassRose } from './CompassRose';
import { PANEL_WIDTH, PANEL_HEIGHT, PANEL_GAP } from '@/lib/types';
import type { BuildingConfig, PanelPosition } from '@/lib/types';
import { getMaxPanelGrid } from '@/lib/solar-utils';

interface RoofViewProps {
  building: BuildingConfig;
  panels: PanelPosition[];
  onTogglePanel: (row: number, col: number) => void;
}

const SCALE = 50;
const PADDING = 30;
const screenWidth = Dimensions.get('window').width;

export function RoofView({ building, panels, onTogglePanel }: RoofViewProps) {
  const { rows, cols } = useMemo(() => getMaxPanelGrid(building), [building]);

  const panelSet = useMemo(() => {
    return new Set(panels.map(p => `${p.row}-${p.col}`));
  }, [panels]);

  const cellW = PANEL_WIDTH * SCALE;
  const cellH = PANEL_HEIGHT * SCALE;
  const gapPx = PANEL_GAP * SCALE;

  const buildingW = building.width * SCALE;
  const buildingH = building.length * SCALE;
  const viewWidth = buildingW + PADDING * 2;
  const viewHeight = buildingH + PADDING * 2;

  const gridW = cols > 0 ? cols * (cellW + gapPx) - gapPx : 0;
  const gridH = rows > 0 ? rows * (cellH + gapPx) - gapPx : 0;
  const gridOffsetX = PADDING + (buildingW - gridW) / 2;
  const gridOffsetY = PADDING + (buildingH - gridH) / 2;

  const containerWidth = screenWidth - 40;
  const aspectRatio = viewWidth / viewHeight;
  const containerHeight = Math.min(containerWidth / aspectRatio, 420);
  const finalWidth = containerHeight * aspectRatio;

  const cells = useMemo(() => {
    const result: { row: number; col: number; x: number; y: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        result.push({
          row: r,
          col: c,
          x: gridOffsetX + c * (cellW + gapPx),
          y: gridOffsetY + r * (cellH + gapPx),
        });
      }
    }
    return result;
  }, [rows, cols, gridOffsetX, gridOffsetY, cellW, cellH, gapPx]);

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, { width: finalWidth, height: containerHeight }]}>
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <Defs>
            <LinearGradient id="roofGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={Colors.roof} />
              <Stop offset="100%" stopColor="#162032" />
            </LinearGradient>
            <LinearGradient id="panelGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#4B9BFF" />
              <Stop offset="100%" stopColor={Colors.panelDark} />
            </LinearGradient>
          </Defs>

          <Rect
            x={PADDING}
            y={PADDING}
            width={buildingW}
            height={buildingH}
            fill="url(#roofGrad)"
            stroke={Colors.roofLight}
            strokeWidth={2}
            rx={4}
          />

          {cells.map(cell => {
            const isOccupied = panelSet.has(`${cell.row}-${cell.col}`);
            return (
              <React.Fragment key={`${cell.row}-${cell.col}`}>
                <Rect
                  x={cell.x}
                  y={cell.y}
                  width={cellW}
                  height={cellH}
                  fill={isOccupied ? 'url(#panelGrad)' : 'rgba(255,255,255,0.03)'}
                  stroke={isOccupied ? Colors.panelDark : Colors.roofGrid}
                  strokeWidth={isOccupied ? 1.5 : 0.5}
                  strokeDasharray={isOccupied ? '' : '3,2'}
                  rx={isOccupied ? 2 : 1}
                  onPress={() => onTogglePanel(cell.row, cell.col)}
                />
                {isOccupied && (
                  <>
                    <Line
                      x1={cell.x + 2}
                      y1={cell.y + cellH * 0.33}
                      x2={cell.x + cellW - 2}
                      y2={cell.y + cellH * 0.33}
                      stroke={Colors.panelDark}
                      strokeWidth={0.5}
                      opacity={0.6}
                    />
                    <Line
                      x1={cell.x + 2}
                      y1={cell.y + cellH * 0.66}
                      x2={cell.x + cellW - 2}
                      y2={cell.y + cellH * 0.66}
                      stroke={Colors.panelDark}
                      strokeWidth={0.5}
                      opacity={0.6}
                    />
                    <Line
                      x1={cell.x + cellW * 0.5}
                      y1={cell.y + 2}
                      x2={cell.x + cellW * 0.5}
                      y2={cell.y + cellH - 2}
                      stroke={Colors.panelDark}
                      strokeWidth={0.5}
                      opacity={0.6}
                    />
                  </>
                )}
              </React.Fragment>
            );
          })}
        </Svg>

        <View style={styles.compassOverlay}>
          <CompassRose size={52} />
        </View>

        <View style={styles.dimensionLabel}>
          <Text style={styles.dimensionText}>
            {building.width}m × {building.length}m
          </Text>
        </View>
      </View>

      <Text style={styles.hint}>Toque nas células para adicionar ou remover placas</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  compassOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  dimensionLabel: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    backgroundColor: 'rgba(12, 18, 32, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dimensionText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  hint: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 8,
    fontFamily: 'Inter_400Regular',
  },
});
