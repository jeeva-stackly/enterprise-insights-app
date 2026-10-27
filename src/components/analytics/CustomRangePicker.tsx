import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/common/Card';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme';
import { formatDate, isoToPickerDate, localIso, maxSelectableDate } from '@/utils/dateRange';

interface CustomRangePickerProps {
  start: string | null;
  end: string | null;
  /** Validation message from the screen (null when fine). */
  error: string | null;
  onChange: (next: { start: string | null; end: string | null }) => void;
  onApply: () => void;
}

type Field = 'start' | 'end';

/** Two date fields + Apply. The screen validates; nothing is requested until Apply is pressed. */
export function CustomRangePicker({ start, end, error, onChange, onApply }: CustomRangePickerProps): React.JSX.Element {
  const [open, setOpen] = useState<Field | null>(null);

  const handlePick = (event: DateTimePickerEvent, date?: Date): void => {
    const field = open;
    setOpen(null);
    if (event.type !== 'set' || !date || !field) return; // dismissed
    onChange({ start, end, [field]: localIso(date) });
  };

  const current = open === 'start' ? start : end;

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <DateField label="Start date" value={start} onPress={() => setOpen('start')} />
        <DateField label="End date" value={end} onPress={() => setOpen('end')} />
      </View>

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <Pressable
        onPress={onApply}
        style={({ pressed }) => [styles.apply, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Apply custom range"
      >
        <Text style={styles.applyText}>Apply</Text>
      </Pressable>

      {open ? (
        <DateTimePicker
          value={current ? isoToPickerDate(current) : new Date()}
          mode="date"
          maximumDate={isoToPickerDate(maxSelectableDate())}
          onChange={handlePick}
        />
      ) : null}
    </Card>
  );
}

function DateField({ label, value, onPress }: { label: string; value: string | null; onPress: () => void }): React.JSX.Element {
  return (
    <Pressable onPress={onPress} style={styles.field} accessibilityRole="button" accessibilityLabel={`${label}: ${value ?? 'not set'}`}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldValueRow}>
        <Ionicons name="calendar-outline" size={16} color={colors.primary} />
        <Text style={[styles.fieldValue, !value && styles.placeholder]}>{value ? formatDate(value) : 'Select'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.md, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  field: {
    flex: 1,
    minHeight: MIN_TOUCH,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  fieldLabel: { ...typography.caption, color: colors.textMuted },
  fieldValueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  fieldValue: { ...typography.bodyStrong, color: colors.textPrimary },
  placeholder: { color: colors.textMuted },
  error: { ...typography.caption, color: colors.negative },
  apply: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  applyText: { ...typography.bodyStrong, color: '#fff' },
});