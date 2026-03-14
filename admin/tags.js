const tokenInput = document.getElementById("token");
const tagList = document.getElementById("tagList");

function getToken() {
  return localStorage.getItem("adminToken") || "";
}

document.getElementById("saveToken").addEventListener("click", () => {
  localStorage.setItem("adminToken", tokenInput.value.trim());
  loadTags();
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

loadTags();

