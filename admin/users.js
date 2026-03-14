const tokenInput = document.getElementById("token");
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

document.getElementById("saveToken").addEventListener("click", () => {
  localStorage.setItem("adminToken", tokenInput.value.trim());
  loadUsers();
});

document.getElementById("refreshUsers").addEventListener("click", () => {
  loadUsers();
});

document.getElementById("refreshUserDetail").addEventListener("click", () => {
  if (selectedUserId) {
    loadUserDetail(selectedUserId);
  }
});

function renderTable(container, headers, rows) {
  if (!rows || rows.length === 0) {
    container.innerHTML = "<div class='muted'>暂无数据</div>";
    return;
  }
  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${rows
        .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
        .join("")}
    </tbody>
  `;
  container.innerHTML = "";
  container.appendChild(table);
}

async function loadUsers() {
  const res = await fetch("/admin/user-summary", {
    headers: { "x-admin-token": getToken() }
  });
  if (!res.ok) {
    userTable.innerHTML = "<div class='muted'>未授权或服务未启动</div>";
    return;
  }
  const data = await res.json();
  const rows = (data.items || []).map((user) => [
    `<button class='link' data-user='${user.id}'>用户 ${user.id}</button>`,
    user.device_id || "-",
    new Date(user.created_at).toLocaleString(),
    user.like_count || 0,
    user.skip_count || 0,
    user.feedback_count || 0
  ]);
  renderTable(userTable, ["用户", "设备ID", "注册时间", "收藏", "跳过", "反馈总数"], rows);

  userTable.querySelectorAll("button[data-user]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedUserId = btn.dataset.user;
      userDetailTitle.textContent = `用户 ${selectedUserId} 详情`;
      loadUserDetail(selectedUserId);
    });
  });
}

async function loadUserDetail(userId) {
  const res = await fetch(`/admin/user-detail?user_id=${userId}`, {
    headers: { "x-admin-token": getToken() }
  });
  if (!res.ok) {
    userInfo.innerHTML = "<div class='muted'>未授权或服务未启动</div>";
    userFavorites.innerHTML = "";
    userSongs.innerHTML = "";
    userTags.innerHTML = "";
    return;
  }
  const data = await res.json();

  const user = data.user || {};
  const username = user.name || user.device_id || `用户 ${user.id || userId}`;
  renderTable(userInfo, ["用户名"], [[username]]);

  const favoriteRows = (data.favorites || []).map((item) => [
    item.title || `歌曲 ${item.song_id}`,
    (item.playlists || []).join(", ") || "-",
    (item.tags || []).join(", ") || "-"
  ]);
  renderTable(userFavorites, ["歌曲名称", "歌单", "标签"], favoriteRows);

  const songRows = (data.songs || []).map((item) => [
    item.title || `歌曲 ${item.song_id}`,
    (item.tags || []).join(", ") || "-"
  ]);
  renderTable(userSongs, ["歌曲名称", "标签"], songRows);

  const tagRows = (data.tag_weights || []).map((item) => [
    item.name,
    Number(item.weight || 0).toFixed(3)
  ]);
  renderTable(userTags, ["标签", "权重"], tagRows);
}

loadUsers();
