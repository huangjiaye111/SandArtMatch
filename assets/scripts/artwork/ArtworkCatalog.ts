import { ThemeCatalog } from "../theme/ThemeCatalog";
import type { ThemeId } from "../theme/ThemeTypes";
import type { ArtworkDefinition } from "./ArtworkTypes";

const ARTWORKS: readonly ArtworkDefinition[] = Object.freeze([
  createArtwork("spring-cat-001", "spring-garden", "春日猫咪", 1),
  createArtwork("spring-rabbit-001", "spring-garden", "春日兔兔", 2),
  createArtwork("spring-dog-001", "spring-garden", "春日小狗", 3),
  createArtwork("beach-cat-001", "beach-holiday", "海边猫咪", 1),
  createArtwork("beach-rabbit-001", "beach-holiday", "海边兔兔", 2),
  createArtwork("beach-dog-001", "beach-holiday", "海边小狗", 3),
  createArtwork("cozy-cat-001", "cozy-home", "温馨猫咪", 1),
  createArtwork("cozy-rabbit-001", "cozy-home", "温馨兔兔", 2),
  createArtwork("cozy-dog-001", "cozy-home", "温馨小狗", 3),
  createArtwork("cloud-cat-001", "cloud-dream", "云朵猫咪", 1),
  createArtwork("cloud-rabbit-001", "cloud-dream", "云朵兔兔", 2),
  createArtwork("cloud-dog-001", "cloud-dream", "云朵小狗", 3),
]);

const ARTWORK_BY_ID = new Map<string, ArtworkDefinition>(ARTWORKS.map((artwork) => [artwork.id, artwork]));
const THEME_SORT_ORDER = new Map<string, number>(ThemeCatalog.getAll().map((theme, index) => [theme.id, index]));
const ARTWORK_ORDER_BY_THEME = buildThemeIndex();

export const BUILT_IN_ARTWORK_CATALOG: readonly ArtworkDefinition[] = ARTWORKS;

export const ArtworkCatalog = Object.freeze({
  getById(id: string): ArtworkDefinition | null {
    const artwork = ARTWORK_BY_ID.get(id);
    if (artwork !== undefined) {
      return artwork;
    }
    warnMissingArtwork(id);
    return null;
  },

  getAll(): readonly ArtworkDefinition[] {
    return Object.freeze([...ARTWORKS].sort(compareArtwork));
  },

  getByTheme(themeId: ThemeId): readonly ArtworkDefinition[] {
    if (!ThemeCatalog.has(themeId)) {
      warnMissingTheme(themeId);
      return Object.freeze([]);
    }
    return ARTWORK_ORDER_BY_THEME.get(themeId) ?? Object.freeze([]);
  },

  getByOrder(themeId: ThemeId, order: number): ArtworkDefinition | null {
    if (!ThemeCatalog.has(themeId)) {
      warnMissingTheme(themeId);
      return null;
    }
    if (!Number.isSafeInteger(order) || order <= 0) {
      warnMissingArtwork(`${themeId}:${order}`);
      return null;
    }
    const found = ARTWORK_ORDER_BY_THEME.get(themeId)?.find((artwork) => artwork.order === order) ?? null;
    if (found === null) {
      warnMissingArtwork(`${themeId}:${order}`);
    }
    return found;
  },

  getCountByTheme(themeId: ThemeId): number {
    return this.getByTheme(themeId).length;
  },

  has(id: string): boolean {
    return ARTWORK_BY_ID.has(id);
  },
});

function buildThemeIndex(): ReadonlyMap<string, readonly ArtworkDefinition[]> {
  const grouped = new Map<string, ArtworkDefinition[]>();
  for (const artwork of ARTWORKS) {
    const bucket = grouped.get(artwork.themeId) ?? [];
    bucket.push(artwork);
    grouped.set(artwork.themeId, bucket);
  }
  return new Map(ThemeCatalog.getAll().map((theme) => [theme.id, Object.freeze((grouped.get(theme.id) ?? []).slice().sort(compareArtwork))]));
}

function compareArtwork(left: ArtworkDefinition, right: ArtworkDefinition): number {
  const themeOrder = (THEME_SORT_ORDER.get(left.themeId) ?? 0) - (THEME_SORT_ORDER.get(right.themeId) ?? 0);
  if (themeOrder !== 0) {
    return themeOrder;
  }
  if (left.order !== right.order) {
    return left.order - right.order;
  }
  return left.id.localeCompare(right.id);
}

function createArtwork(id: string, themeId: ThemeId, displayName: string, order: number): ArtworkDefinition {
  return Object.freeze({ id, themeId, displayName, order });
}

function warnMissingArtwork(id: string): void {
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(`[ArtworkCatalog] Unknown artworkId "${id}".`);
  }
}

function warnMissingTheme(themeId: string): void {
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(`[ArtworkCatalog] Unknown themeId "${themeId}".`);
  }
}
