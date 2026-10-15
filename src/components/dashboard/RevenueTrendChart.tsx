import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { Card } from '@/components/common/Card';
import { colors, spacing, typography } from '@/theme';
import type { RevenueTrend } from '@/types';
import { formatCurrency } from '@/utils/format';

const CHART_HEIGHT = 140;
const PAD_X = 8;
const PAD_Y = 12;

interface RevenueTrendChartProps {
  trend: RevenueTrend;
}

export function RevenueTrendChart({ trend }: RevenueTrendChartProps): React.JSX.Element {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent): void => setWidth(e.nativeEvent.layout.width);

  const { linePath, areaPath, last, total } = useMemo(() => {
    const pts = trend.points;
    if (width === 0 || pts.length < 2) {
      return { linePath: '', areaPath: '', last: null, total: 0 };
    }
    const values = pts.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const innerW = width - PAD_X * 2;
    const innerH = CHART_HEIGHT - PAD_Y * 2;

    const coords = pts.map((p, i) => ({
      x: PAD_X + (i / (pts.length - 1)) * innerW,
      y: PAD_Y + innerH - ((p.value - min) / range) * innerH,
    }));

    const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const first = coords[0];
    const end = coords[coords.length - 1];
    const area = `${line} L${end.x.toFixed(1)},${CHART_HEIGHT} L${first.x.toFixed(1)},${CHART_HEIGHT} Z`;

    return {
      linePath: line,
      areaPath: area,
      last: end,
      total: values.reduce((a, b) => a + b, 0),
    };
  }, [trend.points, width]);

  return (
    <Card>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.title}>Revenue trend</Text>
          <Text style={styles.period}>{trend.periodLabel}</Text>
        </View>
        <Text style={styles.total} numberOfLines={1}>
          {formatCurrency(total)}
        </Text>
      </View>

      <View onLayout={onLayout} style={styles.chart} accessibilityLabel="Revenue trend line chart">
        {width > 0 ? (
          <Svg width={width} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.primary} stopOpacity={0.25} />
                <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={areaPath} fill="url(#areaFill)" />
            <Path d={linePath} stroke={colors.primary} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {last ? <Circle cx={last.x} cy={last.y} r={5} fill={colors.surface} stroke={colors.primary} strokeWidth={2.5} /> : null}
          </Svg>
        ) : null}
      </View>

      <View style={styles.labels}>
        {trend.points.map((p) => (
          <Text key={p.label} style={styles.label}>
            {p.label}
          </Text>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  headText: { flexShrink: 1 },
  title: { ...typography.heading, color: colors.textPrimary },
  period: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  total: { ...typography.heading, color: colors.primary },
  chart: { marginTop: spacing.md, height: CHART_HEIGHT },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, paddingHorizontal: PAD_X - 4 },
  label: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
});