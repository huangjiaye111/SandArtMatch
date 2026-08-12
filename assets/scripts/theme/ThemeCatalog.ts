import type { ThemeConfig, ThemeId } from "./ThemeTypes";

export const FALLBACK_THEME_ID: ThemeId = "spring-garden";

const THEME_CONFIGS: readonly ThemeConfig[] = Object.freeze([
  Object.freeze({
    id: "spring-garden",
    displayName: "春日花园",
    battleBackgroundKey: "theme.springGarden.background",
    battleFrameKey: "theme.springGarden.frame",
    battleDecorationKey: "theme.springGarden.decoration",
    collectionCoverKey: "theme.springGarden.collectionCover",
    certificateFrameKey: "theme.springGarden.certificateFrame",
    placeholderBackgroundColor: "#F4F8DE",
    placeholderFrameColor: "#7FC97F",
  }),
  Object.freeze({
    id: "beach-holiday",
    displayName: "海边假日",
    battleBackgroundKey: "theme.beachHoliday.background",
    battleFrameKey: "theme.beachHoliday.frame",
    battleDecorationKey: "theme.beachHoliday.decoration",
    collectionCoverKey: "theme.beachHoliday.collectionCover",
    certificateFrameKey: "theme.beachHoliday.certificateFrame",
    placeholderBackgroundColor: "#DDF4FF",
    placeholderFrameColor: "#47A8D8",
  }),
  Object.freeze({
    id: "cozy-home",
    displayName: "温馨小屋",
    battleBackgroundKey: "theme.cozyHome.background",
    battleFrameKey: "theme.cozyHome.frame",
    battleDecorationKey: "theme.cozyHome.decoration",
    collectionCoverKey: "theme.cozyHome.collectionCover",
    certificateFrameKey: "theme.cozyHome.certificateFrame",
    placeholderBackgroundColor: "#F7E8D8",
    placeholderFrameColor: "#B77A56",
  }),
  Object.freeze({
    id: "cloud-dream",
    displayName: "云朵梦境",
    battleBackgroundKey: "theme.cloudDream.background",
    battleFrameKey: "theme.cloudDream.frame",
    battleDecorationKey: "theme.cloudDream.decoration",
    collectionCoverKey: "theme.cloudDream.collectionCover",
    certificateFrameKey: "theme.cloudDream.certificateFrame",
    placeholderBackgroundColor: "#EEF0FF",
    placeholderFrameColor: "#8E9BE8",
  }),
]);

const THEME_BY_ID: ReadonlyMap<string, ThemeConfig> = new Map(THEME_CONFIGS.map((theme) => [theme.id, theme]));

export const ThemeCatalog = Object.freeze({
  get(themeId: string): ThemeConfig {
    const theme = THEME_BY_ID.get(themeId);
    if (theme !== undefined) {
      return theme;
    }
    warnMissingTheme(themeId);
    return getFallbackTheme();
  },

  getAll(): readonly ThemeConfig[] {
    return THEME_CONFIGS;
  },

  has(themeId: string): themeId is ThemeId {
    return THEME_BY_ID.has(themeId);
  },
});

function getFallbackTheme(): ThemeConfig {
  const fallback = THEME_BY_ID.get(FALLBACK_THEME_ID);
  if (fallback === undefined) {
    throw new Error(`Fallback theme is missing: ${FALLBACK_THEME_ID}.`);
  }
  return fallback;
}

function warnMissingTheme(themeId: string): void {
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(`[ThemeCatalog] Unknown themeId "${themeId}", using fallback "${FALLBACK_THEME_ID}".`);
  }
}
