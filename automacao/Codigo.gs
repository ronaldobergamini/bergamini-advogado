/* =====================================================================
   JurisPro — Bergamini Advogado — AUTOMAÇÕES (Google Apps Script)
   ---------------------------------------------------------------------
   Roda no Google, sozinho, sem ninguém abrir o sistema:
     • Todo dia ~7h ......... lembrete de audiência 2 dias antes
                              (advogado + cliente) e busca de novas
                              publicações no Comunica PJe (OAB e processos)
     • Toda sexta ~8h ....... resumo das tarefas de seg a sex da semana
                              seguinte para o advogado
     • Todo domingo ~3h ..... cópia de segurança dos dados no OneDrive

   COMO INSTALAR: veja o arquivo LEIA-ME.md nesta mesma pasta.
   Depois de colar, rode UMA vez a função  instalar  (menu Executar).
   ===================================================================== */

const CFG = {
  projetoFirebase: "bergamini-advogado",
  emailAdvogado: "ronaldobergamini.advogado@gmail.com",
  nomeAdvogado: "Dr. Ronaldo Bergamini",
  telefoneAdvogado: "(21) 99807-5723",
  oab: "182124",
  ufOab: "RJ",
  nomeEscritorio: "Bergamini Advogado",
  site: "https://bergaminiadvocacia.com.br",
  fuso: "America/Sao_Paulo",
  diasAntesAudiencia: 2,
  pastaBackup: "Backups JurisPro Bergamini",
  manterBackups: 12,         // quantas cópias semanais guardar no OneDrive
  // ID do aplicativo registrado no Azure (veja o LEIA-ME). Cole entre as aspas.
  msClientId: "COLE_AQUI_O_ID_DO_APLICATIVO"
};

/* ============================ INSTALAÇÃO ============================ */

/** Rode esta função UMA vez. Ela cria os 3 agendamentos automáticos. */
function instalar() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("rotinaDiaria").timeBased().everyDays(1).atHour(7).inTimezone(CFG.fuso).create();
  ScriptApp.newTrigger("resumoSemanal").timeBased().onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(8).inTimezone(CFG.fuso).create();
  ScriptApp.newTrigger("rotinaBackup").timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(3).inTimezone(CFG.fuso).create();
  // Teste de leitura do banco para já pedir as autorizações
  const n = lerColecao("processos").length;
  Logger.log("Instalado. Processos encontrados no banco: " + n);
}

/** Manda para o advogado um e-mail de teste com o resumo da próxima semana. */
function testarEnvio() {
  resumoSemanal(true);
  Logger.log("E-mail de teste enviado para " + CFG.emailAdvogado);
}

/* ============================ ROTINAS ============================ */

function rotinaBackup() {
  try { backupSemanal(); } catch (e) { avisarErro("backup no OneDrive", e); }
}

function rotinaDiaria() {
  try { lembretesAudiencia(); } catch (e) { avisarErro("lembretes de audiência", e); }
  try { verificarPublicacoes(); } catch (e) { avisarErro("busca de publicações", e); }
}

/** Lembrete de audiência: envia quando faltam até 2 dias (uma vez por data/horário). */
function lembretesAudiencia() {
  const hoje = hojeISO(), limite = maisDias(hoje, CFG.diasAntesAudiencia);
  const clientes = lerColecao("clientes");
  lerColecao("processos").forEach(p => {
    const a = p.audiencia || {};
    if (!p.temAudiencia || !a.data || a.cumprido) return;
    if (a.data < hoje || a.data > limite) return;

    const chave = a.data + "|" + (a.hora || "");
    const avisos = p.avisos || {};
    const cli = clientes.find(c => c.nome === p.cliente) || {};
    const novos = Object.assign({}, avisos);

    if (avisos.adv !== chave) {
      enviar(CFG.emailAdvogado,
        "Audiência em " + dataBR(a.data) + " às " + (a.hora || "--") + " — " + (p.cliente || ""),
        emailAudienciaAdvogado(p, a, cli));
      novos.adv = chave;
    }
    if (cli.email && avisos.cli !== chave) {
      enviar(cli.email,
        "Lembrete: sua audiência em " + dataBR(a.data) + " às " + (a.hora || "--"),
        emailAudienciaCliente(p, a, cli), CFG.emailAdvogado);
      novos.cli = chave;
    }
    if (JSON.stringify(novos) !== JSON.stringify(avisos)) gravarCampo("processos", p.id, "avisos", novos);
  });
}

/** Sexta-feira: tarefas de segunda a sexta da semana seguinte. */
function resumoSemanal(teste) {
  const hoje = hojeISO();
  const dow = new Date(hoje + "T12:00:00").getDay();
  const seg = maisDias(hoje, ((8 - dow) % 7) || 7);
  const sex = maisDias(seg, 4);
  const clientes = lerColecao("clientes");
  const tarefas = [];
  lerColecao("processos").forEach(p => {
    const temPrazo = p.temPrazo !== undefined ? (p.temPrazo && p.prazo) : p.prazo;
    if (temPrazo && !p.prazoCumprido && p.prazo >= seg && p.prazo <= sex)
      tarefas.push({ tipo: "Prazo", data: p.prazo, hora: "", p: p, desc: p.prazoDesc || p.obs || "" });
    const a = p.audiencia || {};
    if (p.temAudiencia && a.data && !a.cumprido && a.data >= seg && a.data <= sex)
      tarefas.push({ tipo: "Audiência", data: a.data, hora: a.hora || "", p: p,
        desc: [a.tipo, a.comarca, a.vara].filter(Boolean).join(" · ") });
  });
  // Vencidos ainda pendentes (para não se perderem)
  const vencidos = [];
  lerColecao("processos").forEach(p => {
    const temPrazo = p.temPrazo !== undefined ? (p.temPrazo && p.prazo) : p.prazo;
    if (temPrazo && !p.prazoCumprido && p.prazo < hoje && p.prazo >= maisDias(hoje, -365))
      vencidos.push({ tipo: "Prazo", data: p.prazo, hora: "", p: p, desc: p.prazoDesc || "" });
  });
  tarefas.sort((x, y) => (x.data + x.hora).localeCompare(y.data + y.hora));

  const linha = t => {
    const c = clientes.find(k => k.nome === t.p.cliente) || {};
    return "<tr>" +
      td("<b>" + esc(dataBR(t.data)) + "</b><br><span style='color:#64748b'>" + diaSemana(t.data) + "</span>") +
      td(esc(t.hora || "—")) +
      td("<span style='font-weight:600;color:" + (t.tipo === "Prazo" ? "#92400e" : "#3730a3") + "'>" + t.tipo + "</span>") +
      td(esc(t.p.cnj || "") + (t.desc ? "<br><span style='color:#64748b'>" + esc(t.desc) + "</span>" : "")) +
      td(esc(t.p.cliente || "") + (c.telefone ? "<br><span style='color:#64748b'>" + esc(c.telefone) + "</span>" : "")) +
      "</tr>";
  };
  const cab = "<tr>" + ["Data", "Horário", "Tipo", "Processo", "Cliente"].map(th).join("") + "</tr>";
  let corpo = "<p>Tarefas agendadas de <b>" + dataBR(seg) + "</b> (segunda) a <b>" + dataBR(sex) + "</b> (sexta):</p>";
  corpo += tarefas.length
    ? tabela(cab + tarefas.map(linha).join(""))
    : "<p style='color:#03543f'>Nenhum prazo ou audiência pendente nesse período.</p>";
  if (vencidos.length) {
    corpo += "<p style='margin-top:22px;color:#9b1c1c'><b>Atenção — prazos vencidos ainda não marcados como cumpridos:</b></p>" +
      tabela(cab + vencidos.map(linha).join(""));
  }
  corpo += "<p style='margin-top:18px'>Abra a Área Interna para marcar o cumprimento: <a href='" + CFG.site + "/jurispro_gest_o_processual_2_.html'>JurisPro</a></p>";
  enviar(CFG.emailAdvogado,
    (teste ? "[TESTE] " : "") + "Agenda da semana " + dataBR(seg) + " a " + dataBR(sex) + " — " + tarefas.length + " tarefa(s)",
    moldura("Agenda da próxima semana", corpo));
}

/* ======================= PUBLICAÇÕES (Comunica PJe) ======================= */

/** Procura publicações dos últimos 3 dias pela OAB e pelos números dos processos ativos.
    Envia ao advogado só as que ainda não foram avisadas. */
function verificarPublicacoes() {
  const props = PropertiesService.getScriptProperties();
  const vistas = JSON.parse(props.getProperty("pubVistas") || "{}");
  const ini = maisDias(hojeISO(), -3), fim = hojeISO();
  const achadas = {};

  const consultar = params => {
    const q = Object.assign({ pagina: 1, itensPorPagina: 100,
      dataDisponibilizacaoInicio: ini, dataDisponibilizacaoFim: fim }, params);
    const url = "https://comunicaapi.pje.jus.br/api/v1/comunicacao?" +
      Object.keys(q).map(k => k + "=" + encodeURIComponent(q[k])).join("&");
    const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { Accept: "application/json" } });
    if (r.getResponseCode() !== 200) return;
    const j = JSON.parse(r.getContentText() || "{}");
    (j.items || j.itens || []).forEach(it => {
      const id = String(it.id || it.hash || (it.numero_processo + "|" + it.data_disponibilizacao + "|" + String(it.texto || "").slice(0, 40)));
      if (!vistas[id]) achadas[id] = it;
    });
  };

  consultar({ numeroOab: CFG.oab, ufOab: CFG.ufOab });
  lerColecao("processos")
    .filter(p => p.status === "Ativo" && p.cnj)
    .forEach(p => { consultar({ numeroProcesso: String(p.cnj).replace(/\D/g, "") }); Utilities.sleep(400); });

  const ids = Object.keys(achadas);
  if (!ids.length) return;
  const itens = ids.map(id => achadas[id]);
  const corpo = "<p>Foram encontradas <b>" + itens.length + "</b> nova(s) publicação(ões) no Diário de Justiça Eletrônico Nacional:</p>" +
    itens.map(it => {
      const txt = String(it.texto || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return "<div style='border:1px solid #e2e6ea;border-radius:6px;padding:10px 12px;margin:10px 0'>" +
        "<b>" + esc(dataBR(String(it.data_disponibilizacao || it.dataDisponibilizacao || "").slice(0, 10))) + " · " +
        esc(it.siglaTribunal || "") + " · " + esc(it.numeroprocessocommascara || it.numero_processo || "") + "</b><br>" +
        "<span style='color:#64748b'>" + esc([it.tipoComunicacao, it.nomeOrgao].filter(Boolean).join(" — ")) + "</span>" +
        "<div style='margin-top:6px'>" + esc(txt.slice(0, 1500)) + (txt.length > 1500 ? "…" : "") + "</div>" +
        (it.link ? "<div style='margin-top:6px'><a href='" + esc(it.link) + "'>Abrir documento</a></div>" : "") +
        "</div>";
    }).join("") +
    "<p style='color:#64748b;font-size:12px'>Fonte: comunica.pje.jus.br. Confira sempre no sistema do tribunal antes de contar prazos.</p>";
  enviar(CFG.emailAdvogado, "Novas publicações — " + itens.length + " encontrada(s)", moldura("Novas publicações", corpo));

  ids.forEach(id => vistas[id] = hojeISO());
  const corte = maisDias(hojeISO(), -60);              // esquece as muito antigas
  Object.keys(vistas).forEach(k => { if (vistas[k] < corte) delete vistas[k]; });
  props.setProperty("pubVistas", JSON.stringify(vistas));
}

/* ============================ BACKUP (OneDrive) ============================ */
/* Grava direto no OneDrive pela API da Microsoft (Graph).
   Autorização feita UMA vez: rode  autorizarOneDrive  e depois  concluirAutorizacaoOneDrive. */

const MS_ESCOPO = "Files.ReadWrite offline_access";
const MS_AUTH = "https://login.microsoftonline.com/common/oauth2/v2.0/";
const MS_GRAPH = "https://graph.microsoft.com/v1.0";

/** PASSO 1: pede um código de autorização e envia ao e-mail do advogado. */
function autorizarOneDrive() {
  exigirClientId();
  const r = UrlFetchApp.fetch(MS_AUTH + "devicecode", {
    method: "post", muteHttpExceptions: true,
    payload: { client_id: CFG.msClientId, scope: MS_ESCOPO }
  });
  const j = JSON.parse(r.getContentText());
  if (r.getResponseCode() !== 200) throw new Error("Microsoft: " + (j.error_description || r.getContentText()).slice(0, 400));
  PropertiesService.getScriptProperties().setProperty("msDeviceCode", j.device_code);
  const msg = "1) Abra  " + j.verification_uri + "\n2) Digite o código:  " + j.user_code +
    "\n3) Entre com a conta Microsoft (OneDrive) do escritório e aceite.\n4) Volte ao Apps Script e rode  concluirAutorizacaoOneDrive.\n\nO código vale por " + Math.round(j.expires_in / 60) + " minutos.";
  Logger.log(msg);
  MailApp.sendEmail(CFG.emailAdvogado, "JurisPro — código para autorizar o OneDrive: " + j.user_code, msg);
}

/** PASSO 2: depois de autorizar no site da Microsoft, guarda a permissão e faz o primeiro backup. */
function concluirAutorizacaoOneDrive() {
  exigirClientId();
  const dc = PropertiesService.getScriptProperties().getProperty("msDeviceCode");
  if (!dc) throw new Error("Rode primeiro a função autorizarOneDrive.");
  const r = UrlFetchApp.fetch(MS_AUTH + "token", {
    method: "post", muteHttpExceptions: true,
    payload: { grant_type: "urn:ietf:params:oauth:grant-type:device_code", client_id: CFG.msClientId, device_code: dc }
  });
  const j = JSON.parse(r.getContentText());
  if (j.error === "authorization_pending") { Logger.log("Ainda não autorizado. Conclua o passo no site da Microsoft e rode de novo."); return; }
  if (!j.refresh_token) throw new Error("Falha: " + (j.error_description || r.getContentText()).slice(0, 400));
  const props = PropertiesService.getScriptProperties();
  props.setProperty("msRefreshToken", j.refresh_token);
  props.deleteProperty("msDeviceCode");
  Logger.log("OneDrive autorizado. Fazendo o primeiro backup...");
  backupSemanal();
  Logger.log("Pronto: veja a pasta '" + CFG.pastaBackup + "' no OneDrive.");
}

function exigirClientId() {
  if (!CFG.msClientId || /COLE_AQUI/.test(CFG.msClientId)) throw new Error("Cole o ID do aplicativo Azure em CFG.msClientId (veja o LEIA-ME).");
}

function tokenOneDrive() {
  const props = PropertiesService.getScriptProperties();
  const rt = props.getProperty("msRefreshToken");
  if (!rt) throw new Error("OneDrive ainda não autorizado. Rode autorizarOneDrive e depois concluirAutorizacaoOneDrive.");
  const r = UrlFetchApp.fetch(MS_AUTH + "token", {
    method: "post", muteHttpExceptions: true,
    payload: { grant_type: "refresh_token", client_id: CFG.msClientId, refresh_token: rt, scope: MS_ESCOPO }
  });
  const j = JSON.parse(r.getContentText());
  if (!j.access_token) throw new Error("Autorização do OneDrive expirou ou foi revogada — repita autorizarOneDrive. (" + (j.error_description || "").slice(0, 200) + ")");
  if (j.refresh_token) props.setProperty("msRefreshToken", j.refresh_token);   // a Microsoft renova a cada uso
  return j.access_token;
}

function backupSemanal() {
  const dados = {
    geradoEm: new Date().toISOString(),
    origem: "JurisPro Bergamini — backup automático",
    clientes: lerColecao("clientes"),
    processos: lerColecao("processos")
  };
  const token = tokenOneDrive();
  const H = { Authorization: "Bearer " + token };
  const pasta = encodeURIComponent(CFG.pastaBackup);
  const nome = "jurispro-backup-" + hojeISO() + ".json";

  const up = UrlFetchApp.fetch(MS_GRAPH + "/me/drive/root:/" + pasta + "/" + nome + ":/content", {
    method: "put", contentType: "application/json", headers: H,
    payload: JSON.stringify(dados, null, 2), muteHttpExceptions: true
  });
  if (up.getResponseCode() >= 300) throw new Error("OneDrive (gravar): HTTP " + up.getResponseCode() + " " + up.getContentText().slice(0, 300));

  // Mantém só os mais recentes
  const ls = UrlFetchApp.fetch(MS_GRAPH + "/me/drive/root:/" + pasta + ":/children?$select=id,name,createdDateTime&$top=200", { headers: H, muteHttpExceptions: true });
  if (ls.getResponseCode() === 200) {
    const arqs = (JSON.parse(ls.getContentText()).value || []).filter(f => /^jurispro-backup-.*\.json$/.test(f.name));
    arqs.sort((a, b) => b.name.localeCompare(a.name));
    arqs.slice(CFG.manterBackups).forEach(f =>
      UrlFetchApp.fetch(MS_GRAPH + "/me/drive/items/" + f.id, { method: "delete", headers: H, muteHttpExceptions: true }));
  }
}

/* ============================ E-MAILS ============================ */

function emailAudienciaAdvogado(p, a, cli) {
  const linhas = [
    ["Data", dataBR(a.data) + " (" + diaSemana(a.data) + ")"],
    ["Horário", a.hora || "—"],
    ["Comarca", a.comarca || "—"],
    ["Vara / Juízo", a.vara || "—"],
    ["Tipo", a.tipo || "—"],
    ["Modalidade", a.modo || "—"],
    ["Local / link", a.local || "—"],
    ["Processo", p.cnj || "—"],
    ["Área", p.area || "—"],
    ["Cliente", p.cliente || "—"],
    ["Contato do cliente", [cli.telefone, cli.email].filter(Boolean).join(" · ") || "—"]
  ];
  return moldura("Lembrete de audiência",
    "<p>A audiência abaixo é <b>" + quando(a.data) + "</b>:</p>" + fichaHtml(linhas));
}

function emailAudienciaCliente(p, a, cli) {
  const linhas = [
    ["Data", dataBR(a.data) + " (" + diaSemana(a.data) + ")"],
    ["Horário", a.hora || "—"],
    ["Comarca", a.comarca || "—"],
    ["Vara / Juízo", a.vara || "—"],
    ["Modalidade", a.modo || "—"],
    ["Local / link", a.local || "—"],
    ["Processo nº", p.cnj || "—"]
  ];
  return moldura("Lembrete da sua audiência",
    "<p>Olá" + (cli.nome ? ", <b>" + esc(String(cli.nome).split(" ")[0]) + "</b>" : "") + ".</p>" +
    "<p>Lembramos que sua audiência é <b>" + quando(a.data) + "</b>:</p>" +
    fichaHtml(linhas) +
    "<p>Recomendamos chegar (ou entrar na sala virtual) com 30 minutos de antecedência, levando documento com foto.</p>" +
    "<p style='margin-top:18px'><b>Contato do advogado</b><br>" + esc(CFG.nomeAdvogado) + " — OAB/" + CFG.ufOab + " " + CFG.oab.replace(/(\d{3})(\d{3})/, "$1.$2") +
    "<br>E-mail: <a href='mailto:" + CFG.emailAdvogado + "'>" + CFG.emailAdvogado + "</a>" +
    "<br>Telefone / WhatsApp: " + CFG.telefoneAdvogado + "</p>");
}

function moldura(titulo, corpo) {
  return "<div style='font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:auto;color:#1c1c1c'>" +
    "<div style='background:#061529;border-bottom:3px solid #C49A5A;padding:16px 20px;color:#fff'>" +
    "<div style='font-family:Georgia,serif;font-size:20px;letter-spacing:2px'>BERGAMINI <span style='color:#C49A5A;font-size:13px'>ADVOGADO</span></div>" +
    "<div style='font-size:14px;color:#d8dee8;margin-top:4px'>" + esc(titulo) + "</div></div>" +
    "<div style='padding:18px 20px;font-size:14px;line-height:1.55'>" + corpo + "</div>" +
    "<div style='padding:12px 20px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e6ea'>" +
    "Mensagem automática do sistema JurisPro — " + esc(CFG.nomeEscritorio) + " · " + CFG.site + "</div></div>";
}

function fichaHtml(linhas) {
  return "<table style='border-collapse:collapse;width:100%;font-size:14px'>" +
    linhas.map(l => "<tr><td style='padding:7px 10px;background:#f5f6f8;border:1px solid #e2e6ea;width:38%;font-weight:600;color:#061529'>" +
      esc(l[0]) + "</td><td style='padding:7px 10px;border:1px solid #e2e6ea'>" + esc(l[1]) + "</td></tr>").join("") +
    "</table>";
}
function tabela(html) { return "<table style='border-collapse:collapse;width:100%;font-size:13px'>" + html + "</table>"; }
function th(t) { return "<th style='text-align:left;padding:7px 8px;background:#061529;color:#fff;font-weight:600'>" + t + "</th>"; }
function td(t) { return "<td style='padding:7px 8px;border-bottom:1px solid #e2e6ea;vertical-align:top'>" + t + "</td>"; }

function enviar(para, assunto, html, responderPara) {
  MailApp.sendEmail({
    to: para, subject: assunto, htmlBody: html,
    name: CFG.nomeEscritorio, replyTo: responderPara || CFG.emailAdvogado
  });
}

function avisarErro(onde, e) {
  console.error(onde, e);
  try {
    MailApp.sendEmail(CFG.emailAdvogado, "JurisPro — falha na automação (" + onde + ")",
      "A rotina automática falhou: " + (e && e.message ? e.message : e) +
      "\n\nSe repetir, abra script.google.com > JurisPro > Execuções para ver o detalhe.");
  } catch (x) {}
}

/* ============================ FIRESTORE ============================ */

function baseUrl() {
  return "https://firestore.googleapis.com/v1/projects/" + CFG.projetoFirebase + "/databases/(default)/documents/";
}
function auth() { return { Authorization: "Bearer " + ScriptApp.getOAuthToken() }; }

function lerColecao(nome) {
  const out = [];
  let token = "";
  do {
    const url = baseUrl() + nome + "?pageSize=300" + (token ? "&pageToken=" + encodeURIComponent(token) : "");
    const r = UrlFetchApp.fetch(url, { headers: auth(), muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) throw new Error("Firestore " + nome + ": HTTP " + r.getResponseCode() + " — " + r.getContentText().slice(0, 300));
    const j = JSON.parse(r.getContentText());
    (j.documents || []).forEach(d => out.push(decodificar({ mapValue: { fields: d.fields || {} } })));
    token = j.nextPageToken || "";
  } while (token);
  return out;
}

function gravarCampo(colecao, id, campo, valor) {
  const url = baseUrl() + colecao + "/" + encodeURIComponent(id) + "?updateMask.fieldPaths=" + campo;
  const corpo = { fields: {} };
  corpo.fields[campo] = codificar(valor);
  const r = UrlFetchApp.fetch(url, {
    method: "patch", contentType: "application/json", headers: auth(),
    payload: JSON.stringify(corpo), muteHttpExceptions: true
  });
  if (r.getResponseCode() !== 200) throw new Error("Gravar " + colecao + "/" + id + ": " + r.getContentText().slice(0, 300));
}

function decodificar(v) {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(decodificar);
  if ("mapValue" in v) {
    const o = {}, f = v.mapValue.fields || {};
    Object.keys(f).forEach(k => o[k] = decodificar(f[k]));
    return o;
  }
  return null;
}

function codificar(x) {
  if (x === null || x === undefined) return { nullValue: null };
  if (typeof x === "boolean") return { booleanValue: x };
  if (typeof x === "number") return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(codificar) } };
  if (typeof x === "object") {
    const f = {};
    Object.keys(x).forEach(k => f[k] = codificar(x[k]));
    return { mapValue: { fields: f } };
  }
  return { stringValue: String(x) };
}

/* ============================ DATAS ============================ */

function hojeISO() { return Utilities.formatDate(new Date(), CFG.fuso, "yyyy-MM-dd"); }
function maisDias(iso, n) {
  const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function dataBR(iso) { const p = String(iso || "").split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : (iso || ""); }
function diaSemana(iso) {
  return ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"][new Date(iso + "T12:00:00Z").getUTCDay()];
}
function quando(iso) {
  const n = Math.round((new Date(iso + "T12:00:00Z") - new Date(hojeISO() + "T12:00:00Z")) / 86400000);
  return n <= 0 ? "hoje" : (n === 1 ? "amanhã" : "daqui a " + n + " dias");
}
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
