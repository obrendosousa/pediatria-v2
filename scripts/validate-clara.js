/* eslint-disable @typescript-eslint/no-require-imports */
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  console.log('══════════════════════════════════════════════');
  console.log('  GABARITO REAL DO BANCO - VERDADE ABSOLUTA');
  console.log('══════════════════════════════════════════════');

  // 1. VOLUME EXATO POR DIA
  const vol = await pool.query(`
    SELECT
      (created_at AT TIME ZONE 'America/Sao_Paulo')::date as dia,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE sender = 'CUSTOMER') as paciente,
      COUNT(*) FILTER (WHERE sender = 'HUMAN_AGENT') as secretaria,
      COUNT(*) FILTER (WHERE sender = 'AI_AGENT') as bot,
      COUNT(DISTINCT chat_id) as chats
    FROM chat_messages
    WHERE created_at >= '2026-03-16T00:00:00-03:00' AND created_at < '2026-03-19T00:00:00-03:00'
    GROUP BY 1 ORDER BY 1
  `);
  console.log('\n=== VOLUME POR DIA (EXATO) ===');
  let tM = 0, tP = 0, tS = 0;
  vol.rows.forEach(r => {
    console.log(`${r.dia} | msgs=${r.total} | paciente=${r.paciente} | secretaria=${r.secretaria} | bot=${r.bot} | chats=${r.chats}`);
    tM += +r.total; tP += +r.paciente; tS += +r.secretaria;
  });
  const chatsUniq = await pool.query(`SELECT COUNT(DISTINCT chat_id) as t FROM chat_messages WHERE created_at >= '2026-03-16T00:00:00-03:00' AND created_at < '2026-03-19T00:00:00-03:00'`);
  console.log(`\nTOTAIS: msgs=${tM} | paciente=${tP} | secretaria=${tS} | chats_unicos=${chatsUniq.rows[0].t}`);

  // COMPARAR COM CLARA:
  console.log('\n--- CLARA DISSE: 81 chats, 1026 msgs, paciente=562, secretaria=443 ---');
  console.log(`--- REAL: ${chatsUniq.rows[0].t} chats, ${tM} msgs, paciente=${tP}, secretaria=${tS} ---`);

  // 2. OBJEÇÕES EXATAS
  const obj = await pool.query(`
    SELECT c.contact_name, cm.message_text, cm.chat_id
    FROM chat_messages cm JOIN chats c ON c.id = cm.chat_id
    WHERE cm.created_at >= '2026-03-16T00:00:00-03:00' AND cm.created_at < '2026-03-19T00:00:00-03:00'
      AND cm.sender = 'CUSTOMER' AND cm.message_type = 'text' AND length(cm.message_text) > 3
      AND (cm.message_text ILIKE '%valor%' OR cm.message_text ILIKE '%quanto%'
        OR cm.message_text ILIKE '%custa%' OR cm.message_text ILIKE '%caro%'
        OR cm.message_text ILIKE '%desconto%' OR cm.message_text ILIKE '%cancelar%'
        OR cm.message_text ILIKE '%desist%' OR cm.message_text ILIKE '%500%'
        OR cm.message_text ILIKE '%reajuste%' OR cm.message_text ILIKE '%pagar%')
    ORDER BY cm.created_at
  `);
  console.log(`\n=== OBJEÇÕES/PREÇO EXATAS (${obj.rows.length} msgs) ===`);
  obj.rows.forEach(r => console.log(`chat:${r.chat_id} | ${r.contact_name} | ${(r.message_text||'').slice(0,150)}`));

  // 3. Verificar chats citados pela Clara
  console.log('\n=== VERIFICAÇÃO DOS CHATS CITADOS PELA CLARA ===');
  const cited = [
    { id: 1638, name: 'Deus é Fiel', claim: 'objeção urgência/febre' },
    { id: 1669, name: 'Leudimar Sousa', claim: 'apelo emocional para encaixe' },
    { id: 1601, name: 'Gabriel', claim: 'travou agendamento p/ perguntar retorno' },
    { id: 1680, name: 'Raimunda Penha', claim: 'consulta sobre valores' },
    { id: 1563, name: 'Josilene Almeida', claim: 'garantir atendimento antes 13h' },
    { id: 1514, name: 'Leyne', claim: 'cancelou por chuvas/estradas' },
    { id: 1637, name: 'Cris Brandão', claim: 'aceitou R$800 check-up' },
    { id: 179,  name: 'Francisca Porto', claim: 'respondeu "Ta certo então" ao preço' },
    { id: 1663, name: '🐾', claim: 'pediu PIX após cotação R$500' },
  ];

  for (const c of cited) {
    const { rows: info } = await pool.query(`SELECT contact_name, phone FROM chats WHERE id = $1`, [c.id]);
    const { rows: msgs } = await pool.query(`
      SELECT sender, message_text FROM chat_messages
      WHERE chat_id = $1 AND created_at >= '2026-03-16T00:00:00-03:00' AND created_at < '2026-03-19T00:00:00-03:00'
        AND sender = 'CUSTOMER' AND message_type = 'text' AND length(message_text) > 3
      ORDER BY created_at LIMIT 15
    `, [c.id]);

    const exists = info.length > 0;
    const realName = exists ? info[0].contact_name : 'N/A';
    const hasMsgs = msgs.length > 0;
    const status = exists && hasMsgs ? '✅' : exists ? '⚠️ sem msgs CUSTOMER' : '❌ não existe';

    console.log(`\nchat:${c.id} | Clara: "${c.name}" | Real: "${realName}" | ${status}`);
    console.log(`  Claim: ${c.claim}`);
    if (hasMsgs) {
      msgs.slice(0, 5).forEach(m => console.log(`  MSG: ${(m.message_text||'').slice(0,120)}`));
    }
  }

  // 4. Recusas explícitas de preço
  console.log('\n=== HOUVE RECUSA EXPLÍCITA DE PREÇO? ===');
  const recusas = await pool.query(`
    SELECT c.contact_name, cm.message_text, cm.chat_id
    FROM chat_messages cm JOIN chats c ON c.id = cm.chat_id
    WHERE cm.created_at >= '2026-03-16T00:00:00-03:00' AND cm.created_at < '2026-03-19T00:00:00-03:00'
      AND cm.sender = 'CUSTOMER' AND length(cm.message_text) > 5
      AND (cm.message_text ILIKE '%caro%' OR cm.message_text ILIKE '%não quero%'
        OR cm.message_text ILIKE '%desist%' OR cm.message_text ILIKE '%cancelar%')
  `);
  console.log(`Recusas encontradas: ${recusas.rows.length}`);
  recusas.rows.forEach(r => console.log(`  chat:${r.chat_id} | ${r.contact_name} | ${(r.message_text||'').slice(0,150)}`));

  // 5. Total de chats com QUALQUER interação vs o que Clara analisou
  const allChats = await pool.query(`
    SELECT COUNT(DISTINCT cm.chat_id) as total
    FROM chat_messages cm JOIN chats c ON c.id = cm.chat_id
    WHERE cm.created_at >= '2026-03-16T00:00:00-03:00' AND cm.created_at < '2026-03-19T00:00:00-03:00'
      AND c.phone != '00000000000'
  `);
  console.log(`\n=== COBERTURA ===`);
  console.log(`Total chats com msgs (excl. Clara): ${allChats.rows[0].total}`);
  console.log(`Clara disse ter analisado: 68 conversas`);

  await pool.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
