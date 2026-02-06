(function () {
  const API_BASE = "";

  function qs(sel) {
    return document.querySelector(sel);
  }

  function esc(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function api(path, opts) {
    const res = await fetch(API_BASE + path, opts);
    if (!res.ok) {
      let text = "";
      try {
        text = await res.text();
      } catch (e) {}
      throw new Error(text || ("HTTP " + res.status));
    }
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    return res.text();
  }

  function renderFooter() {
    if (document.querySelector("footer.site-footer")) return;
    const el = document.createElement("footer");
    el.className = "site-footer";
    el.innerHTML = `
      <div class="container" style="padding:16px 16px">
        <div class="nav" style="justify-content:center">
          <a href="/support.html">Поддержка</a>
          <a href="/pricing.html">Тарифы</a>
          <a href="/terms.html">Пользовательское соглашение</a>
          <a href="/privacy.html">Политика конфиденциальности</a>
        </div>
      </div>
    `;
    document.body.appendChild(el);
  }

  function renderHeader(active) {
    const host = qs("#app-header");
    if (!host) return;

    const links = [
      { key: "dashboard", href: "/dashboard.html", label: "Кабинет" },
      { key: "branches", href: "/branches.html", label: "Филиалы" },
      { key: "categories", href: "/categories.html", label: "Категории" },
      { key: "services", href: "/services.html", label: "Услуги" },
      { key: "masters", href: "/masters.html", label: "Мастера" },
      { key: "works", href: "/works.html", label: "Фото работ" },
      { key: "calendar", href: "/calendar.html", label: "Календарь" },
    ];

    host.innerHTML = `
      <div class="header">
        <div class="container header-inner">
          <a class="brand" href="/dashboard.html" aria-label="Bloknot">
            <span class="brand-mark">✓</span>
            <span>Bloknot</span>
          </a>
          <nav class="nav" aria-label="Навигация">
            ${links
              .map(
                (l) =>
                  `<a href="${l.href}" class="${l.key === active ? "active" : ""}">${esc(
                    l.label
                  )}</a>`
              )
              .join("")}
          </nav>
        </div>
      </div>
    `;

    renderFooter();
  }

  window.Bloknot = {
    API_BASE,
    qs,
    esc,
    api,
    renderHeader,
  };
})();
