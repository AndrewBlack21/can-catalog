import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Leaf, LockKeyhole } from "lucide-react";
import Header from "../../components/Header.jsx";
import { isSupabaseConfigured, supabase } from "../../lib/supabase.js";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;

    async function redirectIfAlreadyAuthenticated() {
      if (!isSupabaseConfigured) return;

      const { data, error: sessionError } = await supabase.auth.getSession();
      const currentSession = sessionError ? null : data.session;
      if (!currentSession?.user?.id) return;

      const { data: admin, error: adminError } = await supabase
        .from("catalog_admins")
        .select("user_id")
        .eq("user_id", currentSession.user.id)
        .maybeSingle();

      if (alive && !adminError && admin) navigate("/adm/painel", { replace: true });
    }

    redirectIfAlreadyAuthenticated();
    return () => {
      alive = false;
    };
  }, [navigate]);

  if (!isSupabaseConfigured)
    return (
      <>
        <Header />
        <main className="auth-wrap">
          <div className="auth-card">
            <LockKeyhole size={26} />
            <h1>Configure o Supabase</h1>
            <p>
              Adicione as variáveis de ambiente no arquivo .env.local para
              habilitar o login administrativo.
            </p>
            <Link to="/" className="back-link">
              <ArrowLeft size={16} /> Voltar ao catálogo
            </Link>
          </div>
        </main>
      </>
    );

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      setError("Não foi possível entrar. Confira o e-mail e a senha.");
      setBusy(false);
      return;
    }

    const { data: admin, error: adminError } = await supabase
      .from("catalog_admins")
      .select("user_id")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (adminError || !admin) {
      await supabase.auth.signOut();
      setError("Esta conta não possui autorização administrativa.");
      setBusy(false);
      return;
    }

    navigate("/adm/painel", { replace: true });
  }

  return (
    <>
      <Header />
      <main className="auth-wrap">
        <form className="auth-card" onSubmit={handleSubmit}>
          <span className="auth-icon">
            <Leaf size={24} />
          </span>
          <span className="eyebrow">CAN GROUP / RESTRITO</span>
          <h1>Área administrativa</h1>
          <p>Acesse para gerenciar produtos e categorias do catálogo.</p>
          <label>
            E-mail
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="button button-dark full-button" disabled={busy}>
            {busy ? "Verificando..." : "Entrar com segurança"}
          </button>
          <Link to="/" className="back-link">
            <ArrowLeft size={15} /> Voltar ao catálogo
          </Link>
        </form>
      </main>
    </>
  );
}
