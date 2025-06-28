/**
 * Teste Rápido - Verifica se a lógica básica está funcionando
 */

const { checkBrowserAvailability, findTargetPage } = require("./src/browser");
const { isWabbajackRunning } = require("./src/wabbajack");

async function testQuick() {
  console.log("=== TESTE RÁPIDO ===");

  // Teste 1: Wabbajack rodando?
  console.log("1. Verificando se Wabbajack está rodando...");
  const wjRunning = await isWabbajackRunning();
  console.log(`   Wabbajack rodando: ${wjRunning ? "SIM" : "NÃO"}`);

  if (!wjRunning) {
    console.log("   ❌ Wabbajack não está rodando. Inicie primeiro.");
    return;
  }

  // Teste 2: Browser disponível?
  console.log("2. Verificando browser na porta 9222...");
  const pages = await checkBrowserAvailability();
  console.log(`   Browser disponível: ${pages ? "SIM" : "NÃO"}`);

  if (!pages) {
    console.log("   ❌ Browser não disponível. Wabbajack não foi iniciado com debug.");
    return;
  }

  console.log(`   Páginas encontradas: ${pages.length}`);
  pages.forEach((page, i) => {
    console.log(`     ${i + 1}. ${page.url}`);
  });

  // Teste 3: Página de download?
  console.log("3. Procurando página de download...");
  const downloadPage = await findTargetPage(pages);
  console.log(`   Página de download: ${downloadPage ? "ENCONTRADA" : "NÃO ENCONTRADA"}`);

  if (downloadPage) {
    console.log(`   URL: ${downloadPage.url}`);
    console.log("   ✅ Tudo pronto para automação!");
  } else {
    console.log("   ⚠️  Navegue até uma página de download no Wabbajack");
  }
}

testQuick().catch(console.error);
