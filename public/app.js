(function () {
  const API_BASE = "https://bloknotservis.ru"; // Updated: 2026-04-20
  console.log('APP.JS LOADED - API_BASE:', API_BASE);

  // Auto-refresh on version change
  async function checkForUpdates() {
    try {
      const currentVersion = localStorage.getItem('bloknot_version') || '0';
      
      // Check server version
      const response = await fetch('/api/version');
      const serverVersion = response.ok ? (await response.json()).version : '1';
      
      if (currentVersion !== serverVersion) {
        localStorage.setItem('bloknot_version', serverVersion);
        // Force refresh to get latest version
        window.location.reload(true);
      }
    } catch (e) {
      // Fallback to meta tag if API fails
      try {
        const currentVersion = localStorage.getItem('bloknot_version') || '0';
        const pageVersion = document.querySelector('meta[name="version"]')?.content || '1';
        
        if (currentVersion !== pageVersion) {
          localStorage.setItem('bloknot_version', pageVersion);
          window.location.reload(true);
        }
      } catch (e2) {
        // Ignore all errors
      }
    }
  }

  // Check for updates on page load
  checkForUpdates();

  // Check periodically (every 30 seconds)
  setInterval(checkForUpdates, 30000);

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

  function ensurePwaMeta() {
    const head = document.head;
    if (!head) return;

    if (!head.querySelector('link[rel="manifest"]')) {
      const m = document.createElement("link");
      m.rel = "manifest";
      m.href = "/manifest.webmanifest";
      head.appendChild(m);
    }

    if (!head.querySelector('meta[name="theme-color"]')) {
      const t = document.createElement("meta");
      t.name = "theme-color";
      t.content = "#22c55e";
      head.appendChild(t);
    }
  }

  function registerServiceWorker() {
    try {
      if (!('serviceWorker' in navigator)) return;
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      });
    } catch (e) {}
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
  ensurePwaMeta();
  registerServiceWorker();
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
    // Add authentication headers
    let userEmail = localStorage.getItem('bloknot_logged_in_email') || localStorage.getItem('bloknot_user_email');
    
    // Если нет email — пробуем получить с сервера через cookie
    if (!userEmail) {
      try {
        const res = await fetch(API_BASE + '/api/auth/me', {
          credentials: 'include'
        });

        if (res.ok) {
          const data = await res.json();
          userEmail = data.user?.email;

          if (userEmail) {
            localStorage.setItem('bloknot_logged_in_email', userEmail);
          }
        }
      } catch (e) {
        console.error('Failed to restore session via cookie', e);
      }
    }
    
    // Check for impersonation cookie if localStorage is empty
    if (!userEmail) {
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'impersonate') {
          userEmail = decodeURIComponent(value);
          break;
        }
      }
    }
    
    if (!userEmail) {
      console.warn('User not found in localStorage or cookie');
    }
    
    const headers = {
      'x-user-email': userEmail,
      ...opts?.headers
    };
    
    const options = {
      ...opts,
      credentials: 'include',
      headers: headers
    };
    
    const fullUrl = API_BASE + path;
    const res = await fetch(fullUrl, options);
    
    if (!res.ok) {
      let text = "";
      try {
        text = await res.text();
      } catch (e) {}
      
      // НЕ РЕДИРЕКТИМ ПРИ 401 - ВОЗВРАЩАЕМ NULL
      if (res.status === 401) {
        console.warn('API 401, ignoring for now');
        return null;
      }
      
      throw new Error(text || ("HTTP " + res.status));
    }
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    return res.text();
  }

  let deferredInstallPrompt = null;
  try {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
    });
  } catch (e) {}

  function isIOS() {
    const ua = navigator.userAgent || "";
    return /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  }

  function isStandalone() {
    try {
      return (
        window.matchMedia &&
        window.matchMedia("(display-mode: standalone)").matches
      ) || window.navigator.standalone === true;
    } catch (e) {
      return false;
    }
  }

  function ensureBookmarkModal() {
    if (document.getElementById("bookmark-modal")) return;
    const wrap = document.createElement("div");
    wrap.id = "bookmark-modal";
    wrap.style.position = "fixed";
    wrap.style.inset = "0";
    wrap.style.background = "rgba(15,23,42,0.45)";
    wrap.style.backdropFilter = "blur(6px)";
    wrap.style.display = "none";
    wrap.style.alignItems = "center";
    wrap.style.justifyContent = "center";
    wrap.style.padding = "18px";
    wrap.style.zIndex = "9999";
    wrap.innerHTML = `
      <div class="card" style="max-width:520px; width:100%">
        <div class="item-title" style="font-size:18px">Сохранить в закладках</div>
        <div class="item-meta" id="bookmark-text" style="margin-top:8px"></div>
        <div class="actions" style="margin-top:14px; justify-content:flex-end">
          <button class="btn secondary" id="bookmark-close" type="button">Закрыть</button>
          <button class="btn" id="bookmark-install" type="button" style="display:none">Добавить на экран</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    const closeBtn = document.getElementById("bookmark-close");
    closeBtn.addEventListener("click", () => {
      wrap.style.display = "none";
    });
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) wrap.style.display = "none";
    });
  }

  async function openBookmarkHelp() {
    ensureBookmarkModal();
    const modal = document.getElementById("bookmark-modal");
    const text = document.getElementById("bookmark-text");
    const installBtn = document.getElementById("bookmark-install");

    if (isStandalone()) {
      text.innerHTML = "Похоже, приложение уже добавлено на главный экран.";
      installBtn.style.display = "none";
      modal.style.display = "flex";
      return;
    }

    const ua = navigator.userAgent || "";
    const isMac = /Macintosh|Mac OS X/.test(ua);
    const isWin = /Windows/.test(ua);

    if (isIOS()) {
      text.innerHTML =
        "<div style=\"display:grid; gap:8px\">" +
        "<div><b>Добавить на экран «Домой»</b></div>" +
        "<div>1) Открой сайт именно в <b>Safari</b> (не внутри Telegram/Instagram/ВК браузера).</div>" +
        "<div>2) Нажми кнопку <b>Поделиться</b> (квадрат со стрелкой вверх).</div>" +
        "<div>3) Прокрути список действий вниз и выбери <b>\"На экран «Домой»\"</b> / <b>\"Add to Home Screen\"</b>.</div>" +
        "<div>Если пункта нет: нажми <b>\"Изменить действия\"</b> и включи \"На экран «Домой»\" (или обнови iOS).</div>" +
        "</div>";
      installBtn.style.display = "none";
      modal.style.display = "flex";
      return;
    }

    const parts = [];

    if (deferredInstallPrompt) {
      parts.push(
        "<div><b>Установить как приложение</b></div>" +
          "<div>Нажми кнопку ниже — появится системное окно установки Bloknot.</div>"
      );
      installBtn.style.display = "inline-flex";
      installBtn.onclick = async () => {
        try {
          const p = deferredInstallPrompt;
          deferredInstallPrompt = null;
          installBtn.style.display = "none";
          await p.prompt();
        } catch (e) {}
      };
    } else {
      installBtn.style.display = "none";
      if (isWin) {
        parts.push(
          "<div><b>Установить как приложение (Edge/Chrome)</b></div>" +
            "<div>Открой меню браузера → <b>Установить приложение</b> / <b>Приложения</b> → <b>Установить этот сайт как приложение</b>.</div>"
        );
      } else if (isMac) {
        parts.push(
          "<div><b>Установить как приложение (Chrome/Edge)</b></div>" +
            "<div>Открой меню браузера → <b>Install app</b> / <b>Установить</b>.</div>"
        );
      }
    }

    if (isMac) {
      parts.push("<div><b>Добавить в закладки</b></div><div>Нажми <b>Cmd + D</b>.</div>");
    } else if (isWin) {
      parts.push("<div><b>Добавить в закладки</b></div><div>Нажми <b>Ctrl + D</b>.</div>");
    }

    if (isWin) {
      parts.push(
        "<div><b>Закрепить на панели задач</b></div>" +
          "<div>После установки: открой приложение Bloknot → правой кнопкой по иконке на панели задач → <b>Закрепить</b>.</div>" +
          "<div>Если не установлено: закрепить нельзя — сначала нужно установить как приложение.</div>"
      );
    } else if (isMac) {
      parts.push(
        "<div><b>Закрепить в Dock</b></div>" +
          "<div>После установки: открой Bloknot → правой кнопкой по иконке в Dock → <b>Параметры</b> → <b>Оставить в Dock</b>.</div>"
      );
    }

    text.innerHTML = `<div style="display:grid; gap:10px">${parts.join("")}</div>`;
    modal.style.display = "flex";
  }

  async function triggerInstallPrompt() {
    if (!deferredInstallPrompt) return false;
    try {
      const p = deferredInstallPrompt;
      deferredInstallPrompt = null;
      await p.prompt();
      return true;
    } catch (e) {
      return false;
    }
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
      { key: "settings", href: "/settings.html", label: "Настройки" },
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
            <button class="btn secondary" id="bookmark-btn" type="button" style="padding:8px 10px; border-radius:10px">Установить</button>
          </nav>
        </div>
      </div>
    `;

    const b = host.querySelector("#bookmark-btn");
    if (b) {
      b.addEventListener("click", () => {
        triggerInstallPrompt().then((didPrompt) => {
          if (!didPrompt) openBookmarkHelp();
        });
      });
    }

  }

  window.Bloknot = {
    API_BASE,
    qs,
    esc,
    api,
    renderHeader,
  };
})();
