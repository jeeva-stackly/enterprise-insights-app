import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { Card } from '@/components/common/Card';
import { colors, spacing, typography } from '@/theme';
import type { Granularity, OverviewTrendPoint } from '@/types/analytics';
import { formatBucket } from '@/utils/dateRange';
import { formatCurrency } from '@/utils/format';

const CHART_HEIGHT = 150;
const PAD_X = 8;
const PAD_Y = 14;
const MAX_LABELS = 5;

interface Props {
  points: OverviewTrendPoint[];
  granularity: Granularity;
  total: number;
}

/** Evenly pick at most MAX_LABELS point indexes so long ranges (30+ days) stay readable. */
function labelIndexes(count: number): number[] {
  if (count <= MAX_LABELS) return Array.from({ length: count }, (_, i) => i);
  const last = count - 1;
  return Array.from({ length: MAX_LABELS }, (_, i) => Math.round((i / (MAX_LABELS - 1)) * last));
}

export function AnalyticsTrendChart({ points, granularity, total }: Props): React.JSX.Element {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent): void => setWidth(e.nativeEvent.layout.width);

  const geometry = useMemo(() => {
    if (width === 0 || points.length < 2) return null;
    const max = Math.max(...points.map((p) => p.revenue), 1); // baseline is always 0
    const innerW = width - PAD_X * 2;
    const innerH = CHART_HEIGHT - PAD_Y * 2;
    const coords = points.map((p, i) => ({
      x: PAD_X + (i / (points.length - 1)) * innerW,
      y: PAD_Y + innerH - (p.revenue / max) * innerH,
    }));
    const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const area = `${line} L${coords[coords.length - 1].x.toFixed(1)},${CHART_HEIGHT} L${coords[0].x.toFixed(1)},${CHART_HEIGHT} Z`;
    let peak = 0;
    points.forEach((p, i) => {
      if (p.revenue > points[peak].revenue) peak = i;
    });
    return { line, area, peak: coords[peak], peakValue: points[peak].revenue };
  }, [points, width]);

  const indexes = useMemo(() => labelIndexes(points.length), [points.length]);

  return (
    <Card>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.title}>Revenue trend</Text>
          <Text style={styles.sub}>{granularity === 'hour' ? 'By hour (UTC)' : 'By day'}</Text>
        </View>
        <Text style={styles.total} numberOfLines={1}>
          {formatCurrency(total)}
        </Text>
      </View>

      <View onLayout={onLayout} style={styles.chart} accessibilityLabel="Revenue trend line chart">
        {geometry ? (
          <Svg width={width} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="analyticsFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.primary} stopOpacity={0.25} />
                <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Line x1={PAD_X} x2={width - PAD_X} y1={CHART_HEIGHT - 1} y2={CHART_HEIGHT - 1} stroke={colors.border} strokeWidth={1} />
            <Path d={geometry.area} fill="url(#analyticsFill)" />
            <Path d={geometry.line} stroke={colors.primary} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {geometry.peakValue > 0 ? (
              <Circle cx={geometry.peak.x} cy={geometry.peak.y} r={5} fill={colors.surface} stroke={colors.primary} strokeWidth={2.5} />
            ) : null}
          </Svg>
        ) : null}
      </View>

      <View style={styles.labels}>
        {indexes.map((i) => (
          <Text key={points[i].bucket} style={styles.label}>
            {formatBucket(points[i].bucket)}
          </Text>
        ))}
      </View>
      {geometry && geometry.peakValue > 0 ? (
        <Text style={styles.peak}>Peak: {formatCurrency(geometry.peakValue)}</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  headText: { flexShrink: 1 },
  title: { ...typography.heading, color: colors.textPrimary },
  sub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  total: { ...typography.heading, color: colors.primary },
  chart: { marginTop: spacing.md, height: CHART_HEIGHT },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  label: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
  peak: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
});