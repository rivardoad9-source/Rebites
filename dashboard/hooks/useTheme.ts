'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'mango-pos:theme:v1';

interface ThemeState {
  pref: ThemePref;
  dark: boolean;
}

/**
 * Store tema kecil di level modul.
 *
 * Sengaja bukan state per-komponen: header dan grafik harus melihat nilai yang
 * sama persis, jadi warna seri Recharts ikut berganti begitu tombol tema
 * ditekan — tanpa perlu reload.
 */
const SERVER_STATE: ThemeState = { pref: 'system', dark: false };

let state: ThemeState = SERVER_STATE;
let initialized = false;
const listeners = new Set<() => void>();

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(pref: ThemePref): boolean {
  return pref === 'system' ? systemPrefersDark() : pref === 'dark';
}

function setState(next: ThemeState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

function readStoredPref(): ThemePref {
  try {
    const stored = window.localStorage.getItem(KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

function init(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const pref = readStoredPref();
  state = { pref, dark: resolve(pref) };

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', (event) => {
    if (state.pref === 'system') setState({ pref: 'system', dark: event.matches });
  });

  // Tema disamakan antar tab yang kebuka di HP yang sama.
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY) return;
    const next = readStoredPref();
    applyAttribute(next);
    setState({ pref: next, dark: resolve(next) });
  });
}

function applyAttribute(pref: ThemePref): void {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
}

function subscribe(listener: () => void): () => void {
  init();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Tema terang/gelap: default ikut setelan HP (siang terang, malam gelap),
 * bisa dikunci manual dan diingat di localStorage.
 */
export function useTheme() {
  const current = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );

  const setTheme = useCallback((next: ThemePref) => {
    applyAttribute(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Mode privat — pilihan cuma berlaku untuk sesi ini.
    }
    setState({ pref: next, dark: resolve(next) });
  }, []);

  /** Terang -> gelap -> ikut HP. */
  const cycle = useCallback(() => {
    setTheme(current.pref === 'light' ? 'dark' : current.pref === 'dark' ? 'system' : 'light');
  }, [current.pref, setTheme]);

  return { pref: current.pref, dark: current.dark, setTheme, cycle };
}
