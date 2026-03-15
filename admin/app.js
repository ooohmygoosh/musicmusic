const tokenInput = document.getElementById("token");
const statsGrid = document.getElementById("statsGrid");
const tagUsage = document.getElementById("tagUsage");
const feedbackSummary = document.getElementById("feedbackSummary");

function getToken() {
  return localStorage.getItem("adminToken") || "";
}

document.getElementById("saveToken").addEventListener("click", () => {
  localStorage.setItem("adminToken", tokenInput.value.trim());
  loadStats();
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
    { label: "歌曲总数", value: stats.songs || 0 },
    { label: "可复用库存", value: stats.reusable_songs || 0 },
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

tokenInput.value = getToken();
loadStats();
