/* ============================================================
   JurisPro — conexão com o Firebase (compartilhado pela
   Área Interna e pela Administração). Configuração: firebase-config.js
   ============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, sendPasswordResetEmail, sendEmailVerification, updatePassword,
  reauthenticateWithCredential, EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection,
  onSnapshot, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const CONFIG = window.FIREBASE_CONFIG || {};
export const CONFIG_OK = !!(CONFIG.apiKey && CONFIG.projectId && !/COLE/i.test(CONFIG.apiKey));
export const ADMIN_EMAIL = String(window.ADMIN_EMAIL || "").trim().toLowerCase();
export const ADMIN_USUARIO = String(window.ADMIN_USUARIO || "").trim().toLowerCase();
export const ZAP_ADMIN = String(window.WHATSAPP_ADMIN || "").replace(/\D/g, "");
export const SITE = "https://bergaminiadvocacia.com.br";

export const app = CONFIG_OK ? initializeApp(CONFIG) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

export {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  sendPasswordResetEmail, sendEmailVerification, updatePassword, reauthenticateWithCredential,
  EmailAuthProvider, initializeApp, getAuth, doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, onSnapshot, query, where, serverTimestamp
};

export const $ = id => document.getElementById(id);

export function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export const normUsuario = u => String(u || "").trim().toLowerCase();
export const usuarioValido = u => /^[a-z0-9._-]{3,30}$/.test(u);
export const soDigitos = s => String(s || "").replace(/\D/g, "");

export function linkZap(numero, texto) {
  let n = soDigitos(numero);
  if (n && n.length <= 11) n = "55" + n;
  return "https://wa.me/" + n + (texto ? "?text=" + encodeURIComponent(texto) : "");
}

export function fmtData(t) {
  try {
    const d = t && t.toDate ? t.toDate() : (t ? new Date(t) : null);
    return d ? d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
  } catch (e) { return "—"; }
}

/* Mostra mensagem num bloco .login-msg / .msg (tipo: erro | ok | info) */
export function msg(id, texto, tipo, html) {
  const el = $(id); if (!el) return;
  if (!texto) { el.style.display = "none"; return; }
  if (html) el.innerHTML = texto; else el.textContent = texto;
  el.className = (el.dataset.base || "login-msg") + " " + (tipo || "info");
  el.style.display = "block";
}

export function ehAdminEmail(user) {
  return !!user && !!ADMIN_EMAIL && String(user.email || "").toLowerCase() === ADMIN_EMAIL;
}

export function ehAdmin(user, perfil) {
  return (ehAdminEmail(user) && user.emailVerified) ||
    (!!perfil && perfil.perfil === "admin" && perfil.status === "ativo");
}

/* Usuário ou e-mail -> e-mail do login */
export async function emailDoLogin(login) {
  const t = String(login || "").trim();
  if (t.includes("@")) return t.toLowerCase();
  const u = normUsuario(t);
  const s = await getDoc(doc(db, "usernames", u));
  if (s.exists()) return s.data().email;
  if (u && u === ADMIN_USUARIO) return ADMIN_EMAIL;
  return null;
}

export async function lerPerfil(uid) {
  const s = await getDoc(doc(db, "users", uid));
  return s.exists() ? s.data() : null;
}

/* Cria o perfil do administrador principal na primeira entrada */
export async function garantirPerfilAdmin(user, perfil) {
  if (!ehAdminEmail(user) || !user.emailVerified) return perfil;
  if (perfil && perfil.perfil === "admin" && perfil.status === "ativo") return perfil;
  const novo = Object.assign({
    nome: "Ronaldo Bergamini", email: ADMIN_EMAIL, whatsapp: ZAP_ADMIN,
    usuario: ADMIN_USUARIO, criadoEm: serverTimestamp()
  }, perfil || {}, { perfil: "admin", status: "ativo" });
  await setDoc(doc(db, "users", user.uid), novo);
  const u = normUsuario(novo.usuario);
  if (u) {
    const s = await getDoc(doc(db, "usernames", u));
    if (!s.exists()) await setDoc(doc(db, "usernames", u), { uid: user.uid, email: ADMIN_EMAIL });
  }
  return novo;
}

export function traduz(err) {
  const c = (err && err.code) || "";
  const m = {
    "auth/invalid-credential": "Usuário ou senha incorretos.",
    "auth/wrong-password": "Usuário ou senha incorretos.",
    "auth/user-not-found": "Usuário ou senha incorretos.",
    "auth/invalid-login-credentials": "Usuário ou senha incorretos.",
    "auth/email-already-in-use": "Este e-mail já tem cadastro. Use \"Esqueci minha senha\" se precisar.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
    "auth/network-request-failed": "Sem conexão com a internet.",
    "auth/operation-not-allowed": "O login por e-mail e senha ainda não foi ativado no Firebase.",
    "auth/unauthorized-domain": "Este domínio ainda não foi autorizado no Firebase.",
    "auth/requires-recent-login": "Por segurança, saia e entre de novo antes de trocar a senha.",
    "permission-denied": "Sem permissão no servidor (confira as regras do Firestore).",
    "jp/usuario-existe": "Esse nome de usuário já existe. Escolha outro.",
    "jp/usuario-invalido": "Nome de usuário: 3 a 30 caracteres, só letras minúsculas, números, ponto, hífen ou sublinhado.",
    "jp/senhas": "As senhas não conferem.",
    "jp/whatsapp": "Informe o WhatsApp com DDD."
  };
  if (m[c]) return m[c];
  if (/referer|API key not valid|blocked/i.test((err && err.message) || "")) return "Este domínio ainda não foi autorizado no Firebase.";
  return "Erro: " + ((err && (err.code || err.message)) || "desconhecido");
}

/* Aviso por e-mail ao administrador (FormSubmit — na 1ª vez pede ativação no e-mail) */
export function avisarEmail(dados) {
  if (!ADMIN_EMAIL) return Promise.resolve();
  return fetch("https://formsubmit.co/ajax/" + ADMIN_EMAIL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(Object.assign({ _template: "table", _captcha: "false" }, dados))
  }).catch(() => {});
}

/* Abre uma aba já no clique (o navegador não bloqueia) para enviar ao WhatsApp depois */
export function reservarAba() { try { return window.open("", "_blank"); } catch (e) { return null; } }
export function enviarAba(aba, url) {
  if (aba && !aba.closed) { try { aba.location.href = url; return true; } catch (e) {} }
  try { return !!window.open(url, "_blank"); } catch (e) { return false; }
}
