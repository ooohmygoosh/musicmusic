const tokenInput = document.getElementById("token");
const tagGroups = document.getElementById("tagGroups");
const tagTypeSummary = document.getElementById("tagTypeSummary");

function getToken() {
  return localStorage.getItem("adminToken") || "";
}

async function saveTag() {
  const name = document.getElementById("tagName").value.trim();
  const type = document.getElementById("tagType").value.trim();
  const description = document.getElementById("tagDescription").value.trim();
  if (!name || !type) return;
  await fetch("/admin/tags", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": getToken() },
    body: JSON.stringify({ name, type, description })
  });
  document.getElementById("tagName").value = "";
  document.getElementById("tagType").value = "";
  document.getElementById("tagDescription").value = "";
  loadTags();
}

async function patchTag(id, payload) {
  await fetch(`/admin/tags/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-admin-token": getToken() },
    body: JSON.stringify(payload)
  });
}

function renderSummary(items) {
  const grouped = new Map();
  for (const item of items) {
    const next = grouped.get(item.type) || { total: 0, active: 0 };
    next.total += 1;
    if (item.is_active !== false) next.active += 1;
    grouped.set(item.type, next);
  }
  tagTypeSummary.innerHTML = "";
  Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0], "zh-CN")).forEach(([type, data]) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `<div class="stat-label">${type}</div><div class="stat-value">${data.active}/${data.total}</div>`;
    tagTypeSummary.appendChild(card);
  });
}

async function loadTags() {
  const res = await fetch("/admin/tags", { headers: { "x-admin-token": getToken() } });
  if (!res.ok) {
    tagTypeSummary.innerHTML = "";
    tagGroups.innerHTML = "<div class='item'>未授权或服务未启动</div>";
    return;
  }
  const data = await res.json();
  const items = data.items || [];
  renderSummary(items);

  const groups = items.reduce((acc, item) => {
    (acc[item.type] ||= []).push(item);
    return acc;
  }, {});

  tagGroups.innerHTML = "";
  Object.keys(groups).sort((a, b) => a.localeCompare(b, "zh-CN")).forEach((type) => {
    const section = document.createElement("div");
    section.className = "card inner-card";
    section.innerHTML = `<h3>${type}</h3>`;
    groups[type].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || a.name.localeCompare(b.name, "zh-CN"));
    groups[type].forEach((tag) => {
      const div = document.createElement("div");
      div.className = "item stacked-item";
      div.innerHTML = `
        <div>
          <div><strong>${tag.name}</strong> ${tag.is_system === false ? "<small>(自定义)</small>" : "<small>(系统)</small>"}</div>
          <small>${tag.description || "暂无说明"}</small>
        </div>
        <div class="row compact-row">
          <button class="ghost-btn" data-toggle="${tag.id}">${tag.is_active === false ? "启用" : "停用"}</button>
          <button data-delete="${tag.id}">删除</button>
        </div>
      `;
      div.querySelector(`[data-toggle="${tag.id}"]`).addEventListener("click", async () => {
        await patchTag(tag.id, { is_active: !(tag.is_active !== false) });
        loadTags();
      });
      div.querySelector(`[data-delete="${tag.id}"]`).addEventListener("click", async () => {
        await fetch(`/admin/tags/${tag.id}`, { method: "DELETE", headers: { "x-admin-token": getToken() } });
        loadTags();
      });
      section.appendChild(div);
    });
    tagGroups.appendChild(section);
  });
}

document.getElementById("saveToken").addEventListener("click", () => {
  localStorage.setItem("adminToken", tokenInput.value.trim());
  loadTags();
});
document.getElementById("addTag").addEventListener("click", saveTag);
document.getElementById("refreshTags").addEventListener("click", loadTags);

tokenInput.value = getToken();
loadTags();
