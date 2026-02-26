(function () {
  const API_BASE = "";

  function ensureFavicon() {
    const head = document.head;
    if (!head) return;
    const hasIcon = !!head.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
    if (hasIcon) return;
    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/png";
    link.href = "/favicon.png";
    head.appendChild(link);
  }

  function initAuthFlagFromQuery() {
    try {
      const params = new URLSearchParams(location.search || "");
      if (params.get("logged") === "1") {
        localStorage.setItem("bloknot_logged_in", "1");
        params.delete("logged");
        const next = location.pathname + (params.toString() ? "?" + params.toString() : "") + (location.hash || "");
        history.replaceState(null, "", next);
      }
    } catch (e) {}
  }

  ensureFavicon();
  initAuthFlagFromQuery();

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

    const isLoggedIn = (() => {
      try {
        return localStorage.getItem("bloknot_logged_in") === "1";
      } catch (e) {
        return false;
      }
    })();

    const brandHref = isLoggedIn ? "/dashboard.html" : "/";

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
          <a class="brand" href="${brandHref}" aria-label="Bloknot">
            <img src="/logo-wordmark.svg?v=10" alt="Bloknot" style="height:34px; display:block" />
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
