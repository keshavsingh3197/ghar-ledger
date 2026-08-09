import { Injectable, signal } from '@angular/core';

export type AppLanguage = 'en' | 'hi';
export type AppCurrency = 'INR' | 'USD' | 'EUR' | 'GBP';
export type AppTheme = 'system' | 'light' | 'dark';

export interface AppPreferences {
  language: AppLanguage;
  currency: AppCurrency;
  theme: AppTheme;
}

const storageKey = 'ghar-ledger.preferences';
const defaults: AppPreferences = { language: 'en', currency: 'INR', theme: 'system' };

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  readonly value = signal<AppPreferences>(this.load());

  constructor() { this.apply(this.value()); }

  save(preferences: AppPreferences): void {
    this.value.set(preferences);
    localStorage.setItem(storageKey, JSON.stringify(preferences));
    this.apply(preferences);
  }

  private load(): AppPreferences {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(storageKey) ?? '{}') }; }
    catch { return defaults; }
  }

  private apply(preferences: AppPreferences): void {
    document.documentElement.lang = preferences.language;
    document.documentElement.dataset['theme'] = preferences.theme;
  }
}