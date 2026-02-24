export async function POST() {
  return Response.json(
    {
      status: "disabled",
      reason: "manual_sync_disabled",
      message:
        "Sincronização manual foi desativada. O sistema processa apenas mensagens novas após conexão ativa.",
    },
    { status: 410 }
  );
}
