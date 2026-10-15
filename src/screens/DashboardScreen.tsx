import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { ActivityList } from '@/components/common/ActivityList';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { SectionHeader } from '@/components/common/SectionHeader';
import { StatusView } from '@/components/common/StatusView';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { KpiGrid } from '@/components/dashboard/KpiGrid';
import { RevenueTrendChart } from '@/components/dashboard/RevenueTrendChart';
import { SalesSummaryCard } from '@/components/dashboard/SalesSummaryCard';
import { TopCategoryCard } from '@/components/dashboard/TopCategoryCard';
import { useDashboard } from '@/hooks/useDashboard';
import { colors, spacing } from '@/theme';
import type { MainTabParamList } from '@/types/navigation';
import { getGreeting } from '@/utils/format';

type Props = BottomTabScreenProps<MainTabParamList, 'Dashboard'>;

const H_PADDING = spacing.lg;

export function DashboardScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { data, loading, refreshing, error, refresh, retry } = useDashboard();

  // 1. Loading (first request, nothing to show yet)
  if (loading) {
    return <StatusView variant="loading" title="Loading dashboard..." />;
  }

  // 2. Error with nothing to show -> full-screen error with Retry
  if (!data && error) {
    return (
      <StatusView
        variant="error"
        title="Couldn't load the dashboard"
        message={error}
        actionLabel="Retry"
        onActionPress={() => void retry()}
      />
    );
  }

  // 3. Empty (request succeeded but there is nothing to display)
  if (!data) {
    return (
      <StatusView
        variant="empty"
        title="No data available"
        message="There is nothing to show yet."
        actionLabel="Refresh"
        onActionPress={() => void retry()}
      />
    );
  }

  // 4. Success (a failed refresh keeps the old data and shows a banner)
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingHorizontal: H_PADDING,
        paddingBottom: spacing.xxl,
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
      }
    >
      <DashboardHeader
        greeting={getGreeting()}
        userName={data.user.name}
        unreadCount={data.user.unreadNotifications}
        onProfilePress={() => navigation.navigate('Profile')}
        onNotificationsPress={() => navigation.navigate('Alerts')}
      />

      {error ? <ErrorBanner message={error} onRetry={() => void refresh()} /> : null}

      <View style={styles.section}>
        <SectionHeader title="Key metrics" />
        <KpiGrid kpis={data.kpis} horizontalPadding={H_PADDING * 2} />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Analytics preview" actionLabel="View all" onActionPress={() => navigation.navigate('Analytics')} />
        <View style={styles.stack}>
          <RevenueTrendChart trend={data.revenueTrend} />
          <SalesSummaryCard summary={data.salesSummary} />
          <TopCategoryCard category={data.topCategory} />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Recent activity" actionLabel="See all" onActionPress={() => navigation.navigate('Alerts')} />
        <ActivityList items={data.recentActivity} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  section: { marginTop: spacing.xl },
  stack: { gap: spacing.md },
});