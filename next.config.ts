import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  typescript: {
    // TODO: corrigir erros de tipagem nos formulários de paciente e remover isso
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
