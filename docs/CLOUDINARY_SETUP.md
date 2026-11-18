# Integração Cloudinary — CAN Group

## Arquitetura

- Vercel hospeda a aplicação React/Vite e a função `/api/cloudinary-media`.
- Cloudinary armazena e entrega imagens e vídeos.
- Supabase continua armazenando os dados do catálogo e os metadados das mídias.

## Variáveis de ambiente na Vercel

Configure em **Project Settings → Environment Variables**, nos ambientes Preview, Production e Development:

| Variável | Valor |
| --- | --- |
| `CLOUDINARY_CLOUD_NAME` | `eha5vrmy` |
| `CLOUDINARY_API_KEY` | API Key exibida no Console do Cloudinary |
| `CLOUDINARY_API_SECRET` | API Secret exibida no Console do Cloudinary |
| `VITE_SUPABASE_URL` | URL do projeto Supabase atual |
| `VITE_SUPABASE_ANON_KEY` | Chave publicável/anon do projeto Supabase |

**Segurança:** `CLOUDINARY_API_SECRET` nunca deve ter prefixo `VITE_`, entrar no código do React ou ser enviada ao navegador. Ela é usada somente pela função serverless da Vercel. Não coloque valores secretos no GitHub.

Após configurar as variáveis, faça um novo deploy para que a função receba os valores.

## Banco de dados

Antes de usar upload, aplique no projeto Supabase atual a migration:

`supabase/migrations/202611170001_cloudinary_product_media.sql`

Ela preserva os valores antigos de `storage_path`, permite que novos registros usem `storage_path = null` e adiciona os campos Cloudinary. Nenhuma linha antiga é apagada.

## Fluxo de upload

1. O administrador autenticado solicita uma assinatura à função da Vercel.
2. A função valida o usuário no Supabase e confirma sua presença em `catalog_admins`.
3. A função assina o upload sem expor a API Secret.
4. O navegador envia o arquivo diretamente ao Cloudinary.
5. O catálogo grava no Supabase apenas URL segura, public ID, tipo de mídia e ordem.

O envio atual aceita imagens de até 5 MB e vídeos MP4/WebM de até 200 MB. O arquivo não passa pelo servidor da Vercel.

## Migração das mídias antigas

Os registros antigos permanecem no banco e são identificados no formulário do produto como **Pendente de migração**. Ao editar um produto, selecione as novas imagens/vídeos e salve. Os novos arquivos são adicionados à galeria usando Cloudinary. Remova o registro antigo somente depois de conferir a nova mídia.

Como os arquivos antigos do Storage não estão disponíveis no projeto atual e não há cópia recuperável, eles precisam ser substituídos por arquivos encontrados em outra origem ou por novas imagens.
