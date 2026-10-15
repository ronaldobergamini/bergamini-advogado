/* ============================================================
   CONFIGURAÇÃO DO FIREBASE — Bergamini Advogado (projeto bergamini-advogado)
   Cole aqui os dados do app Web do Firebase:
   Console > Configurações do projeto > Seus apps > App da Web > Configuração
   ============================================================ */
window.FIREBASE_CONFIG = {
  apiKey:            "COLE_AQUI_A_API_KEY",
  authDomain:        "bergamini-advogado.firebaseapp.com",
  projectId:         "bergamini-advogado",
  storageBucket:     "bergamini-advogado.firebasestorage.app",
  messagingSenderId: "COLE_AQUI",
  appId:             "COLE_AQUI"
};

/* Administrador principal (tem controle total).
   O e-mail precisa ser IGUAL ao da regra admin() no Firestore. */
window.ADMIN_EMAIL    = "ronaldobergamini.advogado@gmail.com";
window.ADMIN_USUARIO  = "ronaldo.neto";

/* WhatsApp que recebe o aviso de cada novo pedido de acesso (com DDI e DDD) */
window.WHATSAPP_ADMIN = "5522981740300";
