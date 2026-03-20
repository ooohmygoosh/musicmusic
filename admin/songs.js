const tokenInput = document.getElementById("token");
const list = document.getElementById("songList");
const searchInput = document.getElementById("searchInput");
const availabilityFilter = document.getElementById("availabilityFilter");
const typeFilter = document.getElementById("typeFilter");
const songSelectionHint = document.getElementById("songSelectionHint");
const selectedSongIds = new Set();

function getToken() {
  return localStorage.getItem("adminToken") || "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function updateSelectionHint() {
  songSelectionHint.textContent = `${selectedSongIds.size} songs selected`;
}

async function toggleAvailability(songId, isAvailable) {
  const res = await fetch(`/admin/library-songs/${songId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-admin-token": getToken() },
    body: JSON.stringify({ is_available: !isAvailable })
  });
  if (!res.ok) {
    alert("Update failed. Check token or service status.");
    return;
  }
  await loadSongs();
}

async function deleteSelectedSongs() {
  const ids = [...selectedSongIds];
  if (!ids.length) {
    alert("Select songs first.");
    return;
  }
  if (!confirm(`Delete ${ids.length} selected songs? This also removes related delivery records.`)) return;
  const res = await fetch("/admin/library-songs/batch-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": getToken() },
    body: JSON.stringify({ ids })
  });
  if (!res.ok) {
    alert("Batch delete failed.");
    return;
  }
  selectedSongIds.clear();
  updateSelectionHint();
  await loadSongs();
}

function renderSongs(items) {
  list.innerHTML = "";
  if (!items || items.length === 0) {
    list.innerHTML = "<div class='muted'>No songs found</div>";
    updateSelectionHint();
    return;
  }

  const liveIds = new Set(items.map((item) => Number(item.id)));
  [...selectedSongIds].forEach((id) => {
    if (!liveIds.has(id)) selectedSongIds.delete(id);
  });

  for (const item of items) {
    const card = document.createElement("div");
    card.className = "item library-item";
    const checked = selectedSongIds.has(Number(item.id)) ? "checked" : "";
    const tags = (item.tags || []).map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("");
    const types = (item.tag_types || []).map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("");
    card.innerHTML = `
      <div class="library-select">
        <input type="checkbox" data-select="${item.id}" ${checked} />
      </div>
      <div class="library-main">
        <div class="row library-head">
          <div>
            <div class="library-title">${escapeHtml(item.title || "Untitled")}</div>
            <div class="muted">${escapeHtml(item.model || "Unknown model")} ， ${Number(item.duration || 0)}s ， ${escapeHtml(item.primary_type || "Uncategorized")} ， ${item.is_available ? "Available" : "Disabled"}</div>
            <div class="muted">Creator: ${escapeHtml(item.creator_name || `User ${item.creator_user_id || "-"}`)} ， ${item.created_at ? new Date(item.created_at).toLocaleString() : "-"} ， ${escapeHtml(item.generation_mode || "generated")}</div>
          </div>
          ${item.cover_url ? `<img class="cover-thumb" src="${escapeHtml(item.cover_url)}" alt="cover" />` : ""}
        </div>
        <div class="library-prompts">
          <div class="library-prompt-block">
            <div class="library-prompt-label">Prompt sent to generator</div>
            <div class="muted library-prompt">${escapeHtml(item.prompt || "-")}</div>
          </div>
          <div class="library-prompt-block">
            <div class="library-prompt-label">Base prompt</div>
            <div class="muted library-prompt">${escapeHtml(item.base_prompt || item.prompt || "-")}</div>
          </div>
        </div>
        <div class="pill-row">${types}${tags || "<span class='muted'>No tags</span>"}</div>
        <div class="meta-grid">
          <div><strong>Deliveries</strong><span>${Number(item.deliveries || 0)}</span></div>
          <div><strong>Reuse</strong><span>${Number(item.reuse_count || 0)}</span></div>
          <div><strong>Likes</strong><span>${Number(item.likes || 0)}</span></div>
          <div><strong>Skips</strong><span>${Number(item.skips || 0)}</span></div>
          <div><strong>Copies</strong><span>${Number(item.copies || 0)}</span></div>
        </div>
        <div class="row">
          ${item.audio_url ? `<a class="link-button" href="${escapeHtml(item.audio_url)}" target="_blank" rel="noreferrer">Preview Audio</a>` : ""}
          <button class="ghost-btn" data-toggle="${item.id}">${item.is_available ? "Disable Reuse" : "Enable Reuse"}</button>
        </div>
      </div>
    `;
    card.querySelector(`[data-toggle="${item.id}"]`).addEventListener("click", () => toggleAvailability(item.id, item.is_available));
    card.querySelector(`[data-select="${item.id}"]`).addEventListener("change", (event) => {
      if (event.target.checked) {
        selectedSongIds.add(Number(item.id));
      } else {
        selectedSongIds.delete(Number(item.id));
      }
      updateSelectionHint();
    });
    list.appendChild(card);
  }

  updateSelectionHint();
}

async function loadSongs() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set("q", searchInput.value.trim());
  if (availabilityFilter.value) params.set("available", availabilityFilter.value);
  if (typeFilter.value) params.set("type", typeFilter.value);
  const query = params.toString();
  const res = await fetch(`/admin/library-songs${query ? `?${query}` : ""}`, { headers: { "x-admin-token": getToken() } });
  if (!res.ok) {
    list.innerHTML = "<div class='muted'>Unauthorized or service unavailable</div>";
    return;
  }
  const data = await res.json();
  renderSongs(data.items || []);
}

document.getElementById("saveToken").addEventListener("click", () => {
  localStorage.setItem("adminToken", tokenInput.value.trim());
  loadSongs();
});
document.getElementById("refreshSongs").addEventListener("click", loadSongs);
document.getElementById("deleteSelected").addEventListener("click", deleteSelectedSongs);
document.getElementById("clearSelection").addEventListener("click", () => {
  selectedSongIds.clear();
  updateSelectionHint();
  loadSongs();
});
searchInput.addEventListener("input", loadSongs);
availabilityFilter.addEventListener("change", loadSongs);
typeFilter.addEventListener("change", loadSongs);

tokenInput.value = getToken();
updateSelectionHint();
loadSongs();
