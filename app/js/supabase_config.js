/**
 * AGRIGIS SUPABASE AUTH & REALTIME CLIENT CONFIGURATION
 * Hỗ trợ khởi tạo Supabase Client với cấu hình đám mây và lưu trữ cục bộ
 */

const SupabaseConfig = {
  // Cấu hình mặc định của dự án (Có thể tuỳ chỉnh hoặc ghi đè từ LocalStorage)
  DEFAULT_URL: 'https://ktessxzesjrsjcngsmpc.supabase.co',
  DEFAULT_ANON_KEY: 'sb_publishable_2gUybT58Q_Bqzs54Y2ZiUg_dQEuvKQT',

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
