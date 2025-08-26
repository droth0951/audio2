export type CaptionTheme = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  maxWidthDp: number;
  paragraphSpacingDp: number;
  textColor: string;
};

export const DEFAULT_THEME: CaptionTheme = {
  fontFamily: 'System',
  fontSize: 22,
  lineHeight: 28,
  maxWidthDp: 320,
  paragraphSpacingDp: 8,
  textColor: '#ffffff',
};

export function makeSafeTheme(theme?: Partial<CaptionTheme>, containerW?: number): CaptionTheme {
  const baseTheme = { ...DEFAULT_THEME, ...theme };
  
  // Ensure all numeric fields are finite
  const safeTheme: CaptionTheme = {
    fontFamily: typeof baseTheme.fontFamily === 'string' ? baseTheme.fontFamily : DEFAULT_THEME.fontFamily,
    fontSize: Number.isFinite(baseTheme.fontSize) ? baseTheme.fontSize : DEFAULT_THEME.fontSize,
    lineHeight: Number.isFinite(baseTheme.lineHeight) ? baseTheme.lineHeight : DEFAULT_THEME.lineHeight,
    maxWidthDp: Number.isFinite(baseTheme.maxWidthDp) ? baseTheme.maxWidthDp : DEFAULT_THEME.maxWidthDp,
    paragraphSpacingDp: Number.isFinite(baseTheme.paragraphSpacingDp) ? baseTheme.paragraphSpacingDp : DEFAULT_THEME.paragraphSpacingDp,
    textColor: typeof baseTheme.textColor === 'string' ? baseTheme.textColor : DEFAULT_THEME.textColor,
  };
  
  // Clamp maxWidthDp when containerW is known
  if (Number.isFinite(containerW) && containerW > 0) {
    safeTheme.maxWidthDp = Math.min(0.82 * containerW, 360);
  }
  
  return safeTheme;
}
