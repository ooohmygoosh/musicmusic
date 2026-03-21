const tokenInput = document.getElementById("token");
const list = document.getElementById("songList");
const searchInput = document.getElementById("searchInput");
const availabilityFilter = document.getElementById("availabilityFilter");
const typeFilter = document.getElementById("typeFilter");
const bulkDeleteButton = document.getElementById("bulkDeleteSongs");

const selectedSongIds = new Set();

function getToken() {
  return localStorage.getItem("adminToken") || "";
}

document.getElementById("saveToken").addEventListener("click", () => {
  localStorage.setItem("adminToken", tokenInput.value.trim());
  loadSongs();
});
document.getElementById("refreshSongs").addEventListener("click", loadSongs);
searchInput.addEventListener("input", loadSongs);
availabilityFilter.addEventListener("change", loadSongs);
typeFilter.addEventListener("change", loadSongs);

if (bulkDeleteButton) {
  bulkDeleteButton.addEventListener("click", async () => {
    const ids = [...selectedSongIds];
    if (ids.length === 0) {
      alert("Please select songs to delete first.");
      return;
    }
    const ok = confirm(`Delete ${ids.length} songs permanently? This will remove local files and delete all related records.`);
    if (!ok) return;

    const res = await fetch("/admin/library-songs/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": getToken() },
      body: JSON.stringify({ song_ids: ids })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      alert(`Bulk delete failed: ${text || res.status}`);
      return;
    }

    const data = await res.json().catch(() => ({}));
    alert(`Done. songs=${data.affected || 0}, files_deleted=${data.files_deleted || 0}`);
    selectedSongIds.clear();
    await loadSongs();
  });
}

async function toggleAvailability(songId, isAvailable) {
  const res = await fetch(`/admin/library-songs/${songId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-admin-token": getToken() },
    body: JSON.stringify({ is_available: !isAvailable })
  });
  if (!res.ok) {
    alert("Update failed. Check token/server status.");
    return;
  }
  await loadSongs();
}

function renderSongs(items) {
  list.innerHTML = "";
  if (!items || items.length === 0) {
    list.innerHTML = "<div class='muted'>No library songs</div>";
    return;
  }

  for (const item of items) {
    const songId = Number(item.id);
    const card = document.createElement("div");
    card.className = "item library-item";
    const tags = (item.tags || []).map((tag) => `<span class="pill">${tag}</span>`).join("");
    const types = (item.tag_types || []).map((tag) => `<span class="pill">${tag}</span>`).join("");
    const checked = selectedSongIds.has(songId) ? "checked" : "";

    card.innerHTML = `
      <div class="library-main">
        <div class="row between">
          <label class="row" style="gap:8px;align-items:center;cursor:pointer;">
            <input type="checkbox" class="song-select" data-song-id="${songId}" ${checked} />
            <span class="muted">Select</span>
          </label>
        </div>
        <div class="row library-head">
          <div>
            <div class="library-title">${item.title || "Untitled"}</div>
            <div class="muted">${item.model || "Unknown model"} ¡¤ ${item.duration || 0}s ¡¤ ${item.primary_type || "Uncategorized"} ¡¤ ${item.is_available ? "Enabled" : "Disabled"}</div>
          </div>
          ${item.cover_url ? `<img class="cover-thumb" src="${item.cover_url}" alt="cover" />` : ""}
        </div>
        <div class="library-prompts">
          <div class="library-prompt-block">
            <div class="library-prompt-label">TPY Prompt</div>
            <div class="muted library-prompt">${item.prompt || "No prompt"}</div>
          </div>
          <div class="library-prompt-block">
            <div class="library-prompt-label">Base Prompt</div>
            <div class="muted library-prompt">${item.base_prompt || item.prompt || "No base prompt"}</div>
          </div>
        </div>
        <div class="pill-row">${types}${tags || "<span class='muted'>No tags</span>"}</div>
        <div class="meta-grid">
          <div><strong>Deliveries</strong><span>${item.deliveries || 0}</span></div>
          <div><strong>Reuse</strong><span>${item.reuse_count || 0}</span></div>
          <div><strong>Likes</strong><span>${item.likes || 0}</span></div>
          <div><strong>Skips</strong><span>${item.skips || 0}</span></div>
        </div>
        <div class="row">
          ${item.audio_url ? `<a class="link-button" href="${item.audio_url}" target="_blank" rel="noreferrer">Preview audio</a>` : ""}
          <button class="ghost-btn">${item.is_available ? "Disable reuse" : "Enable reuse"}</button>
        </div>
      </div>
    `;

    const checkbox = card.querySelector(".song-select");
    checkbox.addEventListener("change", (event) => {
      if (event.target.checked) selectedSongIds.add(songId);
      else selectedSongIds.delete(songId);
    });

    card.querySelector(".ghost-btn").addEventListener("click", () => toggleAvailability(songId, item.is_available));
    list.appendChild(card);
  }
}

async function loadSongs() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set("q", searchInput.value.trim());
  if (availabilityFilter.value) params.set("available", availabilityFilter.value);
  if (typeFilter.value) params.set("type", typeFilter.value);
  const query = params.toString();

  const res = await fetch(`/admin/library-songs${query ? `?${query}` : ""}`, {
    headers: { "x-admin-token": getToken() }
  });

  if (!res.ok) {
    list.innerHTML = "<div class='muted'>Unauthorized or service unavailable</div>";
    return;
  }

  const data = await res.json();
  renderSongs(data.items || []);
}

tokenInput.value = getToken();
loadSongs();