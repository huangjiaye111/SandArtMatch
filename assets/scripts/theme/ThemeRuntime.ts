import type { LevelCatalogEntry, LevelCatalog as LevelCatalogData } from "../domain/config/LevelCatalog";
import { BUILT_IN_LEVEL_CATALOG, LevelCatalog } from "../domain/config/LevelCatalog";
import type { GameSession } from "../domain/navigation/GameNavigator";
import { ThemeCatalog } from "./ThemeCatalog";
import type { ThemeConfig } from "./ThemeTypes";

export interface ThemeRuntimeSnapshot {
  readonly level: LevelCatalogEntry;
  readonly theme: ThemeConfig;
}

export interface ThemeRuntimeTarget {
  applyThemeConfig(theme: ThemeConfig, level: LevelCatalogEntry): void;
}

export class ThemeRuntime {
  private readonly session: GameSession;
  private readonly catalog: LevelCatalogData;

  public constructor(session: GameSession, catalog: LevelCatalogData = BUILT_IN_LEVEL_CATALOG) {
    this.session = session;
    this.catalog = catalog;
  }

  public getCurrentTheme(): ThemeConfig {
    return this.getCurrentSnapshot().theme;
  }

  public getCurrentSnapshot(): ThemeRuntimeSnapshot {
    const level = this.resolveCurrentLevel();
    this.session.currentThemeId = level.themeId;
    return Object.freeze({
      level,
      theme: ThemeCatalog.get(level.themeId),
    });
  }

  public applyTheme(target: ThemeRuntimeTarget): ThemeRuntimeSnapshot {
    const snapshot = this.getCurrentSnapshot();
    target.applyThemeConfig(snapshot.theme, snapshot.level);
    return snapshot;
  }

  private resolveCurrentLevel(): LevelCatalogEntry {
    const levelId = this.session.currentLevelId ?? this.session.selectedLevelId ?? LevelCatalog.getAll(this.catalog)[0]?.levelId ?? null;
    if (levelId === null) {
      throw new Error("Cannot resolve theme for an empty level catalog.");
    }
    return LevelCatalog.getById(levelId, this.catalog);
  }
}

export function createThemeRuntime(
  session: GameSession,
  catalog: LevelCatalogData = BUILT_IN_LEVEL_CATALOG,
): ThemeRuntime {
  return new ThemeRuntime(session, catalog);
}
