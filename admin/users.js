const tokenInput = document.getElementById("token");
const userSummaryCards = document.getElementById("userSummaryCards");
const userTable = document.getElementById("userTable");
const userInfo = document.getElementById("userInfo");
const userFavorites = document.getElementById("userFavorites");
const userSongs = document.getElementById("userSongs");
const userTags = document.getElementById("userTags");
const userDetailTitle = document.getElementById("userDetailTitle");

let selectedUserId = null;

function getToken() {
  return localStorage.getItem("adminToken") || "";
}

function renderTable(container, headers, rows) {
  if (!rows || rows.length === 0) {
    container.innerHTML = "<div class='muted'>暂无数据</div>";
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
  const withQueues = items.reduce((sum, item) => sum + Number(item.queued_songs || 0), 0);
  userSummaryCards.innerHTML = "";
  [
    ["账户总数", total],
    ["启用账户", active],
    ["已形成画像", withTags],
    ["待播放队列", withQueues]
  ].forEach(([label, value]) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `<div class="stat-label">${label}</div><div class="stat-value">${value}</div>`;
    userSummaryCards.appendChild(card);
  });
}

async function loadUsers() {
  const res = await fetch("/admin/user-summary", { headers: { "x-admin-token": getToken() } });
  if (!res.ok) {
    userSummaryCards.innerHTML = "";
    userTable.innerHTML = "<div class='muted'>未授权或服务未启动</div>";
    return;
  }
  const data = await res.json();
  const items = data.items || [];
  renderSummary(items);
  const rows = items.map((user) => [
    `<button class='link' data-user='${user.id}'>${user.display_name || user.device_id || `用户 ${user.id}`}</button>`,
    user.device_id || "-",
    new Date(user.created_at).toLocaleString(),
    user.last_seen_at ? new Date(user.last_seen_at).toLocaleString() : "-",
    Number(user.active_tag_count || 0),
    Number(user.playlist_count || 0),
    Number(user.like_count || 0),
    Number(user.skip_count || 0),
    Number(user.queued_songs || 0),
    user.is_active === false ? "已停用" : "正常"
  ]);
  renderTable(userTable, ["账户", "设备ID", "注册时间", "最近活跃", "画像标签", "歌单", "收藏", "跳过", "队列", "状态"], rows);

  userTable.querySelectorAll("button[data-user]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedUserId = btn.dataset.user;
      userDetailTitle.textContent = `账户 ${btn.textContent} 详情`;
      loadUserDetail(selectedUserId);
    });
  });
}

async function loadUserDetail(userId) {
  const res = await fetch(`/admin/user-detail?user_id=${userId}`, { headers: { "x-admin-token": getToken() } });
  if (!res.ok) {
    userInfo.innerHTML = "<div class='muted'>未授权或服务未启动</div>";
    userFavorites.innerHTML = "";
    userSongs.innerHTML = "";
    userTags.innerHTML = "";
    return;
  }
  const data = await res.json();
  const user = data.user || {};

  userInfo.innerHTML = `
    <div class="stat-card"><div class="stat-label">显示名称</div><div class="stat-value small">${user.display_name || user.device_id || `用户 ${user.id}`}</div></div>
    <div class="stat-card"><div class="stat-label">账户 ID</div><div class="stat-value small">${user.device_id || "-"}</div></div>
    <div class="stat-card"><div class="stat-label">注册时间</div><div class="stat-value small">${user.created_at ? new Date(user.created_at).toLocaleString() : "-"}</div></div>
    <div class="stat-card"><div class="stat-label">最近活跃</div><div class="stat-value small">${user.last_seen_at ? new Date(user.last_seen_at).toLocaleString() : "-"}</div></div>
    <div class="stat-card"><div class="stat-label">状态</div><div class="stat-value small">${user.is_active === false ? "已停用" : "正常"}</div></div>
  `;

  const favoriteRows = (data.favorites || []).map((item) => [
    item.title || `歌曲 ${item.song_id}`,
    (item.playlists || []).join(" / ") || "-",
    (item.tags || []).join(" / ") || "-"
  ]);
  renderTable(userFavorites, ["歌曲名称", "歌单", "标签"], favoriteRows);

  const songRows = (data.songs || []).map((item) => [
    item.title || `歌曲 ${item.song_id}`,
    item.source || "generated",
    (item.tags || []).join(" / ") || "-"
  ]);
  renderTable(userSongs, ["歌曲名称", "来源", "标签"], songRows);

  const detailTagWeights = data.tag_weights || data.tagWeights || [];
  const tagRows = detailTagWeights.map((item) => [
    item.name || "-",
    item.type || "-",
    Number(item.weight || 0).toFixed(6)
  ]);
  renderTable(userTags, ["标签", "分类", "权重"], tagRows);

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


