// Script auxiliar para carregar dados
fetch('test-explanations.json')
  .then(r => r.json())
  .then(data => {
    window.TEST_DATA = data;
    if (window.onDataLoaded) window.onDataLoaded();
  })
  .catch(err => {
    console.error('Erro ao carregar:', err);
    alert('❌ Erro ao carregar test-explanations.json\n\nSolução: Abra com servidor HTTP:\ncd qa/mcp-Quality-CLI/tests/analyses/\npython3 -m http.server 8080');
  });
