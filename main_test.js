/**
 * AutoWabba Test - Versão Simplificada
 *
 * Lógica essencial para automatizar downloads do Wabbajack:
 * 1. Pedir path do Wabbajack (ou carregar salvo)
 * 2. Lançar Wabbajack em modo debug
 * 3. Esperar abrir usando tasklist
 * 4. Detectar páginas de download e clicar
 */

const { chromium } = require("playwright");
const { checkBrowserAvailability, findTargetPage } = require("./src/browser_new");
const { performClick, hasManyErrorPages } = require("./src/downloader");
const { getWabbajackPath, isWabbajackRunning, launchWabbajackWithDebug } = require("./src/wabbajack_new");

// Estado da aplicação
let isRunning = false;
let stopRequested = false;
let selectedWabbajackPath = null;

// Variáveis de controle
let lastClickedUrl = null;
let attempts = 0;
const MAX_ATTEMPTS = 10;
const COOLDOWN_TIME = 10000;
let errorPageCount = 0;
const MAX_ERROR_PAGES = 3; // Máximo de tentativas com páginas de erro

/**
 * Função principal de teste
 */
async function runTest() {
  console.log("=== AutoWabba Test - Iniciando ===");

  try {
    // 1. Obter path do Wabbajack (carregado ou solicitado ao usuário)
    console.log("\n1. Obtendo caminho do Wabbajack...");
    selectedWabbajackPath = await getWabbajackPath();

    if (!selectedWabbajackPath) {
      console.error("Caminho do Wabbajack não fornecido. Teste abortado.");
      return;
    }

    console.log(`Wabbajack configurado: ${selectedWabbajackPath}`);

    // 2. Lançar Wabbajack em modo debug
    console.log("\n2. Lançando Wabbajack em modo debug...");
    const launched = await launchWabbajackWithDebug(selectedWabbajackPath);

    if (!launched) {
      console.error("Falha ao lançar Wabbajack. Teste abortado.");
      return;
    }

    console.log("Wabbajack lançado com sucesso!");

    // 3. Esperar abrir usando tasklist
    console.log("\n3. Aguardando Wabbajack inicializar...");
    await waitForWabbajackToStart();

    // Aguardar 3 segundos adicionais
    console.log("Aguardando 3 segundos para estabilização...");
    await sleep(3000);

    // 4. Iniciar automação de downloads
    console.log("\n4. Iniciando automação de downloads...");
    await startDownloadAutomation();
  } catch (error) {
    console.error("Erro durante o teste:", error.message);
  }
}

/**
 * Aguarda o Wabbajack iniciar usando tasklist
 */
async function waitForWabbajackToStart() {
  const maxAttempts = 30; // 30 tentativas = 30 segundos
  let attempts = 0;

  while (attempts < maxAttempts) {
    const running = await isWabbajackRunning();
    if (running) {
      console.log("Wabbajack detectado em execução!");
      return;
    }

    console.log(`Aguardando Wabbajack... (${attempts + 1}/${maxAttempts})`);
    await sleep(1000);
    attempts++;
  }

  throw new Error("Timeout: Wabbajack não iniciou em 30 segundos");
}

/**
 * Inicia a automação de downloads
 */
async function startDownloadAutomation() {
  isRunning = true;
  stopRequested = false;

  console.log("Automação iniciada. Pressione Ctrl+C para parar.");

  while (isRunning && !stopRequested) {
    try {
      // Verificar disponibilidade do browser
      const pages = await checkBrowserAvailability();

      if (!pages) {
        console.log("Browser não encontrado. Aguardando...");
        await sleep(2000);
        continue;
      }

      // Verificar se há muitas páginas com erro
      if (errorPageCount >= MAX_ERROR_PAGES) {
        console.log("Muitas tentativas com erro. Verificando estado do browser...");
        const browser = await chromium.connectOverCDP("http://localhost:9222");
        const hasManyErrors = await hasManyErrorPages(browser);
        await browser.close();

        if (hasManyErrors) {
          console.log("Muitas páginas com erro detectadas. Aguardando 30 segundos...");
          await sleep(30000); // Aguarda 30 segundos
          errorPageCount = 0; // Reset contador
          continue;
        } else {
          console.log("Browser parece estar OK. Continuando...");
          errorPageCount = 0; // Reset contador
        }
      }

      // Procurar página de download
      const targetPage = await findTargetPage(pages);

      if (targetPage) {
        // Verificar se é a mesma URL (download em andamento)
        if (lastClickedUrl === targetPage.url) {
          attempts++;
          if (attempts >= MAX_ATTEMPTS) {
            console.log("Download parece estar travado. Resetando...");
            lastClickedUrl = null;
            attempts = 0;
          } else {
            console.log(`Download em andamento... (tentativa ${attempts}/${MAX_ATTEMPTS})`);
            await sleep(COOLDOWN_TIME * 2);
            continue;
          }
        } else {
          attempts = 0;
        }

        // Executar clique
        console.log("Página de download encontrada! Iniciando download...");
        const browser = await chromium.connectOverCDP("http://localhost:9222");
        const clickResult = await performClick(browser, targetPage);

        if (clickResult) {
          lastClickedUrl = clickResult;
          attempts = 0;
          errorPageCount = 0; // Reset contador de erro
          console.log(`Download iniciado! Aguardando ${COOLDOWN_TIME / 1000}s...`);
          await browser.close();
          await sleep(COOLDOWN_TIME);
        } else {
          errorPageCount++; // Incrementa contador de erro
          console.log(`Falha ao clicar no botão de download. Tentativa ${errorPageCount}/${MAX_ERROR_PAGES}...`);
          await browser.close();
          await sleep(2000);
        }
      } else {
        if (lastClickedUrl) {
          const isStillOpen = pages.some((p) => p.url === lastClickedUrl);
          if (isStillOpen) {
            console.log("Download ainda em andamento...");
          } else {
            lastClickedUrl = null;
            console.log("Aguardando nova página de download...");
          }
        } else {
          console.log("Aguardando página de download...");
        }
        await sleep(2000);
      }
    } catch (error) {
      console.error(`Erro na automação: ${error.message}`);
      await sleep(5000);
    }
  }

  isRunning = false;
  console.log("Automação parada.");
}

/**
 * Função de sleep
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Tratamento de interrupção
 */
process.on("SIGINT", () => {
  console.log("\nInterrupção detectada. Parando automação...");
  stopRequested = true;
});

// Executar teste se chamado diretamente
if (require.main === module) {
  runTest().catch(console.error);
}

module.exports = {
  runTest,
  startDownloadAutomation,
  stopRequested: () => stopRequested,
};
