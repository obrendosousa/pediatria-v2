import { notFound } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/automation/adapters/supabaseAdmin";
import ReportViewer from "./ReportViewer";

interface Props {
  params: { id: string };
}

export default async function ReportPage({ params }: Props) {
  const id = Number(params.id);
  if (!id || isNaN(id)) notFound();

  const supabase = getSupabaseAdminClient();
  const { data, error } = await (supabase as any)
    .from("clara_reports")
    .select("id, titulo, conteudo_markdown, tipo, created_at")
    .eq("id", id)
    .single();

  if (error || !data) notFound();

  return <ReportViewer report={data} />;
}
