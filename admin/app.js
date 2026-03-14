const apiBase = localStorage.getItem("apiBase") || "";
const tokenInput = document.getElementById("token");
const tagList = document.getElementById("tagList");
const feedbackList = document.getElementById("feedbackList");
const favoritesList = document.getElementById("favoritesList");
const statsGrid = document.getElementById("statsGrid");
const tagUsage = document.getElementById("tagUsage");
const feedbackSummary = document.getElementById("feedbackSummary");

function getToken() {
  return localStorage.getItem("adminToken") || "";
}

document.getElementById("saveToken").addEventListener("click", () => {
  localStorage.setItem("adminToken", tokenInput.value.trim());
  loadStats();
  loadTags();
  loadFeedback();
  loadFavorites();
});

document.getElementById("addTag").addEventListener("click", async () => {
  const name = document.getElementById("tagName").value.trim();
  const type = document.getElementById("tagType").value.trim();
  if (!name || !type) return;
  await fetch("/admin/tags", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": getToken()
    },
    body: JSON.stringify({ name, type })
  });
  document.getElementById("tagName").value = "";
  document.getElementById("tagType").value = "";
  loadTags();
});

document.getElementById("refreshFeedback").addEventListener("click", () => {
  loadFeedback();
});

document.getElementById("refreshFavorites").addEventListener("click", () => {
  loadFavorites();
});

function renderBars(container, items, formatter) {
  container.innerHTML = "";
  if (!items || items.length === 0) {
    container.innerHTML = "<div class='muted'>暂无数据</div>";
    return;
  }
  const maxValue = Math.max(...items.map((item) => item.value));
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "bar-item";
    const pct = maxValue === 0 ? 0 : Math.round((item.value / maxValue) * 100);
    row.innerHTML = `
      <div class="bar-label">${formatter(item)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;"></div></div>
      <div class="bar-value">${item.value}</div>
    `;
    container.appendChild(row);
  }
}

async function loadStats() {
  const res = await fetch("/admin/stats", {
    headers: { "x-admin-token": getToken() }
  });
  if (!res.ok) {
    statsGrid.innerHTML = "<div class='muted'>未授权或服务未启动</div>";
    return;
  }
  const data = await res.json();
  const stats = data.stats || {};
  statsGrid.innerHTML = "";
  const cards = [
    { label: "用户数", value: stats.users || 0 },
    { label: "歌曲数", value: stats.songs || 0 },
    { label: "反馈数", value: stats.feedback || 0 },
    { label: "收藏数", value: stats.favorites || 0 },
    { label: "标签总数", value: stats.tags_total || 0 },
    { label: "启用标签", value: stats.tags_active || 0 }
  ];
  for (const card of cards) {
    const div = document.createElement("div");
    div.className = "stat-card";
    div.innerHTML = `<div class="stat-label">${card.label}</div><div class="stat-value">${card.value}</div>`;
    statsGrid.appendChild(div);
  }

  renderBars(
    tagUsage,
    (data.top_tags || []).map((item) => ({
      key: item.name,
      type: item.type,
      value: Number(item.uses || 0)
    })),
    (item) => `${item.key} (${item.type || ""})`
  );

  renderBars(
    feedbackSummary,
    (data.feedback_breakdown || []).map((item) => ({
      key: item.action,
      value: Number(item.count || 0)
    })),
    (item) => item.key
  );
}

async function loadTags() {
  const res = await fetch("/admin/tags", {
    headers: { "x-admin-token": getToken() }
  });
  if (!res.ok) {
    tagList.innerHTML = "<div class='item'>未授权或服务未启动</div>";
    return;
  }
  const data = await res.json();
  tagList.innerHTML = "";
  for (const tag of data.items) {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div>
        <strong>${tag.name}</strong>
        <small>(${tag.type})</small>
      </div>
      <div>
        <button data-id="${tag.id}">删除</button>
      </div>
    `;
    div.querySelector("button").addEventListener("click", async () => {
      await fetch(`/admin/tags/${tag.id}`, {
        method: "DELETE",
        headers: { "x-admin-token": getToken() }
      });
      loadTags();
    });
    tagList.appendChild(div);
  }
}

async function loadFeedback() {
  const res = await fetch("/admin/feedback", {
    headers: { "x-admin-token": getToken() }
  });
  if (!res.ok) {
    feedbackList.innerHTML = "<div class='item'>未授权或服务未启动</div>";
    return;
  }
  const data = await res.json();
  feedbackList.innerHTML = "";
  for (const f of data.items) {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<div>用户 ${f.user_id} 对歌曲 ${f.song_id} : ${f.action}</div>`;
    feedbackList.appendChild(div);
  }
}

async function loadFavorites() {
  const res = await fetch("/admin/favorites", {
    headers: { "x-admin-token": getToken() }
  });
  if (!res.ok) {
    favoritesList.innerHTML = "<div class='item'>未授权或服务未启动</div>";
    return;
  }
  const data = await res.json();
  favoritesList.innerHTML = "";
  for (const f of data.items) {
    const tags = (f.tags || []).join(", ");
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div>
        <strong>用户 ${f.user_id} 收藏歌曲 ${f.song_id}</strong>
        <small>标签: ${tags || "无"}</small>
        <div>${f.prompt}</div>
      </div>
    `;
    favoritesList.appendChild(div);
  }
}

loadStats();
loadTags();
loadFeedback();
loadFavorites();
