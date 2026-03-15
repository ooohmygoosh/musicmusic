const tokenInput = document.getElementById("token");
const list = document.getElementById("songList");
const searchInput = document.getElementById("searchInput");
const availabilityFilter = document.getElementById("availabilityFilter");
const typeFilter = document.getElementById("typeFilter");

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

async function toggleAvailability(songId, isAvailable) {
  const res = await fetch(`/admin/library-songs/${songId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-admin-token": getToken() },
    body: JSON.stringify({ is_available: !isAvailable })
  });
  if (!res.ok) {
    alert("更新失败，请确认 Token 或服务状态");
    return;
  }
  await loadSongs();
}

function renderSongs(items) {
  list.innerHTML = "";
  if (!items || items.length === 0) {
    list.innerHTML = "<div class='muted'>暂无库存歌曲</div>";
    return;
  }

  for (const item of items) {
    const card = document.createElement("div");
    card.className = "item library-item";
    const tags = (item.tags || []).map((tag) => `<span class="pill">${tag}</span>`).join("");
    const types = (item.tag_types || []).map((tag) => `<span class="pill">${tag}</span>`).join("");
    card.innerHTML = `
      <div class="library-main">
        <div class="row library-head">
          <div>
            <div class="library-title">${item.title || "未命名歌曲"}</div>
            <div class="muted">${item.model || "未知模型"} · ${item.duration || 0}s · ${item.primary_type || "未分类"} · ${item.is_available ? "启用中" : "已停用"}</div>
          </div>
          ${item.cover_url ? `<img class="cover-thumb" src="${item.cover_url}" alt="cover" />` : ""}
        </div>
        <div class="library-prompts">
          <div class="library-prompt-block">
            <div class="library-prompt-label">发给天谱乐的 Prompt</div>
            <div class="muted library-prompt">${item.prompt || "无提示词"}</div>
          </div>
          <div class="library-prompt-block">
            <div class="library-prompt-label">原始标签 Prompt</div>
            <div class="muted library-prompt">${item.base_prompt || item.prompt || "无原始提示词"}</div>
          </div>
        </div>
        <div class="pill-row">${types}${tags || "<span class='muted'>暂无标签</span>"}</div>
        <div class="meta-grid">
          <div><strong>分发次数</strong><span>${item.deliveries || 0}</span></div>
          <div><strong>复用次数</strong><span>${item.reuse_count || 0}</span></div>
          <div><strong>收藏次数</strong><span>${item.likes || 0}</span></div>
          <div><strong>跳过次数</strong><span>${item.skips || 0}</span></div>
        </div>
        <div class="row">
          ${item.audio_url ? `<a class="link-button" href="${item.audio_url}" target="_blank" rel="noreferrer">试听音频</a>` : ""}
          <button class="ghost-btn">${item.is_available ? "停用复用" : "重新启用"}</button>
        </div>
      </div>
    `;
    card.querySelector(".ghost-btn").addEventListener("click", () => toggleAvailability(item.id, item.is_available));
    list.appendChild(card);
  }
}

async function loadSongs() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set("q", searchInput.value.trim());
  if (availabilityFilter.value) params.set("available", availabilityFilter.value);
  if (typeFilter.value) params.set("type", typeFilter.value);
  const query = params.toString();
  const res = await fetch(`/admin/library-songs${query ? `?${query}` : ""}`, { headers: { "x-admin-token": getToken() } });
  if (!res.ok) {
    list.innerHTML = "<div class='muted'>未授权或服务未启动</div>";
    return;
  }
  const data = await res.json();
  renderSongs(data.items || []);
}

tokenInput.value = getToken();
loadSongs();

