import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://eeyserphexequckonzsh.supabase.co';
export const SUPABASE_ANON_KEY = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVleXNlcnBoZXhlcXVja29uenNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NDU0MzgsImV4cCI6MjA5NDMyMTQzOH0',
  'bcbw8jf2p5gBj1JPN4TxIu5WfweP8em4dTx_5so9hgw',
].join('.');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
