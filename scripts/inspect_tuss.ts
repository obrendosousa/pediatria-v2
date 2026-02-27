import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Supabase Client using env vars
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function seedTuss() {
    console.log('Loading official TUSS JSON table...');

    try {
        const jsonPath = path.join(process.cwd(), 'data', 'tabelas_ans_repo', 'TUSS', 'tabela 22', 'tabela_22.json');
        const fileContent = fs.readFileSync(jsonPath, 'utf-8');
        const jsonData = JSON.parse(fileContent);
        const rows = jsonData.rows || [];

        const recordsToInsert = [];
        const seenCodes = new Set();

        for (const row of rows) {
            if (!row.codigo || !row.procedimento) continue;

            let code = String(row.codigo).trim();
            const name = String(row.procedimento).trim();

            if (seenCodes.has(code)) {
                continue;
            }

            seenCodes.add(code);
            recordsToInsert.push({
                code,
                name,
                category: 'TUSS Tabelas ANS'
            });
        }

        console.log(`Prepared ${recordsToInsert.length} distinct official procedures for insertion.`);
        if (recordsToInsert.length === 0) return;

        console.log('Clearing old tuss_procedures data...');
        const { error: deleteError } = await supabase.from('tuss_procedures').delete().neq('id', 0);
        if (deleteError) {
            console.error('Warning: could not clear old data (maybe RLS).', deleteError);
        }

        const batchSize = 1000;

        for (let i = 0; i < recordsToInsert.length; i += batchSize) {
            const batch = recordsToInsert.slice(i, i + batchSize);
            console.log(`Inserting batch ${i / batchSize + 1}...`);

            const { error } = await supabase
                .from('tuss_procedures')
                .insert(batch);

            if (error) {
                console.error('Error in batch insertion:', error);
            }
        }

        console.log('Seed completed successfully!');

        // Verify the user's specific codes
        const targetCode = '20201125';
        const hasTarget = recordsToInsert.some((r: any) => r.code === targetCode);
        console.log(`Did the JSON contain the newly missing code (${targetCode})? ${hasTarget}`);

    } catch (error) {
        console.error('Error during seed:', error);
    }
}

seedTuss();
