export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SettingsState {
  readonly soundEnabled: boolean;
  readonly vibrationEnabled: boolean;
}

export type SettingsToggleAction = "sound" | "vibration";

export interface SettingsToggleEntryData {
  readonly action: SettingsToggleAction;
  readonly label: string;
  readonly enabled: boolean;
  readonly valueText: string;
}

export interface SettingsViewData extends SettingsState {
  readonly toggles: readonly SettingsToggleEntryData[];
}

const SETTINGS_STORAGE_KEY = "sand-art-match:settings:v1";
const DEFAULT_SETTINGS: SettingsState = Object.freeze({
  soundEnabled: true,
  vibrationEnabled: true,
});

export class SettingsData {
  private readonly storage: SettingsStorage;
  private readonly key: string;

  public constructor(storage: SettingsStorage, key = SETTINGS_STORAGE_KEY) {
    this.storage = storage;
    this.key = key;
  }

  public getViewData(): SettingsViewData {
    return createViewData(this.load());
  }

  public load(): SettingsState {
    const raw = this.storage.getItem(this.key);
    if (raw === null) {
      return DEFAULT_SETTINGS;
    }
    try {
      return normalizeSettings(JSON.parse(raw));
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  public save(state: SettingsState): SettingsState {
    const normalized = normalizeSettings(state);
    this.storage.setItem(this.key, JSON.stringify(normalized));
    return normalized;
  }

  public toggle(action: SettingsToggleAction): SettingsViewData {
    const state = this.load();
    if (action === "sound") {
      return createViewData(this.save({ ...state, soundEnabled: !state.soundEnabled }));
    }
    return createViewData(this.save({ ...state, vibrationEnabled: !state.vibrationEnabled }));
  }

  public reset(): SettingsViewData {
    this.storage.removeItem(this.key);
    return createViewData(DEFAULT_SETTINGS);
  }
}

export class MemorySettingsStorage implements SettingsStorage {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

function createViewData(state: SettingsState): SettingsViewData {
  return Object.freeze({
    soundEnabled: state.soundEnabled,
    vibrationEnabled: state.vibrationEnabled,
    toggles: Object.freeze([
      createToggle("sound", "Sound", state.soundEnabled),
      createToggle("vibration", "Vibration", state.vibrationEnabled),
    ]),
  });
}

function createToggle(action: SettingsToggleAction, label: string, enabled: boolean): SettingsToggleEntryData {
  return Object.freeze({
    action,
    label,
    enabled,
    valueText: enabled ? "On" : "Off",
  });
}

function normalizeSettings(value: unknown): SettingsState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return DEFAULT_SETTINGS;
  }
  const candidate = value as Partial<Record<keyof SettingsState, unknown>>;
  return Object.freeze({
    soundEnabled: typeof candidate.soundEnabled === "boolean" ? candidate.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
    vibrationEnabled: typeof candidate.vibrationEnabled === "boolean" ? candidate.vibrationEnabled : DEFAULT_SETTINGS.vibrationEnabled,
  });
}
