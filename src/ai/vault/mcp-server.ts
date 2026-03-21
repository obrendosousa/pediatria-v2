#!/usr/bin/env node
/**
 * MCP Server para o Vault da Clinica.
 * Expoe operacoes de leitura/escrita/busca como MCP tools via stdio.
 *
 * Uso:
 *   npx tsx src/ai/vault/mcp-server.ts
 *
 * Em .mcp.json:
 *   { "vault": { "type": "stdio", "command": "npx", "args": ["tsx", "src/ai/vault/mcp-server.ts"] } }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getVaultService, isVaultAvailable } from "./service";
import { runGraphAnalysis, getBacklinksFor } from "./graph-analyzer";

// ═══════════════════════════════════════════════════════════════════════════
// MCP SERVER — Vault como servico acessivel por qualquer cliente MCP
// ═══════════════════════════════════════════════════════════════════════════

const server = new McpServer({
  name: "clinica-vault",
  version: "1.0.0",
});

// ─────────────────────────────────────────────────────────────────────────
// TOOL: vault_read
// ─────────────────────────────────────────────────────────────────────────

server.tool(
  "vault_read",
  "Le uma nota do Obsidian Vault. O path e relativo ao vault root.",
  { path: z.string().describe("Caminho relativo da nota (ex: 'agents/clara/company.md')") },
  async ({ path }) => {
    if (!(await isVaultAvailable())) {
      return { content: [{ type: "text" as const, text: "Vault indisponivel." }] };
    }
    try {
      const vault = getVaultService();
      const note = await vault.readNote(path);
      const meta = Object.entries(note.frontmatter)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join("\n");
      return {
        content: [{ type: "text" as const, text: `---\n${meta}\n---\n\n${note.content}` }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Erro ao ler '${path}': ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────
// TOOL: vault_write
// ─────────────────────────────────────────────────────────────────────────

server.tool(
  "vault_write",
  "Escreve ou atualiza uma nota no vault com frontmatter YAML.",
  {
    path: z.string().describe("Caminho relativo da nota"),
    content: z.string().describe("Conteudo Markdown da nota"),
    frontmatter: z.string().optional().describe("Frontmatter como JSON string (ex: '{\"type\":\"knowledge\"}')"),
  },
  async ({ path, content, frontmatter }) => {
    if (!(await isVaultAvailable())) {
      return { content: [{ type: "text" as const, text: "Vault indisponivel." }] };
    }
    try {
      const vault = getVaultService();
      const fm = frontmatter ? JSON.parse(frontmatter) : {};
      await vault.writeNote(path, content, fm);
      return { content: [{ type: "text" as const, text: `Nota '${path}' salva com sucesso.` }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Erro ao escrever '${path}': ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────
// TOOL: vault_search
// ─────────────────────────────────────────────────────────────────────────

server.tool(
  "vault_search",
  "Busca textual no vault por palavras-chave.",
  {
    query: z.string().describe("Termo de busca"),
    folder: z.string().optional().describe("Restringir a folder (ex: 'knowledge/')"),
    limit: z.number().optional().describe("Max resultados (padrao: 10)"),
  },
  async ({ query, folder, limit }) => {
    if (!(await isVaultAvailable())) {
      return { content: [{ type: "text" as const, text: "Vault indisponivel." }] };
    }
    try {
      const vault = getVaultService();
      const results = await vault.searchNotes(query, { folder, limit: limit || 10 });
      if (results.length === 0) {
        return { content: [{ type: "text" as const, text: `Nenhum resultado para "${query}".` }] };
      }
      const text = results
        .map((r) => {
          const type = r.frontmatter.type || "unknown";
          return `[${type}] ${r.path}`;
        })
        .join("\n");
      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Erro na busca: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────
// TOOL: vault_list
// ─────────────────────────────────────────────────────────────────────────

server.tool(
  "vault_list",
  "Lista notas de um folder do vault com metadata.",
  {
    folder: z.string().describe("Folder a listar (ex: 'knowledge/', 'decisions/')"),
    limit: z.number().optional().describe("Max resultados (padrao: 20)"),
    type: z.string().optional().describe("Filtrar por tipo (frontmatter.type)"),
  },
  async ({ folder, limit, type }) => {
    if (!(await isVaultAvailable())) {
      return { content: [{ type: "text" as const, text: "Vault indisponivel." }] };
    }
    try {
      const vault = getVaultService();
      const notes = await vault.listNotes(folder, { limit: limit || 20, type });
      if (notes.length === 0) {
        return { content: [{ type: "text" as const, text: `Folder '${folder}' vazio ou inexistente.` }] };
      }
      const text = notes
        .map((n) => {
          const noteType = n.frontmatter.type || "unknown";
          return `[${noteType}] ${n.path} (${n.mtime.toISOString().slice(0, 10)})`;
        })
        .join("\n");
      return { content: [{ type: "text" as const, text: `${notes.length} notas em '${folder}':\n${text}` }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Erro ao listar: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────
// TOOL: vault_append
// ─────────────────────────────────────────────────────────────────────────

server.tool(
  "vault_append",
  "Adiciona conteudo ao final de uma nota existente.",
  {
    path: z.string().describe("Caminho da nota"),
    content: z.string().describe("Conteudo a adicionar"),
  },
  async ({ path, content }) => {
    if (!(await isVaultAvailable())) {
      return { content: [{ type: "text" as const, text: "Vault indisponivel." }] };
    }
    try {
      const vault = getVaultService();
      await vault.appendToNote(path, content);
      return { content: [{ type: "text" as const, text: `Conteudo adicionado a '${path}'.` }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Erro: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────
// TOOL: vault_delete
// ─────────────────────────────────────────────────────────────────────────

server.tool(
  "vault_delete",
  "Remove uma nota do vault.",
  { path: z.string().describe("Caminho da nota a remover") },
  async ({ path }) => {
    if (!(await isVaultAvailable())) {
      return { content: [{ type: "text" as const, text: "Vault indisponivel." }] };
    }
    try {
      const vault = getVaultService();
      await vault.deleteNote(path);
      return { content: [{ type: "text" as const, text: `Nota '${path}' removida.` }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Erro: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────
// TOOL: vault_backlinks
// ─────────────────────────────────────────────────────────────────────────

server.tool(
  "vault_backlinks",
  "Retorna todas as notas que referenciam uma nota via [[wikilinks]].",
  { path: z.string().describe("Caminho da nota") },
  async ({ path }) => {
    try {
      const backlinks = await getBacklinksFor(path);
      if (backlinks.length === 0) {
        return { content: [{ type: "text" as const, text: `Nenhum backlink para '${path}'.` }] };
      }
      const text = backlinks.map((bl) => `- [${bl.type}] ${bl.path}`).join("\n");
      return { content: [{ type: "text" as const, text: `Backlinks (${backlinks.length}):\n${text}` }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Erro: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────
// TOOL: vault_analyze_graph
// ─────────────────────────────────────────────────────────────────────────

server.tool(
  "vault_analyze_graph",
  "Analisa a estrutura do grafo de conhecimento. Identifica orfas, dead ends, hubs e clusters.",
  {},
  async () => {
    try {
      const result = await runGraphAnalysis();
      return { content: [{ type: "text" as const, text: result.summary }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Erro: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────
// TOOL: vault_log_decision
// ─────────────────────────────────────────────────────────────────────────

server.tool(
  "vault_log_decision",
  "Registra uma decisao importante no vault com audit trail.",
  {
    summary: z.string().describe("Resumo da decisao"),
    decided_by: z.string().describe("Quem decidiu (admin, doctor, clara, analyst)"),
    category: z.enum(["operacional", "clinico", "financeiro", "tecnico"]).describe("Categoria"),
    context: z.string().optional().describe("Contexto detalhado"),
  },
  async ({ summary, decided_by, category, context }) => {
    if (!(await isVaultAvailable())) {
      return { content: [{ type: "text" as const, text: "Vault indisponivel." }] };
    }
    try {
      const vault = getVaultService();
      const notePath = await vault.logDecision({ summary, decided_by, category, context });
      return { content: [{ type: "text" as const, text: `Decisao registrada: ${notePath}` }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Erro: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────
// RESOURCE: vault status
// ─────────────────────────────────────────────────────────────────────────

server.resource(
  "vault-status",
  "vault://status",
  async () => {
    const available = await isVaultAvailable();
    const text = available
      ? "Vault ativo e disponivel."
      : "Vault indisponivel (VAULT_ENABLED=false ou diretorio nao encontrado).";
    return { contents: [{ uri: "vault://status", text, mimeType: "text/plain" }] };
  }
);

// ─────────────────────────────────────────────────────────────────────────
// STARTUP
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[MCP Vault] Server iniciado via stdio.");
}

main().catch((err) => {
  console.error("[MCP Vault] Erro fatal:", err);
  process.exit(1);
});
