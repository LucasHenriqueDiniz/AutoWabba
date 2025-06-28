/**
 * Teste Simples - AutoWabba
 *
 * Executa apenas a lógica essencial sem interface gráfica
 */

const { runTest } = require("./main_test");

console.log("=== AutoWabba - Teste Simples ===");
console.log("Este teste irá:");
console.log("1. Carregar ou solicitar o caminho do Wabbajack");
console.log("2. Lançar o Wabbajack em modo debug");
console.log("3. Aguardar inicialização");
console.log("4. Iniciar automação de downloads");
console.log("5. Pressione Ctrl+C para parar\n");

// Executar o teste
runTest()
  .then(() => {
    console.log("\n=== Teste concluído ===");
  })
  .catch((error) => {
    console.error("\n=== Erro no teste ===");
    console.error(error);
    process.exit(1);
  });
