import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Polygon, Text as SvgText, Line } from 'react-native-svg';
import Colors from '@/constants/colors';

interface CompassRoseProps {
  size?: number;
}

export function CompassRose({ size = 64 }: CompassRoseProps) {
  const center = size / 2;
  const radius = size / 2 - 3;
  const arrowLen = radius * 0.55;
  const arrowWidth = radius * 0.22;
  const tickLen = radius * 0.15;
  const labelOffset = radius * 0.78;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="rgba(12, 18, 32, 0.85)"
          stroke={Colors.borderLight}
          strokeWidth={1.5}
        />

        {[0, 90, 180, 270].map(angle => {
          const rad = (angle * Math.PI) / 180;
          const x1 = center + Math.sin(rad) * (radius - 1);
          const y1 = center - Math.cos(rad) * (radius - 1);
          const x2 = center + Math.sin(rad) * (radius - tickLen);
          const y2 = center - Math.cos(rad) * (radius - tickLen);
          return (
            <Line
              key={angle}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={Colors.textMuted}
              strokeWidth={1}
            />
          );
        })}

        <Polygon
          points={`${center},${center - arrowLen} ${center + arrowWidth},${center} ${center},${center - arrowWidth * 0.4}`}
          fill="#EF4444"
          opacity={0.9}
        />
        <Polygon
          points={`${center},${center + arrowLen} ${center + arrowWidth},${center} ${center},${center + arrowWidth * 0.4}`}
          fill={Colors.textMuted}
          opacity={0.6}
        />
        <Polygon
          points={`${center},${center - arrowLen} ${center - arrowWidth},${center} ${center},${center - arrowWidth * 0.4}`}
          fill="#DC2626"
          opacity={0.9}
        />
        <Polygon
          points={`${center},${center + arrowLen} ${center - arrowWidth},${center} ${center},${center + arrowWidth * 0.4}`}
          fill={Colors.textSecondary}
          opacity={0.4}
        />

        <Circle cx={center} cy={center} r={3} fill={Colors.text} />

        <SvgText
          x={center}
          y={center - labelOffset}
          textAnchor="middle"
          alignmentBaseline="middle"
          fill="#EF4444"
          fontSize={size * 0.16}
          fontWeight="bold"
        >
          N
        </SvgText>
        <SvgText
          x={center}
          y={center + labelOffset + 1}
          textAnchor="middle"
          alignmentBaseline="middle"
          fill={Colors.textMuted}
          fontSize={size * 0.13}
          fontWeight="600"
        >
          S
        </SvgText>
        <SvgText
          x={center + labelOffset}
          y={center + 1}
          textAnchor="middle"
          alignmentBaseline="middle"
          fill={Colors.textMuted}
          fontSize={size * 0.13}
          fontWeight="600"
        >
          L
        </SvgText>
        <SvgText
          x={center - labelOffset}
          y={center + 1}
          textAnchor="middle"
          alignmentBaseline="middle"
          fill={Colors.textMuted}
          fontSize={size * 0.13}
          fontWeight="600"
        >
          O
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});
