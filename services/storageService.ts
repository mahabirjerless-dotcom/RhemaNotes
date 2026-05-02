import localforage from 'localforage';
import { SermonHistoryItem, SermonSummaryOutput, UserNote } from '../types';

const STORAGE_KEY = 'spiritscribe_history';

// Configure localforage to use IndexedDB primarily
localforage.config({
  name: 'SpiritScribe',
  storeName: 'sermons', // Should be alphanumeric, with underscores.
  description: 'Stores generated sermon histories and transcripts'
});

export const saveSermonToHistory = async (summary: SermonSummaryOutput): Promise<SermonHistoryItem> => {
  const history = await getSermonHistory();
  const newItem: SermonHistoryItem = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    summary,
  };
  
  const updatedHistory = [newItem, ...history];
  await localforage.setItem(STORAGE_KEY, updatedHistory);
  return newItem;
};

export const getSermonHistory = async (): Promise<SermonHistoryItem[]> => {
  try {
    const stored = await localforage.getItem<SermonHistoryItem[]>(STORAGE_KEY);
    return stored || [];
  } catch (e) {
    console.error('Failed to get history', e);
    return [];
  }
};

export const deleteSermonFromHistory = async (id: string): Promise<void> => {
  const history = await getSermonHistory();
  const updatedHistory = history.filter(item => item.id !== id);
  await localforage.setItem(STORAGE_KEY, updatedHistory);
};

export const updateSermonInHistory = async (id: string, summary: SermonSummaryOutput): Promise<void> => {
  const history = await getSermonHistory();
  const updatedHistory = history.map(item => 
    item.id === id ? { ...item, summary } : item
  );
  await localforage.setItem(STORAGE_KEY, updatedHistory);
};

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
