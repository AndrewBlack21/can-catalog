import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

function signParams(params) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(payload + API_SECRET).digest("hex");
}

async function requireCatalogAdmin(req) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Sessão administrativa inválida.");
  }

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Sessão expirada. Entre novamente.");

  const { data: admin, error: adminError } = await client
    .from("catalog_admins")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (adminError || !admin) throw new Error("Acesso restrito aos administradores da CAN Group.");
  return userData.user;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    await requireCatalogAdmin(req);

    if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
      return res.status(500).json({ error: "Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET na Vercel." });
    }

    const { action, productId, publicId, resourceType } = req.body || {};

    if (action === "sign-upload") {
      if (!/^[0-9a-f-]{36}$/i.test(productId || "")) {
        return res.status(400).json({ error: "Produto inválido para envio de mídia." });
      }
      const timestamp = Math.floor(Date.now() / 1000);
      const folder = `can-group/products/${productId}`;
      const signature = signParams({ folder, timestamp });
      return res.status(200).json({ cloudName: CLOUD_NAME, apiKey: API_KEY, timestamp, folder, signature });
    }

    if (action === "delete") {
      if (!publicId || !["image", "video"].includes(resourceType)) {
        return res.status(400).json({ error: "Dados inválidos para remover a mídia." });
      }
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = signParams({ public_id: publicId, timestamp });
      const body = new URLSearchParams({ public_id: publicId, timestamp: String(timestamp), api_key: API_KEY, signature });
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/destroy`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const result = await response.json();
      if (!response.ok || result.result !== "ok" && result.result !== "not found") {
        return res.status(502).json({ error: result.error?.message || "O Cloudinary não conseguiu remover o arquivo." });
      }
      return res.status(200).json({ result: result.result });
    }

    return res.status(400).json({ error: "Ação inválida." });
  } catch (error) {
    return res.status(401).json({ error: error.message || "Não foi possível validar o administrador." });
  }
}
