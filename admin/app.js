const apiBase = localStorage.getItem("apiBase") || "";
const tokenInput = document.getElementById("token");
const tagList = document.getElementById("tagList");
const feedbackList = document.getElementById("feedbackList");
const favoritesList = document.getElementById("favoritesList");

function getToken() {
  return localStorage.getItem("adminToken") || "";
}

document.getElementById("saveToken").addEventListener("click", () => {
  localStorage.setItem("adminToken", tokenInput.value.trim());
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

loadTags();
loadFeedback();
loadFavorites();
