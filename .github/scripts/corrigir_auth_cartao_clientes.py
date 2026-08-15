from pathlib import Path

clientes = Path('src/backend/clientes.web.js')
c = clientes.read_text(encoding='utf-8')

marker = 'AUTORIZACAO_CARTAO_NO_CLIENTES_V1'
if marker not in c:
    c += '''

// AUTORIZACAO_CARTAO_NO_CLIENTES_V1
// Reutiliza o mesmo módulo de membro que já alimenta o checkout corretamente.
// A autorização é vinculada ao checkoutId e nunca depende de e-mail vindo do HTML.
export const autorizarPagamentoCartaoMembro =
  webMethod(
    Permissions.SiteMember,

    async (input = {}) => {
      try {
        const checkoutId =
          safe(input?.checkoutId);

        if (!checkoutId) {
          return {
            ok: false,
            error: "Checkout inválido. Atualize a página e tente novamente."
          };
        }

        const membro =
          await currentMemberBackend.getMember();

        const memberId =
          safe(membro?._id);

        const emailsContato =
          Array.isArray(
            membro?.contactDetails?.emails
          )
            ? membro.contactDetails.emails
            : [];

        const memberEmail =
          limparEmail(
            membro?.loginEmail ||
            emailsContato[0] ||
            membro?.contactDetails?.email
          );

        if (!memberId || !memberEmail) {
          return {
            ok: false,
            error: "Não foi possível confirmar a conta Wix ativa."
          };
        }

        const resultado =
          await wixData
            .query(SESSIONS_COLLECTION)
            .eq("checkoutId", checkoutId)
            .limit(1)
            .find({
              ...DB_OPTS,
              consistentRead: true
            });

        const agora = new Date();

        if (resultado.items.length) {
          const sessao = {
            ...resultado.items[0],
            memberId,
            email: memberEmail,
            updatedAtDate: agora
          };

          delete sessao.whatsApp;
          delete sessao.whatsappE164;

          await wixData.update(
            SESSIONS_COLLECTION,
            sessao,
            DB_OPTS
          );
        } else {
          await wixData.insert(
            SESSIONS_COLLECTION,
            {
              checkoutId,
              memberId,
              email: memberEmail,
              status: "pending_auth",
              updatedAtDate: agora
            },
            DB_OPTS
          );
        }

        return {
          ok: true,
          memberId,
          email: memberEmail
        };
      } catch (error) {
        console.error(
          "AUTORIZACAO CARTAO MEMBRO:",
          error?.message || error
        );

        return {
          ok: false,
          error: "Não foi possível confirmar a conta Wix ativa."
        };
      }
    }
  );
'''
    clientes.write_text(c, encoding='utf-8')

page = Path('src/pages/checkout-projeto-pronto.i9aj1.js')
p = page.read_text(encoding='utf-8')

old_import = 'import { criarCliente, buscarClienteCadastrado, buscarClienteDoMembroAtual } from "backend/clientes.web";'
new_import = 'import { criarCliente, buscarClienteCadastrado, buscarClienteDoMembroAtual, autorizarPagamentoCartaoMembro } from "backend/clientes.web";'
if old_import in p:
    p = p.replace(old_import, new_import, 1)
elif new_import not in p:
    raise SystemExit('Import de clientes.web não encontrado')

p = p.replace('import { autorizarPagamentoCartao } from "backend/validaPayCartaoAuth.web";\n', '')

old_call = 'autorizarPagamentoCartao({checkoutId})'
new_call = 'autorizarPagamentoCartaoMembro({checkoutId})'
if old_call in p:
    p = p.replace(old_call, new_call, 1)
elif new_call not in p:
    raise SystemExit('Chamada de autorização do cartão não encontrada')

page.write_text(p, encoding='utf-8')
