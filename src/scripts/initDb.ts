import pool from '../config/database';
import fs from 'fs';
import path from 'path';

/**
 * Initialize Database Schema
 * 
 * This script runs automatically when the server starts to ensure
 * the database schema exists in the connected database.
 * This is critical for Vercel deployments where we can't manually run SQL scripts.
 */
export const initializeDatabase = async () => {
    try {
        console.log('🔄 Checking database initialization...');

        // Read schema files
        const schemaPath = path.join(__dirname, 'init_schema.sql');
        const settingsSchemaPath = path.join(__dirname, 'init_settings_schema.sql');

        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        const settingsSchemaSql = fs.readFileSync(settingsSchemaPath, 'utf8');

        // Check if analyses table exists
        const checkTableQuery = `
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'analyses'
            );
        `;

        const result = await pool.query(checkTableQuery);
        const exists = result.rows[0].exists;

        if (!exists) {
            console.log('⚠️ Database tables not found. Initializing schema...');

            // Execute schema SQL
            // Splitting by semicolon creates empty statements if trailing newlines exist, so filter them
            await pool.query(schemaSql);
            console.log('✅ Main schema applied successfully');

            // Execute settings schema SQL
            try {
                await pool.query(settingsSchemaSql);
                console.log('✅ Settings schema applied successfully');
            } catch (settingsError) {
                // If settings table already exists (e.g. from partial init), this might fail
                // but we should check if it was just because it existed
                console.warn('⚠️ Settings schema application note:', settingsError instanceof Error ? settingsError.message : settingsError);
            }

            console.log('🎉 Database initialization complete!');
        } else {
            console.log('✅ Database tables already exist. Skipping initialization.');

            // Even if analyses exists, check if settings exists
            const checkSettingsTableQuery = `
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'settings'
                );
            `;
            const settingsResult = await pool.query(checkSettingsTableQuery);
            if (!settingsResult.rows[0].exists) {
                console.log('⚠️ Settings table not found. Initializing settings schema...');
                await pool.query(settingsSchemaSql);
                console.log('✅ Settings schema applied successfully');
            }
        }

    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        // Don't throw error here to avoid crashing the server loop if DB is temporarily unavailable
        // The individual connection attempts will just fail later
    }
};
