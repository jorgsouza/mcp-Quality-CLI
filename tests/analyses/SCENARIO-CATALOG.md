# Catálogo de Cenários de Teste - Quality-MCP

**Data:** 2025-10-31  
**Total de Cenários:** 18

---

## 📊 Visão Geral

### Por Prioridade

| Prioridade | Quantidade | Percentual |
|------------|------------|------------|
| **P1 (Crítico)** | 0 | 0.0% |
| **P2 (Importante)** | 0 | 0.0% |
| **P3 (Normal)** | 18 | 100.0% |

### Por Squad

- **unassigned:** 1 cenários
- **tools:** 15 cenários
- **detectors:** 2 cenários

### Por Tipo de Teste

- **UNIT:** 18

## 🔗 Cenários Cross-Squad

_Nenhum cenário com dependências cross-squad detectado._

## ⚠️ Duplicatas Detectadas

- **"deve ter comportamento esperado"**
  - Implementado por: unassigned, tools
  - **Ação:** Consolidar em uma única squad

## 📋 Cenários por Domínio


### __TESTS__ (18 cenários)

| Cenário | Squad | Prioridade | Tipo |
|---------|-------|------------|------|
| deve ter comportamento esperado | unassigned | P3 | unit |
| deve instanciar corretamente | tools | P3 | unit |
| deve ter métodos públicos | tools | P3 | unit |
| deve instanciar corretamente | tools | P3 | unit |
| deve ter métodos públicos | tools | P3 | unit |
| deve instanciar corretamente | tools | P3 | unit |
| deve ter métodos públicos | tools | P3 | unit |
| deve instanciar corretamente | tools | P3 | unit |
| deve ter métodos públicos | tools | P3 | unit |
| deve ter comportamento esperado | tools | P3 | unit |
| deve instanciar corretamente | tools | P3 | unit |
| deve ter métodos públicos | tools | P3 | unit |
| deve instanciar corretamente | tools | P3 | unit |
| deve ter métodos públicos | tools | P3 | unit |
| deve instanciar corretamente | tools | P3 | unit |
| deve ter métodos públicos | tools | P3 | unit |
| deve executar com sucesso | detectors | P3 | unit |
| deve lidar com erros | detectors | P3 | unit |


## 🎯 Recomendações


### Eliminar Duplicatas

- Consolidar "deve ter comportamento esperado" (implementado por unassigned e tools)




### Cobertura por Squad


**unassigned:**
- ⚠️ Nenhum cenário P1
- 1 testes unitários
- 0 testes E2E


**tools:**
- ⚠️ Nenhum cenário P1
- 15 testes unitários
- 0 testes E2E


**detectors:**
- ⚠️ Nenhum cenário P1
- 2 testes unitários
- 0 testes E2E


## 📈 Próximos Passos

1. [ ] Revisar e validar cenários com cada squad
2. [ ] Eliminar duplicatas identificadas
3. [ ] Documentar contratos para cenários cross-squad
4. [ ] Definir owners para cenários "unassigned"
5. [ ] Estabelecer SLAs de manutenção por prioridade

## 🔄 Manutenção

Este catálogo deve ser atualizado:
- ✅ Semanalmente (automático via CI)
- ✅ Antes de releases
- ✅ Quando adicionar novos cenários

```bash
# Atualizar catálogo
quality catalog --repo . --product "Quality-MCP"

# Ver diferenças
git diff tests/analyses/SCENARIO-CATALOG.md
```

---

**Gerado por:** Quality MCP v0.2.0  
**Timestamp:** 2025-10-31T21:46:24.283Z
