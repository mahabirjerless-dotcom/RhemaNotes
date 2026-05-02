import localforage from 'localforage';
import { SermonHistoryItem, SermonSummaryOutput, UserNote } from '../types';

const STORAGE_KEY = 'spiritscribe_history';
const API_BASE = '/api/sermons';

// Configure localforage to use IndexedDB primarily
localforage.config({
  name: 'SpiritScribe',
  storeName: 'sermons',
  description: 'Stores generated sermon histories and transcripts'
});

/**
 * Saves a sermon to both local storage (IndexedDB) and the D1 cloud database.
 */
export const saveSermonToHistory = async (summary: SermonSummaryOutput): Promise<SermonHistoryItem> => {
  const newItem: SermonHistoryItem = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    summary,
  };

  // 1. Save locally first (Instant feedback & Offline support)
  const history = await getSermonHistory();
  const updatedHistory = [newItem, ...history];
  await localforage.setItem(STORAGE_KEY, updatedHistory);

  // 2. Attempt to sync to Cloudflare D1
  try {
    await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newItem.id,
        user_id: 'guest', // Replace with real auth user ID when available
        title: summary.title,
        main_topic: summary.main_topic,
        clean_transcript: summary.clean_transcript,
        source_type: 'text' // Logic to determine type can be added here
      })
    });
  } catch (e) {
    console.warn('D1 Sync failed, item remains in local storage.', e);
  }
  
  return newItem;
};

/**
 * Fetches sermon history. Synchronizes local storage with the D1 cloud database.
 */
export const getSermonHistory = async (): Promise<SermonHistoryItem[]> => {
  try {
    // 1. Fetch from cloud
    const response = await fetch(API_BASE);
    if (response.ok) {
      const cloudSermons: any[] = await response.json();
      
      // Map D1 rows back to SermonHistoryItem format
      const formatted: SermonHistoryItem[] = cloudSermons.map(s => ({
        id: s.id,
        timestamp: new Date(s.created_at).getTime(),
        summary: {
          title: s.title,
          main_topic: s.main_topic,
          clean_transcript: s.clean_transcript,
          // Note: Full JSON blobs (scriptures, etc) would need separate tables 
          // or JSON parsing if stored as text. For now, we sync the core metadata.
          scriptures: [], 
          key_points: [],
          quotes: [],
          applications: [],
          open_questions: [],
          actionable_insights: [],
        }
      }));

      // 2. Update local cache
      if (formatted.length > 0) {
        await localforage.setItem(STORAGE_KEY, formatted);
        return formatted;
      }
    }
  } catch (e) {
    console.warn('D1 fetch failed, falling back to local storage.', e);
  }

  // 3. Fallback to local storage
  const stored = await localforage.getItem<SermonHistoryItem[]>(STORAGE_KEY);
  return stored || [];
};

export const deleteSermonFromHistory = async (id: string): Promise<void> => {
  // 1. Remove locally
  const history = await getSermonHistory();
  const updatedHistory = history.filter(item => item.id !== id);
  await localforage.setItem(STORAGE_KEY, updatedHistory);

  // 2. Remove from cloud
  try {
    await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
  } catch (e) {
    console.warn('D1 Delete failed, sync will happen later.', e);
  }
};

export const updateSermonInHistory = async (id: string, summary: SermonSummaryOutput): Promise<void> => {
  // 1. Update locally
  const history = await getSermonHistory();
  const updatedHistory = history.map(item => 
    item.id === id ? { ...item, summary } : item
  );
  await localforage.setItem(STORAGE_KEY, updatedHistory);

  // 2. Update in cloud
  try {
    await fetch(`${API_BASE}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: summary.title,
        main_topic: summary.main_topic,
        clean_transcript: summary.clean_transcript
      })
    });
  } catch (e) {
    console.warn('D1 Update failed.', e);
  }
};

// ── Live Drafts (Local Only) ──────────────────────────────────────────────────

const DRAFT_KEY = 'spiritscribe_live_draft';
export const saveLiveDraft = async (notes: UserNote[]): Promise<void> => {
  await localforage.setItem(DRAFT_KEY, notes);
};
export const getLiveDraft = async (): Promise<UserNote[]> => {
  const stored = await localforage.getItem<UserNote[]>(DRAFT_KEY);
  return stored || [];
};
export const clearLiveDraft = async (): Promise<void> => {
  await localforage.removeItem(DRAFT_KEY);
};
export const clearHistory = async (): Promise<void> => {
  await localforage.removeItem(STORAGE_KEY);
};
