# CAN Group — Catálogo digital

Catálogo de produtos da CAN Group com React, Vite, React Router e Supabase. Identidade visual: floresta `#233A22`, sálvia `#8FA080` e bege `#EEF0E6`.

## Incluído nesta base
- Catálogo público responsivo, pesquisa e filtro por categoria.
- Página de detalhes e mensagem de pedido via WhatsApp.
- Login Supabase Auth e área administrativa inicial.
- Listagem administrativa e alternância de publicação.
- Migration SQL com tabelas, RLS, bucket Storage e categorias iniciais.
- Configuração de fallback de rotas para Vercel.

O formulário completo de cadastro/edição de produtos com upload de fotos será a próxima etapa. Não há produtos fictícios: a vitrine só exibirá itens reais cadastrados e publicados.

## Requisitos e execução local
Node.js 20.19+ ou 22.12+.

```bash
npm install
cp .env.example .env.local
npm run dev
```
No Windows PowerShell: `Copy-Item .env.example .env.local`.

Preencha `.env.local` com os valores do seu projeto:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
VITE_WHATSAPP_NUMBER=5513997092751
```
Use somente a chave pública `anon`/`publishable` no frontend. **Nunca exponha `service_role` ou secret keys em variáveis `VITE_`.**

## Configurar Supabase
1. Crie um projeto Supabase.
2. No SQL Editor, execute `supabase/migrations/202610280001_initial_schema.sql`.
3. Em Authentication → Users, crie o usuário `andrew.moraes16@hotmail.com` e defina a senha diretamente pelo fluxo seguro do Supabase.
4. Confirme a conta conforme a configuração de autenticação.
5. Copie o UUID real do usuário em Authentication → Users.
6. No SQL Editor, conceda acesso administrativo substituindo o placeholder pelo UUID real:

```sql
insert into public.catalog_admins (user_id)
values ('UUID_REAL_DO_USUARIO')
on conflict (user_id) do nothing;
```

7. Configure URL e chave pública no `.env.local`, reinicie o servidor e acesse `/admin/login`.

A autorização vem da tabela `catalog_admins`; conhecer o e-mail não concede acesso. Não crie endpoint público para promover administradores.

## Vercel
1. Crie um repositório GitHub e envie o projeto.
2. Importe o repositório na Vercel.
3. Configure preset Vite, build `npm run build` e output `dist`.
4. Cadastre as três variáveis `VITE_*` em Project Settings → Environment Variables.
5. Faça deploy.

## Fotos
Bucket `product-images`, formatos JPEG/PNG/WebP/AVIF, limite 5 MB. `product_images.storage_path` deve guardar o caminho do objeto. Gere a URL de exibição usando `supabase.storage.from('product-images').getPublicUrl(storage_path).data.publicUrl`.

## Antes de lançar
- Testar RLS com visitante anônimo e usuário autenticado sem privilégios.
- Confirmar que apenas administradores alteram produtos, categorias e arquivos.
- Não commitar `.env.local` nem credenciais.
- Configurar domínio, política de privacidade e informações comerciais antes de divulgar.
