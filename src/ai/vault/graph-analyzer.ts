import { getVaultService, isVaultAvailable } from "./service";
import type { VaultNoteMeta } from "./types";

// ═══════════════════════════════════════════════════════════════════════════
// VAULT GRAPH ANALYZER — Analise estrutural do grafo de conhecimento
// Parseia [[wikilinks]], constroi grafo de adjacencia, identifica padroes
// ═══════════════════════════════════════════════════════════════════════════

/** No do grafo (uma nota do vault) */
interface GraphNode {
  path: string;
  type: string;
  outLinks: string[];   // Notas que esta nota referencia
  inLinks: string[];    // Notas que referenciam esta nota (backlinks)
}

/** Resultado da analise de grafo */
export interface GraphAnalysisResult {
  totalNodes: number;
  totalEdges: number;
  orphans: string[];        // Notas sem links de entrada nem saida
  deadEnds: string[];       // Notas referenciadas que nao existem
  hubs: { path: string; inLinks: number }[];   // Top notas mais referenciadas
  bridges: string[];        // Notas que conectam clusters separados
  clusters: string[][];     // Componentes conectados
  summary: string;          // Resumo legivel
}

/** Regex para capturar [[wikilinks]] com alias opcional */
const WIKILINK_REGEX = /\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g;

export class VaultGraphAnalyzer {
  private nodes: Map<string, GraphNode> = new Map();
  private allNotes: Set<string> = new Set();

  /** Constroi o grafo completo do vault */
  async build(): Promise<void> {
    if (!(await isVaultAvailable())) {
      throw new Error("Vault indisponivel");
    }

    const vault = getVaultService();
    this.nodes.clear();
    this.allNotes.clear();

    // Listar todas as notas do vault
    const folders = [
      "agents/", "knowledge/", "memories/", "reports/",
      "decisions/", "chat-notes/", "daily/", "graphs/", "inbox/",
    ];

    const allMeta: VaultNoteMeta[] = [];
    for (const folder of folders) {
      try {
        const notes = await vault.listNotes(folder, { limit: 500, sortBy: "mtime" });
        allMeta.push(...notes);
      } catch {
        // Folder pode nao existir
      }
    }

    // Ler cada nota e extrair wikilinks
    for (const meta of allMeta) {
      this.allNotes.add(meta.path);

      try {
        const note = await vault.readNote(meta.path);
        const outLinks = this._extractWikilinks(note.content);

        this.nodes.set(meta.path, {
          path: meta.path,
          type: String(meta.frontmatter.type || "unknown"),
          outLinks,
          inLinks: [],
        });
      } catch {
        this.nodes.set(meta.path, {
          path: meta.path,
          type: String(meta.frontmatter.type || "unknown"),
          outLinks: [],
          inLinks: [],
        });
      }
    }

    // Computar backlinks (inLinks)
    for (const [sourcePath, node] of this.nodes) {
      for (const targetName of node.outLinks) {
        // Resolver nome para path (busca por basename match)
        const targetPath = this._resolveLink(targetName);
        if (targetPath && this.nodes.has(targetPath)) {
          this.nodes.get(targetPath)!.inLinks.push(sourcePath);
        }
      }
    }
  }

  /** Executa analise completa do grafo */
  analyze(): GraphAnalysisResult {
    const totalNodes = this.nodes.size;
    let totalEdges = 0;

    // Contar arestas
    for (const node of this.nodes.values()) {
      totalEdges += node.outLinks.length;
    }

    // Orfas: notas sem links de entrada E sem links de saida
    const orphans: string[] = [];
    for (const [path, node] of this.nodes) {
      if (node.inLinks.length === 0 && node.outLinks.length === 0) {
        orphans.push(path);
      }
    }

    // Dead ends: links que apontam para notas que nao existem
    const deadEnds = new Set<string>();
    for (const node of this.nodes.values()) {
      for (const targetName of node.outLinks) {
        const targetPath = this._resolveLink(targetName);
        if (!targetPath || !this.nodes.has(targetPath)) {
          deadEnds.add(targetName);
        }
      }
    }

    // Hubs: top 10 notas com mais backlinks
    const hubs = Array.from(this.nodes.entries())
      .map(([path, node]) => ({ path, inLinks: node.inLinks.length }))
      .filter((h) => h.inLinks > 0)
      .sort((a, b) => b.inLinks - a.inLinks)
      .slice(0, 10);

    // Clusters: componentes conectados (BFS/Union-Find simplificado)
    const clusters = this._findClusters();

    // Bridges: notas que, se removidas, aumentariam o numero de clusters
    const bridges = this._findBridges(clusters);

    // Gerar resumo
    const summary = this._buildSummary({
      totalNodes,
      totalEdges,
      orphans,
      deadEnds: Array.from(deadEnds),
      hubs,
      bridges,
      clusters,
    });

    return {
      totalNodes,
      totalEdges,
      orphans: orphans.slice(0, 20), // Limitar output
      deadEnds: Array.from(deadEnds).slice(0, 20),
      hubs,
      bridges: bridges.slice(0, 10),
      clusters,
      summary,
    };
  }

  /** Retorna backlinks de uma nota especifica */
  getBacklinksFor(notePath: string): { path: string; type: string }[] {
    const node = this.nodes.get(notePath);
    if (!node) return [];

    return node.inLinks.map((sourcePath) => {
      const sourceNode = this.nodes.get(sourcePath);
      return {
        path: sourcePath,
        type: sourceNode?.type || "unknown",
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS INTERNOS
  // ─────────────────────────────────────────────────────────────────────────

  /** Extrai nomes de wikilinks do conteudo */
  private _extractWikilinks(content: string): string[] {
    const links: string[] = [];
    let match: RegExpExecArray | null;
    // Reset regex state
    WIKILINK_REGEX.lastIndex = 0;
    while ((match = WIKILINK_REGEX.exec(content)) !== null) {
      links.push(match[1].trim());
    }
    return [...new Set(links)]; // Deduplicar
  }

  /** Resolve nome de wikilink para path real no vault */
  private _resolveLink(linkName: string): string | null {
    // Primeiro: match exato de path
    if (this.allNotes.has(linkName)) return linkName;
    if (this.allNotes.has(linkName + ".md")) return linkName + ".md";

    // Segundo: match por basename (sem diretorio)
    for (const notePath of this.allNotes) {
      const basename = notePath.split("/").pop()?.replace(".md", "") || "";
      if (basename.toLowerCase() === linkName.toLowerCase()) {
        return notePath;
      }
    }

    return null;
  }

  /** Encontra componentes conectados via BFS */
  private _findClusters(): string[][] {
    const visited = new Set<string>();
    const clusters: string[][] = [];

    for (const path of this.nodes.keys()) {
      if (visited.has(path)) continue;

      const cluster: string[] = [];
      const queue = [path];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);
        cluster.push(current);

        const node = this.nodes.get(current);
        if (!node) continue;

        // Seguir outLinks
        for (const targetName of node.outLinks) {
          const targetPath = this._resolveLink(targetName);
          if (targetPath && !visited.has(targetPath)) {
            queue.push(targetPath);
          }
        }

        // Seguir inLinks (grafo nao-direcionado para clusters)
        for (const sourcePath of node.inLinks) {
          if (!visited.has(sourcePath)) {
            queue.push(sourcePath);
          }
        }
      }

      if (cluster.length > 0) {
        clusters.push(cluster);
      }
    }

    // Ordenar clusters por tamanho (maior primeiro)
    clusters.sort((a, b) => b.length - a.length);
    return clusters;
  }

  /** Identifica notas-ponte (heuristica: notas com inLinks de clusters diferentes) */
  private _findBridges(clusters: string[][]): string[] {
    if (clusters.length <= 1) return [];

    // Criar map de path → cluster index
    const clusterMap = new Map<string, number>();
    clusters.forEach((cluster, idx) => {
      for (const path of cluster) {
        clusterMap.set(path, idx);
      }
    });

    const bridges: string[] = [];

    for (const [path, node] of this.nodes) {
      // Uma nota e ponte se tem links de/para clusters diferentes
      const linkedClusters = new Set<number>();
      const ownCluster = clusterMap.get(path);
      if (ownCluster !== undefined) linkedClusters.add(ownCluster);

      for (const targetName of node.outLinks) {
        const targetPath = this._resolveLink(targetName);
        if (targetPath) {
          const targetCluster = clusterMap.get(targetPath);
          if (targetCluster !== undefined) linkedClusters.add(targetCluster);
        }
      }

      for (const sourcePath of node.inLinks) {
        const sourceCluster = clusterMap.get(sourcePath);
        if (sourceCluster !== undefined) linkedClusters.add(sourceCluster);
      }

      if (linkedClusters.size > 1) {
        bridges.push(path);
      }
    }

    return bridges;
  }

  /** Gera resumo legivel da analise */
  private _buildSummary(result: Omit<GraphAnalysisResult, "summary">): string {
    const lines: string[] = [
      `# Analise do Grafo de Conhecimento`,
      ``,
      `## Visao Geral`,
      `- **Total de notas:** ${result.totalNodes}`,
      `- **Total de links:** ${result.totalEdges}`,
      `- **Clusters (componentes conectados):** ${result.clusters.length}`,
      `- **Notas orfas (sem conexoes):** ${result.orphans.length}`,
      `- **Links quebrados (dead ends):** ${result.deadEnds.length}`,
      ``,
    ];

    if (result.hubs.length > 0) {
      lines.push(`## Hubs (notas mais referenciadas)`);
      for (const hub of result.hubs.slice(0, 5)) {
        lines.push(`- **${hub.path}** — ${hub.inLinks} backlinks`);
      }
      lines.push(``);
    }

    if (result.deadEnds.length > 0) {
      lines.push(`## Links Quebrados (notas referenciadas que nao existem)`);
      for (const de of result.deadEnds.slice(0, 10)) {
        lines.push(`- [[${de}]]`);
      }
      lines.push(``);
    }

    if (result.orphans.length > 0) {
      lines.push(`## Notas Orfas (sem conexoes)`);
      for (const orphan of result.orphans.slice(0, 10)) {
        lines.push(`- ${orphan}`);
      }
      lines.push(``);
    }

    if (result.bridges.length > 0) {
      lines.push(`## Notas-Ponte (conectam clusters diferentes)`);
      for (const bridge of result.bridges.slice(0, 5)) {
        lines.push(`- ${bridge}`);
      }
      lines.push(``);
    }

    if (result.clusters.length > 1) {
      lines.push(`## Clusters Tematicos`);
      for (let i = 0; i < Math.min(result.clusters.length, 5); i++) {
        const cluster = result.clusters[i];
        lines.push(`- **Cluster ${i + 1}** (${cluster.length} notas): ${cluster.slice(0, 5).join(", ")}${cluster.length > 5 ? "..." : ""}`);
      }
      lines.push(``);
    }

    return lines.join("\n");
  }
}

/** Executa analise completa e salva resultado no vault */
export async function runGraphAnalysis(): Promise<GraphAnalysisResult> {
  const analyzer = new VaultGraphAnalyzer();
  await analyzer.build();
  const result = analyzer.analyze();

  // Salvar resultados no vault
  const vault = getVaultService();

  await vault.writeNote("graphs/topic-map.md", result.summary, {
    type: "graph_analysis",
    analysis_type: "topic_map",
    last_generated: new Date().toISOString().slice(0, 10),
    auto_generated: true,
    total_nodes: result.totalNodes,
    total_edges: result.totalEdges,
    orphan_count: result.orphans.length,
    dead_end_count: result.deadEnds.length,
    cluster_count: result.clusters.length,
  });

  // Gap analysis: focar em dead ends e orfas
  const gapLines = [
    `# Gap Analysis — ${new Date().toISOString().slice(0, 10)}`,
    ``,
    `## Links Quebrados (${result.deadEnds.length})`,
    `Notas referenciadas por [[wikilinks]] que ainda nao existem no vault.`,
    `Cada uma representa um gap de conhecimento que deveria ser preenchido.`,
    ``,
    ...result.deadEnds.map((de) => `- [[${de}]]`),
    ``,
    `## Notas Orfas (${result.orphans.length})`,
    `Notas isoladas, sem links para outras notas e sem backlinks.`,
    `Considerar integrar ao grafo ou remover se obsoletas.`,
    ``,
    ...result.orphans.slice(0, 30).map((o) => `- ${o}`),
  ];

  await vault.writeNote("graphs/gap-analysis.md", gapLines.join("\n"), {
    type: "graph_analysis",
    analysis_type: "gap_analysis",
    last_generated: new Date().toISOString().slice(0, 10),
    auto_generated: true,
    dead_ends: result.deadEnds.length,
    orphans: result.orphans.length,
  });

  return result;
}

/** Retorna backlinks de uma nota especifica (sem precisar rebuildar o grafo inteiro) */
export async function getBacklinksFor(
  notePath: string
): Promise<{ path: string; type: string }[]> {
  const vault = getVaultService();
  const backlinks = await vault.getBacklinks(notePath);
  return backlinks.map((bl) => ({
    path: bl.path,
    type: String(bl.frontmatter.type || "unknown"),
  }));
}
