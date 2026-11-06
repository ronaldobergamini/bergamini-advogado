/* ============================================================
   CONFIGURAÇÃO DO FIREBASE — Bergamini Advocacia (projeto bergamini-advogado)
   ============================================================ */
window.FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAER0e6pww5ayH47JQKjnacQW65GwRj6UU",
  authDomain:        "bergamini-advogado.firebaseapp.com",
  projectId:         "bergamini-advogado",
  storageBucket:     "bergamini-advogado.firebasestorage.app",
  messagingSenderId: "285796759099",
  appId:             "1:285796759099:web:a87875c2feb644e3744e1e",
  measurementId:     "G-QEFF7TRVVT"
};

/* Administrador principal (tem controle total) — e-mail de LOGIN da Área Interna.
   Não trocar aqui sem antes criar esse login no Firebase Authentication. */
window.ADMIN_EMAIL    = "ronaldobergamini.advogado@gmail.com";

/* E-mail que recebe os avisos de solicitação de cadastro */
window.AVISO_EMAIL    = "contato.bergaminiadvocacia@gmail.com";
window.ADMIN_USUARIO  = "ronaldo.neto";

/* WhatsApp que recebe o aviso de cada novo pedido de acesso */
window.WHATSAPP_ADMIN = "5521999226406";
