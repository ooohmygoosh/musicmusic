const tokenInput = document.getElementById("token");
const list = document.getElementById("songList");
const searchInput = document.getElementById("searchInput");
const availabilityFilter = document.getElementById("availabilityFilter");
const creatorTypeFilter = document.getElementById("creatorTypeFilter");
const sourceFilter = document.getElementById("sourceFilter");
const visibilityFilter = document.getElementById("visibilityFilter");
const tagFilter = document.getElementById("tagFilter");
const sortByFilter = document.getElementById("sortByFilter");
const sortDirFilter = document.getElementById("sortDirFilter");
const bulkDeleteButton = document.getElementById("bulkDeleteSongs");

const selectedSongIds = new Set();
const expandedSongIds = new Set();

function getToken() {
  return localStorage.getItem("adminToken") || "";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getOwnerLabel(item) {
  return item.owner_display_name || item.owner_account_id || (item.owner_user_id ? `User ${item.owner_user_id}` : "Unknown");
}

async function patchSong(songId, payload) {
  const res = await fetch(`/admin/library-songs/${songId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-admin-token": getToken() },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    alert(`Update failed: ${text || res.status}`);
    return false;
  }
  return true;
}

document.getElementById("saveToken").addEventListener("click", () => {
  localStorage.setItem("adminToken", tokenInput.value.trim());
  loadTagOptions().then(loadSongs);
});
document.getElementById("refreshSongs").addEventListener("click", () => loadTagOptions().then(loadSongs));
searchInput.addEventListener("input", loadSongs);
availabilityFilter.addEventListener("change", loadSongs);
creatorTypeFilter.addEventListener("change", loadSongs);
sourceFilter.addEventListener("change", loadSongs);
visibilityFilter.addEventListener("change", loadSongs);
tagFilter.addEventListener("change", loadSongs);
sortByFilter.addEventListener("change", loadSongs);
sortDirFilter.addEventListener("change", loadSongs);

async function loadTagOptions() {
  const res = await fetch("/admin/tags", { headers: { "x-admin-token": getToken() } });
  if (!res.ok) return;
  const data = await res.json().catch(() => ({}));
  const items = data.items || [];
  const grouped = new Map();
  for (const item of items) {
    const type = String(item.type || "Other");
    const list = grouped.get(type) || [];
    list.push(item);
    grouped.set(type, list);
  }

  const current = tagFilter.value;
  tagFilter.innerHTML = '<option value="">All tags</option>';
  Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0], "zh-CN")).forEach(([type, list]) => {
    const group = document.createElement("optgroup");
    group.label = type;
    list
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "zh-CN"))
      .forEach((item) => {
        const option = document.createElement("option");
        option.value = String(item.name || "");
        option.textContent = String(item.name || "");
        group.appendChild(option);
      });
    tagFilter.appendChild(group);
  });
  if (current) tagFilter.value = current;
}

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
    await loadTagOptions().then(loadSongs);
  });
}

function renderSongs(items) {
  list.innerHTML = "";
  if (!items || items.length === 0) {
    list.innerHTML = "<tr><td colspan='12' class='muted'>No library songs</td></tr>";
    return;
  }

  for (const item of items) {
    const songId = Number(item.id);
    const tr = document.createElement("tr");
    tr.className = "library-row";
    const isExpanded = expandedSongIds.has(songId);
    const isChecked = selectedSongIds.has(songId) ? "checked" : "";
    const ownerLabel = escapeHtml(getOwnerLabel(item));
    const tags = (item.tags || []).slice(0, 4).map(escapeHtml).join(" / ") || "-";
    const sourceLabel = escapeHtml(item.generation_source || "legacy");
    const statsLabel = `${item.deliveries || 0} / ${item.likes || 0} / ${item.reuse_count || 0}`;

    tr.innerHTML = `
      <td><button class="link detail-toggle" data-song-id="${songId}">${isExpanded ? "Hide" : "Open"}</button></td>
      <td><input type="checkbox" class="song-select" data-song-id="${songId}" ${isChecked} /></td>
      <td>${songId}</td>
      <td>${escapeHtml(formatDate(item.created_at))}</td>
      <td>${escapeHtml(item.title || "Untitled")}</td>
      <td class="table-tags">${tags}</td>
      <td>${ownerLabel}</td>
      <td>${sourceLabel}</td>
      <td><button class="chip-btn toggle-public ${item.is_public ? "is-on" : ""}" data-song-id="${songId}">${item.is_public ? "Public" : "Private"}</button></td>
      <td><button class="chip-btn toggle-available ${item.is_available ? "" : "is-off"}" data-song-id="${songId}">${item.is_available ? "Enabled" : "Disabled"}</button></td>
      <td>${escapeHtml(statsLabel)}</td>
      <td>
        <div class="table-actions">
          ${item.audio_url ? `<a class="link-button small" href="${escapeHtml(item.audio_url)}" target="_blank" rel="noreferrer">Audio</a>` : ""}
          <button class="ghost-btn small delete-song" data-song-id="${songId}">Delete</button>
        </div>
      </td>
    `;
    list.appendChild(tr);

    const detailTr = document.createElement("tr");
    detailTr.className = `library-detail-row${isExpanded ? " is-open" : ""}`;
    detailTr.innerHTML = `
      <td colspan="12">
        <div class="library-detail-card ${isExpanded ? "is-open" : ""}">
          <div class="detail-top">
            ${item.cover_url ? `<img class="cover-thumb detail-cover" src="${escapeHtml(item.cover_url)}" alt="cover" />` : ""}
            <div class="detail-columns">
              <div class="detail-grid compact">
                <div><strong>ID</strong><span>${songId}</span></div>
                <div><strong>Owner</strong><span>${ownerLabel}</span></div>
                <div><strong>Creator Type</strong><span>${escapeHtml(item.creator_type || "user")}</span></div>
                <div><strong>Source</strong><span>${sourceLabel}</span></div>
                <div><strong>Visibility</strong><span>${escapeHtml(item.visibility_scope || "private")}</span></div>
                <div><strong>Publish</strong><span>${escapeHtml(item.publish_status || "draft")}</span></div>
                <div><strong>Revenue</strong><span>${item.revenue_enabled ? "Enabled" : "Disabled"}</span></div>
                <div><strong>Official Fallback</strong><span>${item.official_fallback ? "Yes" : "No"}</span></div>
                <div><strong>Deliveries</strong><span>${item.deliveries || 0}</span></div>
                <div><strong>Likes</strong><span>${item.likes || 0}</span></div>
                <div><strong>Skips</strong><span>${item.skips || 0}</span></div>
                <div><strong>Reuse</strong><span>${item.reuse_count || 0}</span></div>
              </div>
              <div class="detail-section">
                <div class="library-prompt-label">Tags</div>
                <div class="pill-row">${(item.tags || []).map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("") || "<span class='muted'>No tags</span>"}</div>
              </div>
              <div class="detail-section">
                <div class="library-prompt-label">TPY Prompt</div>
                <div class="muted library-prompt">${escapeHtml(item.prompt || "No prompt")}</div>
              </div>
              <div class="detail-section">
                <div class="library-prompt-label">Base Prompt</div>
                <div class="muted library-prompt">${escapeHtml(item.base_prompt || item.prompt || "No base prompt")}</div>
              </div>
            </div>
          </div>
        </div>
      </td>
    `;
    list.appendChild(detailTr);

    tr.querySelector(".song-select").addEventListener("change", (event) => {
      if (event.target.checked) selectedSongIds.add(songId);
      else selectedSongIds.delete(songId);
    });

    tr.querySelector(".detail-toggle").addEventListener("click", () => {
      if (expandedSongIds.has(songId)) expandedSongIds.delete(songId);
      else expandedSongIds.add(songId);
      renderSongs(items);
    });

    tr.querySelector(".toggle-public").addEventListener("click", async () => {
      const ok = await patchSong(songId, { is_public: !item.is_public });
      if (ok) loadSongs();
    });

    tr.querySelector(".toggle-available").addEventListener("click", async () => {
      const ok = await patchSong(songId, { is_available: !item.is_available });
      if (ok) loadSongs();
    });

    tr.querySelector(".delete-song").addEventListener("click", async () => {
      const ok = confirm(`Delete song ${songId} permanently?`);
      if (!ok) return;
      const res = await fetch("/admin/library-songs/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": getToken() },
        body: JSON.stringify({ song_ids: [songId] })
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        alert(`Delete failed: ${text || res.status}`);
        return;
      }
      selectedSongIds.delete(songId);
      expandedSongIds.delete(songId);
      await loadSongs();
    });
  }
}

async function loadSongs() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set("q", searchInput.value.trim());
  if (availabilityFilter.value) params.set("available", availabilityFilter.value);
  if (creatorTypeFilter.value) params.set("creator_type", creatorTypeFilter.value);
  if (sourceFilter.value) params.set("generation_source", sourceFilter.value);
  if (visibilityFilter.value) params.set("visibility_scope", visibilityFilter.value);
  if (tagFilter.value) params.set("tag_name", tagFilter.value);
  if (sortByFilter.value) params.set("sort_by", sortByFilter.value);
  if (sortDirFilter.value) params.set("sort_dir", sortDirFilter.value);
  const query = params.toString();

  const res = await fetch(`/admin/library-songs${query ? `?${query}` : ""}`, {
    headers: { "x-admin-token": getToken() }
  });

  if (!res.ok) {
    list.innerHTML = "<tr><td colspan='12' class='muted'>Unauthorized or service unavailable</td></tr>";
    return;
  }

  const data = await res.json();
  renderSongs(data.items || []);
}

tokenInput.value = getToken();
loadSongs();
