import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cxjqzbyhilrimjbnqjjf.supabase.co';
const supabaseAnonKey = 'sb_publishable_IrC8XntZO7hRlCsx8ldzQQ_36r5YMc-';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
