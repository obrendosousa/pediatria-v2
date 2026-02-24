-- Pré-checagem antes de aplicar índice único em chat_messages.wpp_id.
-- Se esta consulta retornar linhas, há duplicatas históricas para tratar.
SELECT
  wpp_id,
  COUNT(*) AS total,
  MIN(id) AS oldest_id,
  MAX(id) AS newest_id
FROM public.chat_messages
WHERE wpp_id IS NOT NULL
  AND btrim(wpp_id) <> ''
GROUP BY wpp_id
HAVING COUNT(*) > 1
ORDER BY total DESC, wpp_id;
