import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { ApiError } from '@/services/apiClient';
import { colors, MIN_TOUCH, radius, shadow, spacing, typography } from '@/theme';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  email?: string;
  password?: string;
}

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = 'Email is required.';
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Enter a valid email address.';
  if (!password) errors.password = 'Password is required.';
  return errors;
}

export function LoginScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false); // blocks double taps before state re-renders
  const passwordRef = useRef<TextInput>(null);

  async function handleSubmit(): Promise<void> {
    if (submittingRef.current) return;
    const found = validate(email, password);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await login(email, password);
      // On success the root navigator swaps this screen for the app.
    } catch (e) {
      if (__DEV__) console.warn('[login] failed', e instanceof ApiError ? e.detail ?? e.message : 'unexpected error');
      setFormError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
      submittingRef.current = false;
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Ionicons name="stats-chart" size={34} color={colors.surface} />
          </View>
          <Text style={styles.brandName}>Enterprise Insights</Text>
          <Text style={styles.tagline}>Business metrics, in your pocket.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Sign in</Text>

          {formError ? (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Ionicons name="alert-circle" size={18} color={colors.negative} />
              <Text style={styles.errorBoxText}>{formError}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, errors.email && styles.inputError]}
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            editable={!submitting}
            onSubmitEditing={() => passwordRef.current?.focus()}
            accessibilityLabel="Email"
          />
          {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}

          <Text style={[styles.label, styles.labelSpaced]}>Password</Text>
          <View style={[styles.passwordRow, errors.password && styles.inputError]}>
            <TextInput
              ref={passwordRef}
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              editable={!submitting}
              onSubmitEditing={() => void handleSubmit()}
              accessibilityLabel="Password"
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              style={styles.eye}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              hitSlop={8}
            >
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}

          <Pressable
            onPress={() => void handleSubmit()}
            disabled={submitting}
            style={({ pressed }) => [styles.button, (pressed || submitting) && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityState={{ disabled: submitting, busy: submitting }}
          >
            {submitting ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </Pressable>

          <Text style={styles.hint}>Accounts are created by an administrator.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg },
  brand: { alignItems: 'center', marginBottom: spacing.xxl },
  logo: {
    width: 68,
    height: 68,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  brandName: { ...typography.title, color: colors.navy },
  tagline: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  // maxWidth keeps the form readable on tablets / landscape; width fills small phones.
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow.card,
  },
  heading: { ...typography.heading, color: colors.navy, marginBottom: spacing.lg },
  label: { ...typography.bodyStrong, color: colors.textPrimary, marginBottom: spacing.xs },
  labelSpaced: { marginTop: spacing.lg },
  input: {
    minHeight: MIN_TOUCH + 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  inputError: { borderColor: colors.negative },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH + 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  passwordInput: { flex: 1, paddingHorizontal: spacing.md, fontSize: 15, color: colors.textPrimary },
  eye: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  fieldError: { ...typography.caption, color: colors.negative, marginTop: spacing.xs },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.negativeSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorBoxText: { ...typography.body, color: colors.negative, flex: 1 },
  button: {
    marginTop: spacing.xl,
    minHeight: MIN_TOUCH + 4,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: { opacity: 0.75 },
  buttonText: { color: colors.surface, fontSize: 16, fontWeight: '700' },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});