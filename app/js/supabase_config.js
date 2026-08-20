/**
 * AGRIGIS SUPABASE AUTH & REALTIME CLIENT CONFIGURATION
 * Hỗ trợ khởi tạo Supabase Client với cấu hình đám mây và lưu trữ cục bộ
 */

const SupabaseConfig = {
  // Cấu hình mặc định của dự án (Có thể tuỳ chỉnh hoặc ghi đè từ LocalStorage)
  DEFAULT_URL: 'https://whqfqnfrgoxpypzrygvy.supabase.co',
  DEFAULT_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocWZxbmZyZ294cHlwenJ5Z3Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgwMDAwMDAsImV4cCI6MjAyMzU3NjAwMH0.sample_key_placeholder',

  getUrl() {
    return localStorage.getItem('agrigis_supabase_url') || this.DEFAULT_URL;
  },

  getAnonKey() {
    return localStorage.getItem('agrigis_supabase_anon_key') || this.DEFAULT_ANON_KEY;
  },

  saveConfig(url, anonKey) {
    if (url) localStorage.setItem('agrigis_supabase_url', url.trim());
    if (anonKey) localStorage.setItem('agrigis_supabase_anon_key', anonKey.trim());
    this.initClient();
  },

  client: null,

  initClient() {
    if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
      try {
        const url = this.getUrl();
        const key = this.getAnonKey();
        this.client = window.supabase.createClient(url, key, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: window.localStorage
          }
        });
        window.supabaseClient = this.client;
        console.log('✅ Supabase Client initialized successfully for AgriGIS.');
        return this.client;
      } catch (err) {
        console.warn('⚠️ Supabase createClient warning:', err);
      }
    } else {
      console.warn('⚠️ Supabase JS SDK not loaded yet. Waiting for script...');
    }
    return null;
  },

  getClient() {
    if (!this.client) {
      return this.initClient();
    }
    return this.client;
  }
};

// Expose globally
window.SupabaseConfig = SupabaseConfig;
