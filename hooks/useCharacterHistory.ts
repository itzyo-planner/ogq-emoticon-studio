'use client';

import { useState, useEffect, useCallback } from 'react';

export interface CharacterHistoryItem {
  id: string;
  characterDescription: string;
  style: string;
  createdAt: number;
  usedCount: number;
}

const STORAGE_KEY = 'emoticon-studio-character-history';
const MAX_HISTORY_ITEMS = 20;

export function useCharacterHistory() {
  const [history, setHistory] = useState<CharacterHistoryItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CharacterHistoryItem[];
        // Sort by most recently used
        setHistory(parsed.sort((a, b) => b.createdAt - a.createdAt));
      }
    } catch (e) {
      console.error('Failed to load character history:', e);
    }
    setIsLoaded(true);
  }, []);

  // Save history to localStorage
  const saveHistory = useCallback((items: CharacterHistoryItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save character history:', e);
    }
  }, []);

  // Add or update a character in history
  const addToHistory = useCallback((characterDescription: string, style: string) => {
    if (!characterDescription.trim()) return;

    setHistory((prev) => {
      // Check if this exact character already exists
      const existingIndex = prev.findIndex(
        (item) =>
          item.characterDescription.toLowerCase() === characterDescription.toLowerCase() &&
          item.style.toLowerCase() === style.toLowerCase()
      );

      let updated: CharacterHistoryItem[];

      if (existingIndex >= 0) {
        // Update existing item
        updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          createdAt: Date.now(),
          usedCount: updated[existingIndex].usedCount + 1,
        };
      } else {
        // Add new item with collision-resistant id (Date.now alone collides
        // when two items are added within the same millisecond).
        const newItem: CharacterHistoryItem = {
          id: `char-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          characterDescription,
          style,
          createdAt: Date.now(),
          usedCount: 1,
        };
        updated = [newItem, ...prev];
      }

      // Sort by most recently used and limit items
      updated = updated
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, MAX_HISTORY_ITEMS);

      saveHistory(updated);
      return updated;
    });
  }, [saveHistory]);

  // Delete an item from history
  const deleteFromHistory = useCallback((id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      saveHistory(updated);
      return updated;
    });
  }, [saveHistory]);

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    history,
    isLoaded,
    addToHistory,
    deleteFromHistory,
    clearHistory,
  };
}
