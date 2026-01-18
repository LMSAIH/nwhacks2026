import { useState, useCallback } from 'react'

const STORAGE_KEY = 'omni-search-history'
const MAX_HISTORY_ITEMS = 10

function loadHistoryFromStorage(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error('Failed to load search history:', e)
  }
  return []
}

export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>(loadHistoryFromStorage)

  // Save history to localStorage
  const saveHistory = useCallback((newHistory: string[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory))
    } catch (e) {
      console.error('Failed to save search history:', e)
    }
  }, [])

  // Add a search term to history
  const addToHistory = useCallback((term: string) => {
    if (!term.trim()) return

    setHistory(prev => {
      // Remove duplicates and add new term at the beginning
      const filtered = prev.filter(item => item.toLowerCase() !== term.toLowerCase())
      const newHistory = [term, ...filtered].slice(0, MAX_HISTORY_ITEMS)
      saveHistory(newHistory)
      return newHistory
    })
  }, [saveHistory])

  // Remove a specific item from history
  const removeFromHistory = useCallback((term: string) => {
    setHistory(prev => {
      const newHistory = prev.filter(item => item !== term)
      saveHistory(newHistory)
      return newHistory
    })
  }, [saveHistory])

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory([])
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory
  }
}
