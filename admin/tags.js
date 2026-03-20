const tokenInput = document.getElementById("token");
const tagGroups = document.getElementById("tagGroups");
const tagTypeSummary = document.getElementById("tagTypeSummary");
const blacklistList = document.getElementById("blacklistList");
const tagSelectionHint = document.getElementById("tagSelectionHint");
const selectedTagIds = new Set();

function getToken() {
  return localStorage.getItem("adminToken") || "";
}

function updateSelectionHint() {
  tagSelectionHint.textContent = `已选择 ${selectedTagIds.size} 个标签`;
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

async function batchDeleteTags(options = {}) {
  const ids = [...selectedTagIds];
  if (!ids.length) {
    alert("请先选择标签。");
    return;
  }
  const actionText = options.addToBlacklist ? "删除并加入黑名单" : options.softDelete ? "停用" : "删除";
  if (!confirm(`确认对 ${ids.length} 个标签执行${actionText}？`)) return;
  const res = await fetch("/admin/tags/batch-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": getToken() },
    body: JSON.stringify({
      ids,
      soft_delete: options.softDelete === true,
      add_to_blacklist: options.addToBlacklist === true,
      blacklist_reason: options.addToBlacklist ? "管理员批量审核" : null
    })
  });
  if (!res.ok) {
    alert("批量操作失败。");
    return;
  }
  selectedTagIds.clear();
  updateSelectionHint();
  await Promise.all([loadTags(), loadBlacklist()]);
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
    tagGroups.innerHTML = "<div class='item'>未授权或服务不可用</div>";
    return;
  }
  const data = await res.json();
  const items = data.items || [];
  renderSummary(items);

  const liveIds = new Set(items.map((item) => Number(item.id)));
  [...selectedTagIds].forEach((id) => {
    if (!liveIds.has(id)) selectedTagIds.delete(id);
  });

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
      const checked = selectedTagIds.has(Number(tag.id)) ? "checked" : "";
      div.innerHTML = `
        <div class="checkbox-cell">
          <input type="checkbox" data-select="${tag.id}" ${checked} />
        </div>
        <div class="stack-grow">
          <div><strong>${tag.name}</strong> ${tag.is_system === false ? "<small>(自定义)</small>" : "<small>(系统)</small>"}</div>
          <small>${tag.description || "暂无说明"}</small>
          <div class="muted">排序：${Number(tag.sort_order || 0)} · 状态：${tag.is_active === false ? "停用" : "启用"}</div>
        </div>
        <div class="row compact-row">
          <button class="ghost-btn" data-toggle="${tag.id}">${tag.is_active === false ? "启用" : "停用"}</button>
          <button class="danger-btn" data-delete="${tag.id}">删除</button>
        </div>
      `;
      div.querySelector(`[data-select="${tag.id}"]`).addEventListener("change", (event) => {
        if (event.target.checked) {
          selectedTagIds.add(Number(tag.id));
        } else {
          selectedTagIds.delete(Number(tag.id));
        }
        updateSelectionHint();
      });
      div.querySelector(`[data-toggle="${tag.id}"]`).addEventListener("click", async () => {
        await patchTag(tag.id, { is_active: !(tag.is_active !== false) });
        loadTags();
      });
      div.querySelector(`[data-delete="${tag.id}"]`).addEventListener("click", async () => {
        await fetch(`/admin/tags/${tag.id}`, { method: "DELETE", headers: { "x-admin-token": getToken() } });
        selectedTagIds.delete(Number(tag.id));
        loadTags();
      });
      section.appendChild(div);
    });
    tagGroups.appendChild(section);
  });

  updateSelectionHint();
}

async function loadBlacklist() {
  const res = await fetch("/admin/tag-blacklist", { headers: { "x-admin-token": getToken() } });
  if (!res.ok) {
    blacklistList.innerHTML = "<div class='item'>未授权或服务不可用</div>";
    return;
  }
  const data = await res.json();
  const items = data.items || [];
  blacklistList.innerHTML = "";
  if (!items.length) {
    blacklistList.innerHTML = "<div class='item'>暂无黑名单条目</div>";
    return;
  }
  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "item stacked-item";
    div.innerHTML = `
      <div class="stack-grow">
        <div><strong>${item.word}</strong></div>
        <small>${item.reason || "无原因"}</small>
      </div>
      <div class="row compact-row">
        <button class="danger-btn" data-delete-blacklist="${item.id}">移除</button>
      </div>
    `;
    div.querySelector(`[data-delete-blacklist="${item.id}"]`).addEventListener("click", async () => {
      await fetch(`/admin/tag-blacklist/${item.id}`, { method: "DELETE", headers: { "x-admin-token": getToken() } });
      loadBlacklist();
    });
    blacklistList.appendChild(div);
  });
}

async function addBlacklist() {
  const word = document.getElementById("blacklistWord").value.trim();
  const reason = document.getElementById("blacklistReason").value.trim();
  if (!word) return;
  await fetch("/admin/tag-blacklist", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": getToken() },
    body: JSON.stringify({ word, reason })
  });
  document.getElementById("blacklistWord").value = "";
  document.getElementById("blacklistReason").value = "";
  loadBlacklist();
}

async function addBlacklistBulk() {
  const text = document.getElementById("blacklistBulkText").value.trim();
  const reason = document.getElementById("blacklistBulkReason").value.trim();
  if (!text) return;
  const res = await fetch("/admin/tag-blacklist/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": getToken() },
    body: JSON.stringify({ text, reason })
  });
  if (!res.ok) {
    alert("批量写入失败。");
    return;
  }
  document.getElementById("blacklistBulkText").value = "";
  document.getElementById("blacklistBulkReason").value = "";
  loadBlacklist();
}

document.getElementById("saveToken").addEventListener("click", () => {
  localStorage.setItem("adminToken", tokenInput.value.trim());
  loadTags();
  loadBlacklist();
});
document.getElementById("addTag").addEventListener("click", saveTag);
document.getElementById("refreshTags").addEventListener("click", loadTags);
document.getElementById("refreshBlacklist").addEventListener("click", loadBlacklist);
document.getElementById("addBlacklist").addEventListener("click", addBlacklist);
document.getElementById("addBlacklistBulk").addEventListener("click", addBlacklistBulk);
document.getElementById("clearTagSelection").addEventListener("click", () => {
  selectedTagIds.clear();
  updateSelectionHint();
  loadTags();
});
document.getElementById("disableSelectedTags").addEventListener("click", () => batchDeleteTags({ softDelete: true }));
document.getElementById("deleteSelectedTags").addEventListener("click", () => batchDeleteTags({ softDelete: false }));
document.getElementById("deleteAndBlacklistTags").addEventListener("click", () => batchDeleteTags({ softDelete: false, addToBlacklist: true }));

tokenInput.value = getToken();
updateSelectionHint();
loadTags();
loadBlacklist();
