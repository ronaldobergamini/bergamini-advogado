# Backup automático no OneDrive — configuração (uma vez só)

Feita pelo Dr. Ronaldo, com a conta Microsoft (OneDrive) que vai guardar os backups.
O Azure não cobra pelo registro de aplicativo.

## Parte 1 — Registrar o aplicativo na Microsoft
1. Abra https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/CreateApplicationBlade/isMSAApp~/false
   e entre com a conta Microsoft do OneDrive. (Se o Azure oferecer criar uma conta gratuita, aceite; não precisa de assinatura paga.)
2. Nome: `JurisPro Backup`.
3. Tipos de conta com suporte: **"Contas em qualquer diretório organizacional (...Multilocatário) e contas pessoais da Microsoft"**.
4. Deixe "URI de redirecionamento" em branco e clique em **Registrar**.
5. Na tela do aplicativo, copie o **"ID do aplicativo (cliente)"** (uma sequência de letras e números com hífens).
6. Menu **Autenticação** → role até **"Permitir fluxos de cliente público"** → **Sim** → **Salvar**.
7. Menu **Permissões de API** → **Adicionar uma permissão** → **Microsoft Graph** → **Permissões delegadas** → marque **Files.ReadWrite** e **offline_access** → **Adicionar permissões**.

## Parte 2 — Colar o ID no script
No Apps Script, em `Codigo.gs`, na linha `msClientId: "COLE_AQUI_O_ID_DO_APLICATIVO"`,
troque o texto entre aspas pelo ID copiado no passo 5. Salve (Ctrl+S).

## Parte 3 — Autorizar o OneDrive
1. Escolha a função `autorizarOneDrive` → Executar. Um e-mail chega com um **código** e um link.
2. Abra o link (https://microsoft.com/devicelogin), digite o código, entre com a conta do OneDrive e aceite.
3. Volte ao Apps Script, escolha `concluirAutorizacaoOneDrive` → Executar.
   Ele faz o primeiro backup. Confira no OneDrive a pasta **Backups JurisPro Bergamini**.

Depois disso, todo domingo de madrugada o backup é gravado sozinho (os 12 mais recentes são mantidos).
Se a autorização expirar ou for revogada, o escritório recebe um e-mail de aviso: basta repetir a Parte 3.
