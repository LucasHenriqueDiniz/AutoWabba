/**
 * Teste de Terminal para AutoWabba
 *
 * Este script testa a lógica de automação diretamente no terminal
 * para identificar problemas sem a interface gráfica
 */

const { chromium } = require("playwright");
const { checkBrowserAvailability, findTargetPage } = require("./src/browser");
const { performClick, hasManyErrorPages } = require("./src/downloader");
const { getWabbajackPath, isWabbajackRunning, launchWabbajackWithDebug } = require("./src/wabbajack");

// Configuração de debug
const DEBUG = true;

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testWabbajackPath() {
  log("=== TESTE 1: Verificando caminho do Wabbajack ===");

  try {
    const path = await getWabbajackPath();
    if (path) {
      log(`✅ Wabbajack path encontrado: ${path}`);
      return path;
    } else {
      log("❌ Nenhum caminho do Wabbajack encontrado");
      log("💡 Execute o AutoWabba normal primeiro para selecionar o caminho");
      return null;
    }
  } catch (error) {
    log(`❌ Erro ao verificar caminho: ${error.message}`);
    return null;
  }
}

async function testWabbajackRunning() {
  log("=== TESTE 2: Verificando se Wabbajack está rodando ===");

  try {
    const running = await isWabbajackRunning();
    if (running) {
      log("✅ Wabbajack está rodando");
    } else {
      log("❌ Wabbajack não está rodando");
    }
    return running;
  } catch (error) {
    log(`❌ Erro ao verificar Wabbajack: ${error.message}`);
    return false;
  }
}

async function testBrowserConnection() {
  log("=== TESTE 3: Verificando conexão com browser ===");

  try {
    const pages = await checkBrowserAvailability();
    if (pages) {
      log(`✅ Browser conectado! Páginas encontradas: ${pages.length}`);

      // Listar páginas
      pages.forEach((page, index) => {
        log(`  ${index + 1}. ${page.type} - ${page.url}`);
      });

      return pages;
    } else {
      log("❌ Browser não disponível na porta 9222");
      return null;
    }
  } catch (error) {
    log(`❌ Erro ao conectar browser: ${error.message}`);
    return null;
  }
}

async function testFindDownloadPage(pages) {
  log("=== TESTE 4: Procurando página de download ===");

  try {
    const targetPage = await findTargetPage(pages);
    if (targetPage) {
      log(`✅ Página de download encontrada: ${targetPage.url}`);
      return targetPage;
    } else {
      log("❌ Nenhuma página de download encontrada");
      log("💡 Certifique-se de que o Wabbajack está na tela de downloads do Nexus");
      return null;
    }
  } catch (error) {
    log(`❌ Erro ao procurar página: ${error.message}`);
    return null;
  }
}

async function testClickDownload(targetPage) {
  log("=== TESTE 5: Testando clique no download ===");

  try {
    const browser = await chromium.connectOverCDP("http://localhost:9222");
    log("✅ Browser conectado via CDP");

    const result = await performClick(browser, targetPage);
    await browser.close();

    if (result) {
      log(`✅ Download iniciado com sucesso! URL: ${result}`);
      return true;
    } else {
      log("❌ Falha ao clicar no botão de download");
      return false;
    }
  } catch (error) {
    log(`❌ Erro ao testar clique: ${error.message}`);
    return false;
  }
}

async function testFullAutomation() {
  log("=== TESTE COMPLETO: Simulando automação ===");

  let isRunning = true;
  let attempts = 0;
  const MAX_ATTEMPTS = 5;

  while (isRunning && attempts < MAX_ATTEMPTS) {
    attempts++;
    log(`\n--- Tentativa ${attempts}/${MAX_ATTEMPTS} ---`);

    try {
      // Verificar browser
      const pages = await checkBrowserAvailability();
      if (!pages) {
        log("⏳ Browser não disponível, aguardando...");
        await sleep(2000);
        continue;
      }

      // Procurar página de download
      const targetPage = await findTargetPage(pages);
      if (!targetPage) {
        log("⏳ Nenhuma página de download encontrada, aguardando...");
        await sleep(2000);
        continue;
      }

      // Tentar clicar
      const success = await testClickDownload(targetPage);
      if (success) {
        log("✅ Automação funcionando corretamente!");
        isRunning = false;
      } else {
        log("⏳ Falha no clique, tentando novamente...");
        await sleep(5000);
      }
    } catch (error) {
      log(`❌ Erro na automação: ${error.message}`);
      await sleep(5000);
    }
  }

  if (attempts >= MAX_ATTEMPTS) {
    log("❌ Máximo de tentativas atingido");
  }
}

async function main() {
  log("🚀 Iniciando testes de terminal do AutoWabba");
  log("=" * 50);

  // Teste 1: Verificar caminho do Wabbajack
  const wjPath = await testWabbajackPath();
  if (!wjPath) {
    log("\n❌ Teste interrompido: caminho do Wabbajack não encontrado");
    return;
  }

  // Teste 2: Verificar se está rodando
  const isRunning = await testWabbajackRunning();
  if (!isRunning) {
    log("\n❌ Teste interrompido: Wabbajack não está rodando");
    log("💡 Inicie o Wabbajack primeiro ou use o AutoWabba normal");
    return;
  }

  // Teste 3: Verificar conexão com browser
  const pages = await testBrowserConnection();
  if (!pages) {
    log("\n❌ Teste interrompido: browser não disponível");
    log("💡 Certifique-se de que o Wabbajack foi iniciado com debug");
    return;
  }

  // Teste 4: Procurar página de download
  const targetPage = await testFindDownloadPage(pages);
  if (!targetPage) {
    log("\n❌ Teste interrompido: página de download não encontrada");
    log("💡 Navegue até uma página de download no Wabbajack");
    return;
  }

  // Teste 5: Testar clique
  await testClickDownload(targetPage);

  // Teste completo
  log("\n" + "=" * 50);
  await testFullAutomation();

  log("\n🏁 Testes concluídos!");
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch((error) => {
    log(`💥 Erro fatal: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  testWabbajackPath,
  testWabbajackRunning,
  testBrowserConnection,
  testFindDownloadPage,
  testClickDownload,
  testFullAutomation,
};
