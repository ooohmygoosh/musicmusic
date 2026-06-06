import { useCallback, useState } from "react";
import {
  listFavorites,
  listMySongs,
  listSongHistory
} from "../services/apiClient";

export function useSongLibrary(userId) {
  const [songs, setSongs] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [mySongs, setMySongs] = useState([]);

  const refreshSongHistory = useCallback(async (targetUserId = userId) => {
    if (!targetUserId) return [];
    const data = await listSongHistory(targetUserId);
    const items = Array.isArray(data.items) ? data.items : [];
    setSongs(items);
    return items;
  }, [userId]);

  const refreshFavorites = useCallback(async (targetUserId = userId) => {
    if (!targetUserId) return [];
    const data = await listFavorites(targetUserId);
    const items = data.items || [];
    setFavorites(items);
    return items;
  }, [userId]);

  const refreshMySongs = useCallback(async (targetUserId = userId) => {
    if (!targetUserId) return [];
    const data = await listMySongs(targetUserId);
    const items = data.items || [];
    setMySongs(items);
    return items;
  }, [userId]);

  const reset = useCallback(() => {
    setSongs([]);
    setFavorites([]);
    setMySongs([]);
  }, []);

  return {
    favorites,
    mySongs,
    refreshFavorites,
    refreshMySongs,
    refreshSongHistory,
    reset,
    songs
  };
}
