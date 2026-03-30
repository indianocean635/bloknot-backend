showNotice("");
        sendBtn.disabled = true;
        try {
          // Пробуем разные URL пока не найдем рабочий
          const urls = [
            "/api/auth/magic-link",
            "/auth/request-link", 
            "/auth/magic-link",
            "/api/send-link",
            "/send-link"
          ];
          
          let res = null;
          let workingUrl = null;
          
          for (const url of urls) {
            try {
              console.log(`🔥 Trying URL: ${url}`);
              res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
              });
              
              if (res.ok) {
                workingUrl = url;
                console.log(`✅ Working URL found: ${url}`);
                break;
              }
            } catch (e) {
              console.log(`❌ URL ${url} failed: ${e.message}`);
              continue;
            }
          }
          
          if (!workingUrl) {
            throw new Error("No working URL found");
          }
          
          const result = await res.json().catch(() => ({}));
          if (result.error) {
            throw new Error(result.error);
          }
          
          showNotice("Ссылка для входа отправлена на вашу почту. Проверьте входящие и папку «Спам». ");
          console.log(`✅ Success with URL: ${workingUrl}`);
        } catch (e) {
          showNotice("Не удалось отправить: " + (e && e.message ? e.message : "ошибка"));
        } finally {
          sendBtn.disabled = false;
        }
