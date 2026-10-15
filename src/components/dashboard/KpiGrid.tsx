import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { spacing } from '@/theme';
import type { Kpi } from '@/types';
import { KpiCard } from './KpiCard';

interface KpiGridProps {
  kpis: Kpi[];
  horizontalPadding: number;
}

/** 2 columns on phones, 4 on wide screens; widths computed to avoid overflow. */
export function KpiGrid({ kpis, horizontalPadding }: KpiGridProps): React.JSX.Element {
  const { width } = useWindowDimensions();
  const columns = width >= 700 ? 4 : 2;
  const gap = spacing.md;
  const cardWidth = Math.floor((width - horizontalPadding - gap * (columns - 1)) / columns);

  return (
    <View style={[styles.grid, { gap }]}>
      {kpis.map((kpi) => (
        <KpiCard key={kpi.id} kpi={kpi} style={{ width: cardWidth }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});