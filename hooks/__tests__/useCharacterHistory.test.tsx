import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useCharacterHistory } from '../useCharacterHistory';

const STORAGE_KEY = 'emoticon-studio-character-history';

describe('useCharacterHistory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('starts empty on first load', async () => {
    const { result } = renderHook(() => useCharacterHistory());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.history).toEqual([]);
  });

  it('adds a new character entry', async () => {
    const { result } = renderHook(() => useCharacterHistory());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.addToHistory('빨간 나비넥타이 노란 오리', 'Sticker, Flat');
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].characterDescription).toBe(
      '빨간 나비넥타이 노란 오리'
    );
    expect(result.current.history[0].usedCount).toBe(1);
  });

  it('does not add blank descriptions', async () => {
    const { result } = renderHook(() => useCharacterHistory());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.addToHistory('   ', 'Flat');
    });

    expect(result.current.history).toHaveLength(0);
  });

  it('increments usedCount when same character is added', async () => {
    const { result } = renderHook(() => useCharacterHistory());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.addToHistory('Cat', 'Flat');
      result.current.addToHistory('cat', 'flat');
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].usedCount).toBe(2);
  });

  it('persists to localStorage', async () => {
    const { result } = renderHook(() => useCharacterHistory());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.addToHistory('Dog', 'Flat');
    });

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw as string);
    expect(stored).toHaveLength(1);
    expect(stored[0].characterDescription).toBe('Dog');
  });

  it('deletes a single entry', async () => {
    const { result } = renderHook(() => useCharacterHistory());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.addToHistory('Cat', 'Flat');
      result.current.addToHistory('Dog', 'Flat');
    });

    const dogId = result.current.history.find(
      (h) => h.characterDescription === 'Dog'
    )?.id;
    expect(dogId).toBeDefined();

    act(() => {
      result.current.deleteFromHistory(dogId as string);
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].characterDescription).toBe('Cat');
  });

  it('clears all entries', async () => {
    const { result } = renderHook(() => useCharacterHistory());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.addToHistory('A', 'flat');
      result.current.addToHistory('B', 'flat');
    });

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.history).toHaveLength(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
