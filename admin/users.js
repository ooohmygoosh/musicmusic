const tokenInput = document.getElementById("token");
const userSummaryCards = document.getElementById("userSummaryCards");
const userTable = document.getElementById("userTable");
const userInfo = document.getElementById("userInfo");
const userMetrics = document.getElementById("userMetrics");
const userFavorites = document.getElementById("userFavorites");
const userSongs = document.getElementById("userSongs");
const userCreatedSongs = document.getElementById("userCreatedSongs");
const userTags = document.getElementById("userTags");
const userDetailTitle = document.getElementById("userDetailTitle");

let selectedUserId = null;

function getToken() {
  return localStorage.getItem("adminToken") || "";
}

function renderTable(container, headers, rows) {
  if (!rows || rows.length === 0) {
    container.innerHTML = "<div class='muted'>No data</div>";
    return;
  }
  const table = document.createElement("table");
  table.innerHTML = `
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
  `;
  container.innerHTML = "";
  container.appendChild(table);
}

function renderSummary(items) {
  const total = items.length;
  const active = items.filter((item) => item.is_active !== false).length;
  const withTags = items.filter((item) => Number(item.active_tag_count || 0) > 0).length;
  const creators = items.filter((item) => Number(item.created_song_count || 0) > 0).length;
  const estimatedIncome = items.reduce((sum, item) => sum + Number(item.estimated_income || 0), 0).toFixed(2);
  userSummaryCards.innerHTML = "";
  [
    ["Accounts", total],
    ["Active", active],
    ["Profiled", withTags],
    ["Creators", creators],
    ["Estimated Income", estimatedIncome]
  ].forEach(([label, value]) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `<div class="stat-label">${label}</div><div class="stat-value">${value}</div>`;
    userSummaryCards.appendChild(card);
  });
}

function renderMetricCards(metrics) {
  userMetrics.innerHTML = "";
  [
    ["Queue Songs", metrics.queued_song_count || 0],
    ["Playlists", metrics.playlist_count || 0],
    ["User Likes", metrics.like_count || 0],
    ["User Skips", metrics.skip_count || 0],
    ["Active Tags", metrics.active_tag_count || 0],
    ["Generation Jobs", metrics.generation_job_count || 0],
    ["Created Songs", metrics.created_song_count || 0],
    ["Deliveries", metrics.creator_delivery_count || 0],
    ["Creator Likes", metrics.creator_like_count || 0],
    ["Estimated Income", Number(metrics.estimated_income || 0).toFixed(2)]
  ].forEach(([label, value]) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `<div class="stat-label">${label}</div><div class="stat-value">${value}</div>`;
    userMetrics.appendChild(card);
  });
}

async function loadUsers() {
  const res = await fetch("/admin/user-summary", { headers: { "x-admin-token": getToken() } });
  if (!res.ok) {
    userSummaryCards.innerHTML = "";
    userTable.innerHTML = "<div class='muted'>Unauthorized or service unavailable</div>";
    return;
  }
  const data = await res.json();
  const items = data.items || [];
  renderSummary(items);
  const rows = items.map((user) => [
    `<button class='link' data-user='${user.id}'>${user.display_name || user.account_id || user.device_id || `User ${user.id}`}</button>`,
    user.account_id || "-",
    user.device_id || "-",
    user.has_password ? "Set" : "Not set",
    new Date(user.created_at).toLocaleString(),
    user.last_seen_at ? new Date(user.last_seen_at).toLocaleString() : "-",
    Number(user.active_tag_count || 0),
    Number(user.created_song_count || 0),
    Number(user.creator_like_count || 0),
    Number(user.estimated_income || 0).toFixed(2),
    user.is_active === false ? "Disabled" : "Active"
  ]);
  renderTable(userTable, ["Account", "Account ID", "Device ID", "Password", "Created At", "Last Seen", "Tags", "Created Songs", "Creator Likes", "Est. Income", "Status"], rows);

  userTable.querySelectorAll("button[data-user]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedUserId = btn.dataset.user;
      userDetailTitle.textContent = `Account Detail: ${btn.textContent}`;
      loadUserDetail(selectedUserId);
    });
  });
}

async function loadUserDetail(userId) {
  const res = await fetch(`/admin/user-detail?user_id=${userId}`, { headers: { "x-admin-token": getToken() } });
  if (!res.ok) {
    userInfo.innerHTML = "<div class='muted'>Unauthorized or service unavailable</div>";
    userMetrics.innerHTML = "";
    userFavorites.innerHTML = "";
    userSongs.innerHTML = "";
    userCreatedSongs.innerHTML = "";
    userTags.innerHTML = "";
    return;
  }
  const data = await res.json();
  const user = data.user || {};
  const metrics = data.metrics || {};

  userInfo.innerHTML = `
    <div class="stat-card"><div class="stat-label">Display Name</div><div class="stat-value small">${user.display_name || user.account_id || user.device_id || `User ${user.id}`}</div></div>
    <div class="stat-card"><div class="stat-label">Account ID</div><div class="stat-value small">${user.account_id || "-"}</div></div>
    <div class="stat-card"><div class="stat-label">Device ID</div><div class="stat-value small">${user.device_id || "-"}</div></div>
    <div class="stat-card"><div class="stat-label">Avatar</div><div class="stat-value small">${user.avatar || "-"}</div></div>
    <div class="stat-card"><div class="stat-label">Password</div><div class="stat-value small">${user.has_password ? "Set" : "Not set"}</div></div>
    <div class="stat-card"><div class="stat-label">Created At</div><div class="stat-value small">${user.created_at ? new Date(user.created_at).toLocaleString() : "-"}</div></div>
    <div class="stat-card"><div class="stat-label">Last Seen</div><div class="stat-value small">${user.last_seen_at ? new Date(user.last_seen_at).toLocaleString() : "-"}</div></div>
    <div class="stat-card"><div class="stat-label">Status</div><div class="stat-value small">${user.is_active === false ? "Disabled" : "Active"}</div></div>
  `;

  renderMetricCards(metrics);

  const favoriteRows = (data.favorites || []).map((item) => [
    item.title || `Song ${item.song_id}`,
    (item.playlists || []).join(" / ") || "-",
    (item.tags || []).join(" / ") || "-"
  ]);
  renderTable(userFavorites, ["Song", "Playlist", "Tags"], favoriteRows);

  const songRows = (data.queue_history || data.songs || []).map((item) => [
    item.title || `Song ${item.song_id}`,
    item.source || "generated",
    (item.tags || []).join(" / ") || "-"
  ]);
  renderTable(userSongs, ["Song", "Source", "Tags"], songRows);

  const createdSongRows = (data.created_songs || []).map((item) => [
    item.title || `Song ${item.id}`,
    Number(item.deliveries || 0),
    Number(item.likes || 0),
    (item.tags || []).join(" / ") || "-"
  ]);
  renderTable(userCreatedSongs, ["Song", "Deliveries", "Likes", "Tags"], createdSongRows);

  const detailTagWeights = data.tag_weights || [];
  const tagRows = detailTagWeights.map((item) => [
    item.name || "-",
    item.type || "-",
    Number(item.weight || 0).toFixed(6),
    item.last_updated ? new Date(item.last_updated).toLocaleString() : "-"
  ]);
  renderTable(userTags, ["Tag", "Type", "Weight", "Updated"], tagRows);
}

document.getElementById("saveToken").addEventListener("click", () => {
  localStorage.setItem("adminToken", tokenInput.value.trim());
  loadUsers();
});

document.getElementById("refreshUsers").addEventListener("click", loadUsers);
document.getElementById("refreshUserDetail").addEventListener("click", () => {
  if (selectedUserId) loadUserDetail(selectedUserId);
});

tokenInput.value = getToken();
loadUsers();
