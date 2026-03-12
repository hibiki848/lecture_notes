function $(id) { return document.getElementById(id); }

let allRows = [];

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}
  if (!res.ok) throw new Error(data.message || data.detail || text || "API error");
  return data;
}

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

function normalizeForSearch(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKC");
}

function buildSearchTarget(qz) {
  const choices = [qz.choice_1, qz.choice_2, qz.choice_3, qz.choice_4].filter(Boolean).join(" ");
  const tags = Array.isArray(qz.tags)
    ? qz.tags.join(" ")
    : (typeof qz.tags === "string" ? qz.tags : "");
  return normalizeForSearch([
    qz.title,
    qz.question_text,
    choices,
    qz.explanation,
    tags,
  ].join(" "));
}

function render(rows, options = {}) {
  const hasKeyword = Boolean(options.keyword);
  $("message").textContent = `${rows.length}件`;

  if (!rows.length) {
    $("quizList").innerHTML = hasKeyword
      ? "<div class='small'>該当するクイズが見つかりません</div>"
      : "<div class='small'>クイズはまだありません。</div>";
    return;
  }

  $("quizList").innerHTML = rows.map((qz) => `
    <div class="card">
      <div><strong>${esc(qz.title)}</strong> / ${esc(qz.quiz_type)}</div>
      <div class="small">${esc(qz.question_text).slice(0, 120)}</div>
      <div class="small">作成日: ${esc(qz.created_at)}</div>
      <div class="row" style="margin-top:8px;">
        <button data-edit="${qz.id}">編集</button>
        <button data-delete="${qz.id}">削除</button>
      </div>
    </div>
  `).join("");

  document.querySelectorAll("button[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("削除しますか？")) return;
      try {
        await api(`/api/quizzes/${btn.dataset.delete}`, { method: "DELETE" });
        await load();
      } catch (e) {
        $("message").textContent = e.message;
      }
    });
  });

  document.querySelectorAll("button[data-edit]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const quiz = await api(`/api/quizzes/${btn.dataset.edit}`);
      location.href = `/create-quiz.html?edit_id=${quiz.data.id}`;
    });
  });
}

function applyFilters() {
  const keyword = normalizeForSearch($("keyword").value.trim());
  const filteredRows = keyword
    ? allRows.filter((qz) => buildSearchTarget(qz).includes(keyword))
    : allRows;

  render(filteredRows, { keyword });
}

async function load() {
  const type = $("filterType").value;
  const q = type ? `?quiz_type=${encodeURIComponent(type)}` : "";
  const result = await api(`/api/quizzes/mine${q}`);
  allRows = result.data.quizzes || [];
  applyFilters();
}

(async () => {
  $("btnReload").addEventListener("click", load);
  $("filterType").addEventListener("change", load);
  $("keyword").addEventListener("input", applyFilters);
  $("btnClearKeyword").addEventListener("click", () => {
    $("keyword").value = "";
    applyFilters();
    $("keyword").focus();
  });
  await load();
})();
