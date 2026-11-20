import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import companyLogo from "../assets/can-logo-outline.svg";
import { supabase } from "../lib/supabase.js";

export default function Header({ admin = false }) {
  const [session, setSession] = useState(null);
  const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState(false);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (alive) setSession(error ? null : data.session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (alive) setSession(nextSession);
    });

    return () => {
      alive = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function verifyAdmin() {
      if (!session?.user?.id) {
        setIsAuthorizedAdmin(false);
        return;
      }

      const { data, error } = await supabase
        .from("catalog_admins")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (alive) setIsAuthorizedAdmin(!error && Boolean(data));
    }

    verifyAdmin();
    return () => {
      alive = false;
    };
  }, [session]);

  return (
    <header className="site-header">
      <Link to="/" className="brand">
        <img className="brand-logo" src={companyLogo} alt="CAN Group" />
        <span>
          <strong>CAN GROUP</strong>
          <small>IMPRESSÃO 3D · PERSONALIZADOS</small>
        </span>
      </Link>
      <nav>
        {admin && (
          <>
            <Link className="text-link" to="/adm/infinitepay">InfinitePay ↗</Link>
            <Link className="text-link" to="/">Ver catálogo ↗</Link>
          </>
        )}
        {!admin && isAuthorizedAdmin && (
          <Link className="text-link" to="/adm/painel">Área administrativa ↗</Link>
        )}
      </nav>
    </header>
  );
}
