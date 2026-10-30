import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ALL_ROLES, ROLE_LABELS } from '@/auth/permissions';
import { ApiError } from '@/services/apiClient';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme';
import type { CreateUserInput, Role } from '@/types/auth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: CreateUserInput) => Promise<void>;
}

type Errors = Partial<Record<'fullName' | 'email' | 'password', string>>;

export function CreateUserModal({ visible, onClose, onSubmit }: Props): React.JSX.Element {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset(): void {
    setFullName('');
    setEmail('');
    setPassword('');
    setRole('viewer');
    setErrors({});
    setFormError(null);
  }

  function close(): void {
    if (submitting) return;
    reset();
    onClose();
  }

  async function submit(): Promise<void> {
    if (submitting) return;
    const found: Errors = {};
    if (fullName.trim().length < 2) found.fullName = 'Enter the full name.';
    if (!EMAIL_PATTERN.test(email.trim())) found.email = 'Enter a valid email address.';
    if (password.length < 8) found.password = 'Password must be at least 8 characters.';
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit({ fullName, email, password, role });
      reset();
      onClose();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Add user</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={[styles.input, errors.fullName && styles.inputError]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Jane Doe"
              placeholderTextColor={colors.textMuted}
              editable={!submitting}
            />
            {errors.fullName ? <Text style={styles.fieldError}>{errors.fullName}</Text> : null}

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              value={email}
              onChangeText={setEmail}
              placeholder="jane@company.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
            />
            {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}

            <Text style={styles.label}>Temporary password</Text>
            <TextInput
              style={[styles.input, errors.password && styles.inputError]}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
            />
            {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}

            <Text style={styles.label}>Role</Text>
            <View style={styles.pills}>
              {ALL_ROLES.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setRole(r)}
                  disabled={submitting}
                  style={[styles.pill, role === r && styles.pillActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: role === r }}
                >
                  <Text style={[styles.pillText, role === r && styles.pillTextActive]}>{ROLE_LABELS[r]}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable onPress={close} disabled={submitting} style={[styles.button, styles.cancel]}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={() => void submit()} disabled={submitting} style={[styles.button, styles.primary]}>
              {submitting ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryText}>Create</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,27,61,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    maxHeight: '90%',
  },
  title: { ...typography.heading, color: colors.navy, marginBottom: spacing.md },
  label: { ...typography.bodyStrong, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  inputError: { borderColor: colors.negative },
  fieldError: { ...typography.caption, color: colors.negative, marginTop: spacing.xs },
  formError: {
    ...typography.body,
    color: colors.negative,
    backgroundColor: colors.negativeSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  pills: { flexDirection: 'row', gap: spacing.sm },
  pill: {
    flex: 1,
    minHeight: MIN_TOUCH,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { ...typography.bodyStrong, color: colors.textSecondary },
  pillTextActive: { color: colors.surface },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  button: { flex: 1, minHeight: MIN_TOUCH, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cancel: { backgroundColor: colors.background },
  cancelText: { ...typography.bodyStrong, color: colors.textSecondary },
  primary: { backgroundColor: colors.primary },
  primaryText: { color: colors.surface, fontSize: 15, fontWeight: '700' },
});