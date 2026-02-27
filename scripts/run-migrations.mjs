import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

const rawString = process.env.DATABASE_URL || 'postgresql://postgres.juctfolupehtaoehjkwl:SLZ%402015%40eli@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require';
const connectionString = rawString.split('?')[0];
async function runMigrations() {
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to Supabase database.');

        const files = [
            'add_adolescent_consultation_column.sql',
            'add_routine_consultation_column.sql',
            'add_diagnostic_hypothesis_column.sql',
            'add_exam_results_column.sql',
            'add_medical_records_columns.sql'
        ];

        for (const file of files) {
            const filePath = path.join(process.cwd(), 'database', file);
            if (fs.existsSync(filePath)) {
                console.log(`Executing ${file}...`);
                const sql = fs.readFileSync(filePath, 'utf8');
                try {
                    await client.query(sql);
                    console.log(`✅ Successfully executed ${file}`);
                } catch (err) {
                    console.error(`❌ Error executing ${file}:`, err.message);
                }
            } else {
                console.log(`⚠️ File not found: ${filePath}`);
            }
        }

    } catch (err) {
        console.error('Connection error:', err);
    } finally {
        await client.end();
    }
}

runMigrations();
