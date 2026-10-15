export const colors = {
  background: '#F4F6FA',
  surface: '#FFFFFF',
  border: '#E6EAF2',
  primary: '#3D5AFE',
  primarySoft: '#E8ECFF',
  navy: '#0F1B3D',
  textPrimary: '#0F1B3D',
  textSecondary: '#5B6785',
  textMuted: '#8A93AB',
  positive: '#12A150',
  positiveSoft: '#E3F6EB',
  negative: '#E5484D',
  negativeSoft: '#FDEBEC',
  warning: '#F5A524',
  warningSoft: '#FEF3DC',
  info: '#0EA5E9',
  infoSoft: '#E0F3FD',
  purple: '#7C5CFC',
  purpleSoft: '#EFEAFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 22, fontWeight: '700' as const },
  heading: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  bodyStrong: { fontSize: 14, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
  kpiValue: { fontSize: 20, fontWeight: '700' as const },
};

/** Minimum recommended touch target. */
export const MIN_TOUCH = 44;

export const shadow = {
  card: {
    shadowColor: '#0F1B3D',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
} as const;