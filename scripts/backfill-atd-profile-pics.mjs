/**
 * Backfill de fotos de perfil para atendimento.chats
 *
 * A instância `atendimento-alianca` está desconectada, então
 * usa a instância `pediatria v3` (conectada) para buscar as fotos.
 *
 * Estratégia:
 * 1. Copia de public.chats para atendimento.chats onde o phone coincide (rápido)
 * 2. Para phones que não estão no public, busca via Evolution API (pediatria v3)
 */

const SUPA_URL = 'https://juctfolupehtaoehjkwl.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Y3Rmb2x1cGVodGFvZWhqa3dsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTA5NjE4MiwiZXhwIjoyMDcwNjcyMTgyfQ.bPqIbTZOvkVLwVHtZRFaWSaXOBcq9YhzxhbZNUtjtl0';
const EVO_URL = 'https://evolution-evolution-api.rozhd7.easypanel.host';
const EVO_INSTANCE = 'geral-alianca';
const EVO_KEY = '0061D0B4E3C6-45D9-A470-EFA0C3EA886F';

const BATCH_SIZE = 20;
const DELAY_MS = 300; // delay entre requisições Evolution para não rate-limitar

const headers = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  'Content-Type': 'application/json',
};

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Buscar todos os chats do schema atendimento sem foto (exceto IA)
async function getAtendimentoChatsWithoutPic() {
  let all = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const url = `${SUPA_URL}/rest/v1/chats?select=id,phone&profile_pic=is.null&phone=neq.00000000001&limit=${limit}&offset=${offset}`;
    const data = await fetchJson(url, {
      headers: { ...headers, 'Accept-Profile': 'atendimento' }
    });
    if (!data.length) break;
    all = all.concat(data);
    if (data.length < limit) break;
    offset += limit;
  }
  return all;
}

// Buscar fotos do schema public para uma lista de phones
async function getPublicProfilePics(phones) {
  if (!phones.length) return {};
  const map = {};
  // PostgREST in() filter
  const inFilter = phones.map(p => `"${p}"`).join(',');
  const url = `${SUPA_URL}/rest/v1/chats?select=phone,profile_pic&phone=in.(${phones.join(',')})&profile_pic=not.is.null`;
  const data = await fetchJson(url, { headers });
  for (const row of data) {
    map[row.phone] = row.profile_pic;
  }
  return map;
}

// Buscar foto via Evolution API (instância pediatria v3 - conectada)
async function fetchPicFromEvolution(phone) {
  try {
    const res = await fetch(`${EVO_URL}/chat/fetchProfilePictureUrl/${encodeURIComponent(EVO_INSTANCE)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({ number: phone }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const url = data.profilePictureUrl ?? data.profile_picture_url ?? null;
    return typeof url === 'string' && url.startsWith('http') ? url : null;
  } catch {
    return null;
  }
}

// Atualizar profile_pic no atendimento.chats
async function updateAtdProfilePic(id, profile_pic) {
  const url = `${SUPA_URL}/rest/v1/chats?id=eq.${id}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Profile': 'atendimento', Prefer: 'return=minimal' },
    body: JSON.stringify({ profile_pic }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH failed for id=${id}: ${text}`);
  }
}

async function main() {
  console.log('🔍 Buscando chats sem foto no schema atendimento...');
  const chats = await getAtendimentoChatsWithoutPic();
  console.log(`📋 Total sem foto: ${chats.length}`);

  if (!chats.length) {
    console.log('✅ Todos os chats já têm foto!');
    return;
  }

  // --- FASE 1: Copiar do schema public (sem chamar Evolution API) ---
  console.log('\n📋 FASE 1: Copiando fotos do schema public...');
  const phones = chats.map(c => c.phone);

  // Processar em batches para não gerar URL muito longa
  const phonesBatches = [];
  for (let i = 0; i < phones.length; i += 100) {
    phonesBatches.push(phones.slice(i, i + 100));
  }

  const publicPicMap = {};
  for (const batch of phonesBatches) {
    const batchMap = await getPublicProfilePics(batch);
    Object.assign(publicPicMap, batchMap);
  }

  console.log(`   Fotos disponíveis no schema public: ${Object.keys(publicPicMap).length}`);

  let fromPublicCount = 0;
  const remainingChats = [];

  for (const chat of chats) {
    if (publicPicMap[chat.phone]) {
      await updateAtdProfilePic(chat.id, publicPicMap[chat.phone]);
      fromPublicCount++;
    } else {
      remainingChats.push(chat);
    }
  }
  console.log(`   ✅ Copiados do public: ${fromPublicCount}`);
  console.log(`   📋 Restantes para buscar via Evolution: ${remainingChats.length}`);

  // --- FASE 2: Buscar via Evolution API para os que não estão no public ---
  if (remainingChats.length === 0) {
    console.log('\n✅ Fase 2 não necessária.');
    return;
  }

  console.log('\n📋 FASE 2: Buscando fotos via Evolution API (pediatria v3)...');
  let fromEvoCount = 0;
  let nullCount = 0;
  let errorCount = 0;

  for (let i = 0; i < remainingChats.length; i += BATCH_SIZE) {
    const batch = remainingChats.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(remainingChats.length / BATCH_SIZE);
    process.stdout.write(`   Batch ${batchNum}/${totalBatches}... `);

    let batchFound = 0;
    for (const chat of batch) {
      try {
        const pic = await fetchPicFromEvolution(chat.phone);
        if (pic) {
          await updateAtdProfilePic(chat.id, pic);
          batchFound++;
          fromEvoCount++;
        } else {
          nullCount++;
        }
        await sleep(DELAY_MS);
      } catch (e) {
        errorCount++;
      }
    }
    console.log(`encontradas: ${batchFound}/${batch.length}`);
  }

  // --- RESUMO FINAL ---
  console.log('\n════════════════════════════════════════');
  console.log('✅ BACKFILL CONCLUÍDO');
  console.log(`   Do schema public:     ${fromPublicCount}`);
  console.log(`   Via Evolution API:    ${fromEvoCount}`);
  console.log(`   Sem foto (privado):   ${nullCount}`);
  console.log(`   Erros:                ${errorCount}`);
  console.log(`   Total processados:    ${chats.length}`);
  console.log('════════════════════════════════════════');
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
