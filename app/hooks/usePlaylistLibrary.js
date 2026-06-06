import { useCallback, useState } from "react";
import {
  addPlaylistSong,
  createPlaylist,
  listPlaylistSongs,
  listPlaylists
} from "../services/apiClient";

export function usePlaylistLibrary(userId) {
  const [playlists, setPlaylists] = useState([]);
  const [playlistSongsMap, setPlaylistSongsMap] = useState({});
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  const loadPlaylists = useCallback(async (targetUserId = userId) => {
    if (!targetUserId) return [];
    const data = await listPlaylists(targetUserId);
    const items = data.items || [];
    setPlaylists(items);
    return items;
  }, [userId]);

  const loadPlaylistSongs = useCallback(async (playlistId) => {
    if (!playlistId) return [];
    const data = await listPlaylistSongs(playlistId);
    const items = data.items || [];
    setPlaylistSongsMap((prev) => ({ ...prev, [playlistId]: items }));
    return items;
  }, []);

  const createNamedPlaylist = useCallback(async () => {
    const name = newPlaylistName.trim();
    if (!userId || !name) return [];
    await createPlaylist(userId, name);
    setNewPlaylistName("");
    return loadPlaylists(userId);
  }, [loadPlaylists, newPlaylistName, userId]);

  const addSongToPlaylist = useCallback(async (playlistId, song) => {
    if (!song || !playlistId) return null;
    const result = await addPlaylistSong(playlistId, song.id);
    const updated = await loadPlaylistSongs(playlistId);
    return { result, updated };
  }, [loadPlaylistSongs]);

  const reset = useCallback(() => {
    setPlaylists([]);
    setPlaylistSongsMap({});
    setSelectedPlaylistId(null);
    setNewPlaylistName("");
  }, []);

  return {
    addSongToPlaylist,
    createPlaylist: createNamedPlaylist,
    loadPlaylistSongs,
    loadPlaylists,
    newPlaylistName,
    playlistSongsMap,
    playlists,
    reset,
    selectedPlaylistId,
    setNewPlaylistName,
    setSelectedPlaylistId
  };
}
