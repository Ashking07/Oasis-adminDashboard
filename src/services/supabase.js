import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = "https://uceahnvsaaxotaucckmi.supabase.co";
const supabaseKey = "sb_publishable_pyFLS5GHU2DEzorbnT0bCg_H9z2RhAK";
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
