# Como aplicar esta atualização (16/11/2026)

O site (index.html e Área Interna) já foi enviado ao GitHub. Faltam 3 passos manuais.

## 1. Regras do banco (Firebase) — protege a Consulta Processual
Sem este passo, a lista de processos continua podendo ser lida por quem souber mexer no navegador.
1. Abra https://console.firebase.google.com > projeto **bergamini-advogado**.
2. Menu **Firestore Database** > aba **Regras**.
3. Apague tudo e cole o conteúdo do arquivo `automacao/firestore.rules` deste repositório.
4. Clique em **Publicar**.

## 2. Entrar uma vez na Área Interna
Entre com o usuário do Dr. Ronaldo (administrador). Ao abrir, o sistema troca sozinho as fichas
antigas da Consulta Processual pelas novas, protegidas pelo CPF. Espere uns 10 segundos na tela inicial.
- Processos cujo cliente não tem CPF/CNPJ no cadastro **não aparecem** na consulta do site.
  Para aparecer, preencha o CPF/CNPJ do cliente.

## 3. E-mails automáticos (Google Apps Script)
1. Abra https://script.google.com > projeto JurisPro > arquivo `Codigo.gs`.
2. Apague tudo e cole o novo `automacao/Codigo.gs`. Salve (Ctrl+S).
3. Escolha a função `instalar` > Executar.
4. Escolha a função `testarAgenda` > Executar. Chega na hora o e-mail "Agenda de hoje".

O que mudou:
- A **Agenda de hoje** chega todo dia por volta das 7h, mesmo quando não há nada no dia
  ("nada para hoje"), e traz também os próximos 7 dias.
- O backup no OneDrive é **opcional**: enquanto não for configurado (veja `automacao/LEIA-ME-OneDrive.md`),
  ele não roda e não manda mais o e-mail de falha.
