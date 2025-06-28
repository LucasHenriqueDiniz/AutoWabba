async function performClick(browser, targetPage) {
  try {
    const contexts = browser.contexts();
    const pages = contexts[0].pages();
    const page = pages.find((p) => p.url() === targetPage.url);

    if (!page) {
      throw new Error("Page not found");
    }

    // Verificar se a página está com erro (preta/vazia) - apenas detectar, não fechar
    const pageContent = await page.evaluate(() => {
      const body = document.body;
      if (!body) return "empty";

      const text = body.innerText || body.textContent || "";
      const hasContent = text.trim().length > 0;
      const hasError = text.toLowerCase().includes("error") || text.toLowerCase().includes("not found") || text.toLowerCase().includes("unavailable");

      if (!hasContent) return "empty";
      if (hasError) return "error";
      return "ok";
    });

    if (pageContent === "empty" || pageContent === "error") {
      console.log(`Página com erro detectada (${pageContent}). Pulando...`);
      throw new Error(`Página com erro: ${pageContent}`);
    }

    // Primeiro, tenta o botão de download normal
    try {
      await page.waitForSelector("button#slowDownloadButton", { timeout: 5000 });
      const button = await page.$("button#slowDownloadButton");
      const isVisible = await button.isVisible();

      if (isVisible) {
        await page.evaluate(() => document.querySelector("button#slowDownloadButton")?.click());
        console.log("Botão de download principal clicado!");
        return { url: targetPage.url, clickedMain: true };
      }
    } catch (error) {
      console.log("Botão de download principal não disponível, tentando botão alternativo...");
    }

    // Se o botão principal não funcionou, tenta o botão "click here"
    try {
      await page.waitForSelector("a[href*='download']", { timeout: 5000 });
      const clickHereButton = await page.$("a[href*='download']");

      if (clickHereButton) {
        await clickHereButton.click();
        console.log("Botão 'click here' clicado!");
        return { url: targetPage.url, clickedMain: false };
      }
    } catch (error) {
      console.log("Botão 'click here' não encontrado, tentando seletor mais específico...");
    }

    // Última tentativa com seletor mais específico
    try {
      await page.waitForSelector("p > a", { timeout: 3000 });
      const links = await page.$$("p > a");

      for (const link of links) {
        const text = await link.textContent();
        if (text && text.toLowerCase().includes("click here")) {
          await link.click();
          console.log("Botão 'click here' encontrado e clicado!");
          return { url: targetPage.url, clickedMain: false };
        }
      }
    } catch (error) {
      console.log("Nenhum botão de download encontrado");
    }

    throw new Error("Nenhum botão de download disponível");
  } catch (error) {
    console.error("Error clicking:", error.message);
    return null;
  }
}

/**
 * Verifica se há muitas páginas com erro no browser
 * @param {Object} browser - Instância do browser
 * @returns {Promise<boolean>} True se há muitas páginas com erro
 */
async function hasManyErrorPages(browser) {
  try {
    const contexts = browser.contexts();
    const pages = contexts[0].pages();
    let errorPageCount = 0;
    let totalPages = pages.length;

    for (const page of pages) {
      try {
        const pageContent = await page.evaluate(() => {
          const body = document.body;
          if (!body) return "empty";

          const text = body.innerText || body.textContent || "";
          const hasContent = text.trim().length > 0;
          const hasError =
            text.toLowerCase().includes("error") ||
            text.toLowerCase().includes("not found") ||
            text.toLowerCase().includes("unavailable") ||
            text.toLowerCase().includes("page cannot be displayed");

          if (!hasContent) return "empty";
          if (hasError) return "error";
          return "ok";
        });

        if (pageContent === "empty" || pageContent === "error") {
          errorPageCount++;
        }
      } catch (error) {
        // Se não conseguir verificar a página, provavelmente está com erro
        errorPageCount++;
      }
    }

    const errorRatio = errorPageCount / totalPages;
    console.log(`Páginas com erro: ${errorPageCount}/${totalPages} (${(errorRatio * 100).toFixed(1)}%)`);

    // Se mais de 50% das páginas têm erro, considera problemático
    return errorRatio > 0.5 && totalPages > 1;
  } catch (error) {
    console.error("Erro ao verificar páginas:", error.message);
    return false;
  }
}

module.exports = {
  performClick,
  hasManyErrorPages,
};
