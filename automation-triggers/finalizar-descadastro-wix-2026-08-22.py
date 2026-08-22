from pathlib import Path

path = Path('src/backend/http-functions.js')
text = path.read_text(encoding='utf-8')

marker = 'REMARKETING_UNSUBSCRIBE_PAGE_V1'
if marker not in text:
    raise SystemExit('ERRO: bloco de descadastro não encontrado')

old = text

# O webhook deixa de viajar no link/e-mail e passa a ser lido do Secrets Manager do Wix.
text = text.replace('  const hook = safe(request?.query?.hook);\n', '')
text = text.replace("const hook=${JSON.stringify(hook)};\n", '')
text = text.replace("body:JSON.stringify({email,member_id:memberId,nome,motivo,detalhe,hook,origem:'remarketing_projetos_prontos'})", "body:JSON.stringify({email,member_id:memberId,nome,motivo,detalhe,origem:'remarketing_projetos_prontos'})")
text = text.replace('    const hook = safe(data?.hook);\n', '    const hook = safe(await getSecret("REMARKETING_DESCADASTRO_WEBHOOK"));\n')

if text == old:
    print('Sem alteração: patch já aplicado ou estrutura mudou.')
    raise SystemExit(0)

checks = [
    'get_descadastrarRemarketing',
    'post_descadastrarRemarketingSubmit',
    'REMARKETING_DESCADASTRO_WEBHOOK',
    "origem:'remarketing_projetos_prontos'",
]
for item in checks:
    if item not in text:
        raise SystemExit(f'ERRO: validação falhou: {item}')

if 'request?.query?.hook' in text or 'const hook=${JSON.stringify(hook)}' in text:
    raise SystemExit('ERRO: hook ainda está exposto na página')

path.write_text(text, encoding='utf-8')
print('Descadastro finalizado: webhook privado no Wix Secrets Manager.')
