import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente con service_role: SOLO para crear usuarios / resetear contraseñas en Server Actions
// que ya validaron el permiso del usuario. Nunca importar desde componentes cliente.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
