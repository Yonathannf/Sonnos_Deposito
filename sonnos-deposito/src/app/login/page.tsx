import { iniciarSesion } from "./actions";

const MENSAJES: Record<string, string> = {
  datos: "Completá email y contraseña.",
  credenciales: "Email o contraseña incorrectos.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        action={iniciarSesion}
        className="w-full max-w-sm space-y-5 rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sonnos Depósito</h1>
          <p className="mt-1 text-sm text-slate-500">Ingresá con tu usuario</p>
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {MENSAJES[error] ?? "No se pudo iniciar sesión."}
          </p>
        )}
        <label className="block text-sm font-medium">
          Email
          <input name="email" type="email" required autoComplete="username"
            className="mt-1 h-12 w-full rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-slate-900" />
        </label>
        <label className="block text-sm font-medium">
          Contraseña
          <input name="password" type="password" required autoComplete="current-password"
            className="mt-1 h-12 w-full rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-slate-900" />
        </label>
        <button className="h-12 w-full rounded-lg bg-slate-900 text-base font-semibold text-white hover:bg-slate-700">
          Entrar
        </button>
      </form>
    </main>
  );
}
