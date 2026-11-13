# Como aplicar esta atualização

## 1. Site (campo "Processo arquivado")
Envie para o GitHub (repositório bergamini-advogado), substituindo o arquivo antigo:
- `jurispro_gest_o_processual_2_.html`

No GitHub: abra o repositório > Add file > Upload files > arraste o arquivo > Commit changes.
Em 1–2 minutos o site bergaminiadvocacia.com.br é atualizado.

## 2. E-mails automáticos (Google Apps Script)
Os e-mails NÃO saem do site: saem do script no Google. Ele precisa ser atualizado à mão.
1. Abra https://script.google.com com a conta Google dona do projeto Firebase "bergamini-advogado".
2. Abra o projeto JurisPro > arquivo `Codigo.gs` > apague tudo e cole o novo `automacao/Codigo.gs`. Salve (Ctrl+S).
3. Escolha a função `instalar` > Executar (autorize se pedir).
4. Escolha a função `diagnostico` > Executar. Um e-mail chega nas duas caixas mostrando
   se os agendamentos estão ligados e quais audiências dos próximos 14 dias já tiveram lembrete.

Se no passo 1 não existir nenhum projeto JurisPro, o script nunca foi instalado: crie um projeto
novo, cole o `Codigo.gs`, e em Configurações do projeto marque "Mostrar appsscript.json" e cole o
conteúdo de `automacao/appsscript.json`. Depois siga os passos 3 e 4.
