import './style.css';

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const firebaseConfig = {
  apiKey: "AIzaSyAKZkbZ-6eVr-J2Rv2iCuCurHOTOb7EHtc",
  authDomain: "mambucaba-2026.firebaseapp.com",
  projectId: "mambucaba-2026",
  storageBucket: "mambucaba-2026.firebasestorage.app",
  messagingSenderId: "231106595153",
  appId: "1:231106595153:web:fdbfd6ae291fb5e3ca6b70",
  measurementId: "G-09QLJFYPTR"
};

const ADMIN_EMAIL = 'eddesprj@gmail.com';
const VALOR_PASSAGEM = 90;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const dinheiro = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const state = {
  inscricoes: [],
  publicos: [],
  filtro: '',
};

document.querySelector('#app').innerHTML = `
  <main class="page">
    <section class="hero">
      <img
        src="/banner-mambucaba.jpg"
        alt="Banner Mambucaba Esporte Clube x Veterano Show"
        class="hero-banner"
      />
      <div class="hero-copy">
        <span class="tag">INSCRIÇÃO DE PASSAGENS</span>
        <h1>Mambucaba 2026</h1>
        <p class="hero-date"><strong>28/11/2026</strong> • Vila Histórica de Mambucaba</p>
        <p class="hero-price">Valor: <strong>R$ 90,00 por pessoa</strong></p>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <div>
          <span class="tag">PARTICIPANTE</span>
          <h2>Garanta sua passagem</h2>
        </div>
        <span class="price-badge">R$ 90,00</span>
      </div>

      <form id="form-inscricao" novalidate>
        <div class="form-grid">
          <label class="field-wide">
            Nome completo
            <input
              id="nome"
              maxlength="120"
              autocomplete="name"
              placeholder="Digite seu nome completo"
              required
            />
            <small>O nome completo ficará protegido e não será exibido na lista pública.</small>
          </label>

          <label>
            Apelido <span class="optional">(opcional)</span>
            <input
              id="apelido"
              maxlength="40"
              autocomplete="off"
              placeholder="Ex.: Juninho"
            />
          </label>

          <label>
            CPF
            <input
              id="cpf"
              inputmode="numeric"
              maxlength="14"
              autocomplete="off"
              placeholder="000.000.000-00"
              required
            />
            <small>Seu CPF não será exibido para outros participantes.</small>
          </label>

          <label>
            Quantidade de passagens
            <select id="quantidade">
              ${Array.from({ length: 20 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
            </select>
          </label>
        </div>

        <div class="total-box">
          <span>Valor total</span>
          <strong id="valor-total">${dinheiro.format(VALOR_PASSAGEM)}</strong>
        </div>

        <label class="check-row">
          <input id="consentimento" type="checkbox" required />
          <span>
            Autorizo o uso dos meus dados exclusivamente para a organização
            desta viagem/evento.
          </span>
        </label>

        <button id="btn-enviar" class="btn btn-primary" type="submit">
          Confirmar participação
        </button>

        <p id="form-msg" class="message" aria-live="polite"></p>
      </form>

      <div class="privacy">
        <strong>Privacidade:</strong> o nome completo e o CPF não aparecem publicamente.
        Na relação visível aos participantes será mostrado apenas o primeiro nome e o
        primeiro sobrenome, além do apelido entre parênteses quando informado.
      </div>
    </section>

    <section id="comprovante" class="card success-card hidden">
      <div class="success-mark">✓</div>
      <div>
        <span class="tag">CADASTRO CONFIRMADO</span>
        <h2>Participação registrada!</h2>
        <div id="comprovante-dados"></div>
      </div>
    </section>

    <section class="card public-card">
      <div class="public-head">
        <div>
          <span class="tag">LISTA PÚBLICA</span>
          <h2>Participantes confirmados</h2>
          <p>Somente nome parcial, apelido e quantidade de passagens ficam visíveis.</p>
        </div>
        <div class="public-stats">
          <article>
            <span>Participantes</span>
            <strong id="public-total-participantes">0</strong>
          </article>
          <article>
            <span>Passagens</span>
            <strong id="public-total-passagens">0</strong>
          </article>
        </div>
      </div>

      <div class="public-list-wrap">
        <table class="public-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nome</th>
              <th>Passagens</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody id="public-lista"></tbody>
        </table>
      </div>

      <p id="public-vazio" class="empty hidden">Ainda não há participantes exibidos.</p>
    </section>

    <div class="organizer-entry">
      <button id="abrir-admin" class="admin-link" type="button">
        🔒 Área do Organizador
      </button>
    </div>

    <section id="admin-panel" class="card hidden">
      <div class="admin-head">
        <div>
          <span class="tag">ACESSO RESTRITO</span>
          <h2>Área do Organizador</h2>
        </div>
        <button id="btn-sair" class="btn btn-outline hidden" type="button">Sair</button>
      </div>

      <div id="login-box">
        <form id="form-login">
          <label>
            Senha do organizador
            <input
              id="admin-senha"
              type="password"
              inputmode="numeric"
              autocomplete="current-password"
              placeholder="Digite a senha"
              required
            />
          </label>

          <button class="btn btn-dark" type="submit">Entrar</button>
          <p id="login-msg" class="message" aria-live="polite"></p>
        </form>
      </div>

      <div id="dashboard" class="hidden">
        <div class="stats">
          <article>
            <span>Cadastros</span>
            <strong id="stat-cadastros">0</strong>
          </article>
          <article>
            <span>Passagens</span>
            <strong id="stat-passagens">0</strong>
          </article>
          <article>
            <span>Valor total</span>
            <strong id="stat-valor">R$ 0,00</strong>
          </article>
        </div>

        <div class="toolbar">
          <input id="busca" type="search" placeholder="Buscar por nome, apelido ou CPF" />
          <div class="toolbar-buttons">
            <button id="btn-excel" class="btn btn-secondary" type="button">
              Baixar Excel
            </button>
            <button id="btn-pdf" class="btn btn-secondary" type="button">
              Gerar PDF
            </button>
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome completo</th>
                <th>Apelido</th>
                <th>CPF</th>
                <th>Passagens</th>
                <th>Total</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody id="lista"></tbody>
          </table>
        </div>

        <p id="vazio" class="empty hidden">Nenhum cadastro encontrado.</p>
      </div>
    </section>

    <footer class="footer-area">
      <div class="creator-credit">⚙️ Criado por <strong>Edshow</strong></div>
      <div class="footer-event">Evento em Mambucaba • 28/11/2026</div>
    </footer>
  </main>
`;

const el = {
  form: document.querySelector('#form-inscricao'),
  nome: document.querySelector('#nome'),
  apelido: document.querySelector('#apelido'),
  cpf: document.querySelector('#cpf'),
  quantidade: document.querySelector('#quantidade'),
  consentimento: document.querySelector('#consentimento'),
  total: document.querySelector('#valor-total'),
  btnEnviar: document.querySelector('#btn-enviar'),
  formMsg: document.querySelector('#form-msg'),
  comprovante: document.querySelector('#comprovante'),
  comprovanteDados: document.querySelector('#comprovante-dados'),

  publicLista: document.querySelector('#public-lista'),
  publicVazio: document.querySelector('#public-vazio'),
  publicTotalParticipantes: document.querySelector('#public-total-participantes'),
  publicTotalPassagens: document.querySelector('#public-total-passagens'),

  abrirAdmin: document.querySelector('#abrir-admin'),
  adminPanel: document.querySelector('#admin-panel'),
  loginBox: document.querySelector('#login-box'),
  formLogin: document.querySelector('#form-login'),
  adminSenha: document.querySelector('#admin-senha'),
  loginMsg: document.querySelector('#login-msg'),
  dashboard: document.querySelector('#dashboard'),
  btnSair: document.querySelector('#btn-sair'),

  statCadastros: document.querySelector('#stat-cadastros'),
  statPassagens: document.querySelector('#stat-passagens'),
  statValor: document.querySelector('#stat-valor'),
  busca: document.querySelector('#busca'),
  lista: document.querySelector('#lista'),
  vazio: document.querySelector('#vazio'),
  btnExcel: document.querySelector('#btn-excel'),
  btnPdf: document.querySelector('#btn-pdf'),
};

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatCpf(value) {
  const cpf = digits(value).slice(0, 11);
  return cpf
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

function cpfIsValid(value) {
  const cpf = digits(value);

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const checkDigit = (slice, factor) => {
    let sum = 0;
    for (const char of slice) sum += Number(char) * factor--;
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };

  const d1 = checkDigit(cpf.slice(0, 9), 10);
  const d2 = checkDigit(cpf.slice(0, 10), 11);

  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

function maskCpf(value) {
  const cpf = digits(value);
  return cpf.length === 11 ? `***.***.***-${cpf.slice(-2)}` : '***';
}

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function fullNameIsValid(value) {
  const parts = cleanText(value).split(' ').filter(Boolean);
  return parts.length >= 2 && parts.every((part) => part.length >= 2);
}

function publicName(fullName, nickname = '') {
  const parts = cleanText(fullName).split(' ').filter(Boolean);
  const base = parts.slice(0, 2).join(' ');
  const nick = cleanText(nickname);
  return nick ? `${base} (${nick})` : base;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatPublicDate(value) {
  if (!value) return '—';

  const date = typeof value.toDate === 'function'
    ? value.toDate()
    : new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function refreshTotal() {
  const qtd = Number(el.quantidade.value || 1);
  el.total.textContent = dinheiro.format(qtd * VALOR_PASSAGEM);
}

el.quantidade.addEventListener('change', refreshTotal);
el.cpf.addEventListener('input', () => {
  el.cpf.value = formatCpf(el.cpf.value);
});

el.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  el.formMsg.textContent = '';

  const nome = cleanText(el.nome.value);
  const apelido = cleanText(el.apelido.value);
  const cpf = digits(el.cpf.value);
  const quantidade = Number(el.quantidade.value);
  const valorTotal = quantidade * VALOR_PASSAGEM;
  const nomePublico = publicName(nome, apelido);

  if (!fullNameIsValid(nome)) {
    el.formMsg.textContent = 'Informe seu nome completo.';
    el.nome.focus();
    return;
  }

  if (apelido.length > 40) {
    el.formMsg.textContent = 'O apelido deve ter no máximo 40 caracteres.';
    el.apelido.focus();
    return;
  }

  if (!cpfIsValid(cpf)) {
    el.formMsg.textContent = 'Informe um CPF válido.';
    el.cpf.focus();
    return;
  }

  if (!el.consentimento.checked) {
    el.formMsg.textContent = 'Marque a autorização de uso dos dados.';
    return;
  }

  el.btnEnviar.disabled = true;
  el.btnEnviar.textContent = 'Salvando...';

  try {
    const batch = writeBatch(db);

    batch.set(doc(db, 'inscricoes', cpf), {
      nome,
      apelido,
      cpf,
      quantidade,
      valorUnitario: VALOR_PASSAGEM,
      valorTotal,
      criadoEm: serverTimestamp(),
    });

    batch.set(doc(db, 'participantesPublicos', cpf), {
      nomePublico,
      quantidade,
      criadoEm: serverTimestamp(),
    });

    await batch.commit();

    el.comprovanteDados.innerHTML = `
      <p><strong>${escapeHtml(nome)}</strong>${apelido ? ` <span class="nick">(${escapeHtml(apelido)})</span>` : ''}</p>
      <p>CPF: ${maskCpf(cpf)}</p>
      <p>${quantidade} ${quantidade === 1 ? 'passagem' : 'passagens'} • <strong>${dinheiro.format(valorTotal)}</strong></p>
      <p>Mambucaba • 28/11/2026</p>
    `;

    el.comprovante.classList.remove('hidden');
    el.form.reset();
    el.quantidade.value = '1';
    refreshTotal();
    el.formMsg.textContent = 'Cadastro realizado com sucesso.';
    el.comprovante.scrollIntoView({ behavior: 'smooth', block: 'center' });

    await loadPublicList();
  } catch (error) {
    console.error(error);

    if (error?.code === 'permission-denied') {
      el.formMsg.textContent =
        'Este CPF já possui cadastro ou a inscrição não pôde ser autorizada.';
    } else {
      el.formMsg.textContent =
        'Não foi possível salvar agora. Tente novamente.';
    }
  } finally {
    el.btnEnviar.disabled = false;
    el.btnEnviar.textContent = 'Confirmar participação';
  }
});

async function loadPublicList() {
  try {
    const q = query(collection(db, 'participantesPublicos'), orderBy('criadoEm'));
    const snapshot = await getDocs(q);

    state.publicos = snapshot.docs.map((snap) => ({
      id: snap.id,
      ...snap.data(),
    }));

    renderPublicList();
  } catch (error) {
    console.error(error);
    state.publicos = [];
    renderPublicList();
  }
}

function renderPublicList() {
  const totalPassagens = state.publicos.reduce(
    (sum, item) => sum + Number(item.quantidade || 0),
    0
  );

  el.publicTotalParticipantes.textContent = state.publicos.length;
  el.publicTotalPassagens.textContent = totalPassagens;

  el.publicLista.innerHTML = '';
  el.publicVazio.classList.toggle('hidden', state.publicos.length > 0);

  state.publicos.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="#">${index + 1}</td>
      <td data-label="Nome"><strong>${escapeHtml(item.nomePublico)}</strong></td>
      <td data-label="Passagens">${Number(item.quantidade)}</td>
      <td data-label="Data">${formatPublicDate(item.criadoEm)}</td>
    `;
    el.publicLista.appendChild(tr);
  });
}

el.abrirAdmin.addEventListener('click', () => {
  el.adminPanel.classList.toggle('hidden');

  if (!el.adminPanel.classList.contains('hidden')) {
    el.adminPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

el.formLogin.addEventListener('submit', async (event) => {
  event.preventDefault();
  el.loginMsg.textContent = '';

  try {
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, el.adminSenha.value);
    el.adminSenha.value = '';
  } catch (error) {
    console.error(error);
    el.loginMsg.textContent = 'Senha incorreta ou acesso não autorizado.';
  }
});

el.btnSair.addEventListener('click', async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    el.loginBox.classList.add('hidden');
    el.dashboard.classList.remove('hidden');
    el.btnSair.classList.remove('hidden');
    el.loginMsg.textContent = '';
    await loadRegistrations();
  } else {
    state.inscricoes = [];
    el.loginBox.classList.remove('hidden');
    el.dashboard.classList.add('hidden');
    el.btnSair.classList.add('hidden');
  }
});

async function loadRegistrations() {
  try {
    const q = query(collection(db, 'inscricoes'), orderBy('nome'));
    const snapshot = await getDocs(q);

    state.inscricoes = snapshot.docs.map((snap) => ({
      id: snap.id,
      ...snap.data(),
    }));

    await syncMissingPublicRecords();
    refreshDashboard();
  } catch (error) {
    console.error(error);
    alert('Não foi possível carregar as inscrições.');
  }
}

async function syncMissingPublicRecords() {
  try {
    const publicSnapshot = await getDocs(collection(db, 'participantesPublicos'));
    const publicIds = new Set(publicSnapshot.docs.map((snap) => snap.id));
    const missing = state.inscricoes.filter((item) => !publicIds.has(item.id));

    if (!missing.length) {
      await loadPublicList();
      return;
    }

    const batch = writeBatch(db);

    missing.forEach((item) => {
      batch.set(doc(db, 'participantesPublicos', item.id), {
        nomePublico: publicName(item.nome, item.apelido || ''),
        quantidade: Number(item.quantidade || 1),
        criadoEm: item.criadoEm || serverTimestamp(),
      });
    });

    await batch.commit();
    await loadPublicList();
  } catch (error) {
    console.error('Falha ao sincronizar lista pública:', error);
  }
}

function refreshDashboard() {
  const passagens = state.inscricoes.reduce(
    (sum, item) => sum + Number(item.quantidade || 0),
    0
  );

  const total = state.inscricoes.reduce(
    (sum, item) => sum + Number(item.valorTotal || 0),
    0
  );

  el.statCadastros.textContent = state.inscricoes.length;
  el.statPassagens.textContent = passagens;
  el.statValor.textContent = dinheiro.format(total);

  renderTable();
}

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function filteredItems() {
  const term = normalizeSearch(state.filtro);
  if (!term) return state.inscricoes;

  return state.inscricoes.filter((item) => {
    const byName = normalizeSearch(item.nome).includes(term);
    const byNickname = normalizeSearch(item.apelido || '').includes(term);
    const byCpf = digits(item.cpf).includes(digits(term));
    return byName || byNickname || byCpf;
  });
}

el.busca.addEventListener('input', () => {
  state.filtro = el.busca.value;
  renderTable();
});

function renderTable() {
  const items = filteredItems();

  el.lista.innerHTML = '';
  el.vazio.classList.toggle('hidden', items.length > 0);

  for (const item of items) {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td data-label="Nome">${escapeHtml(item.nome)}</td>
      <td data-label="Apelido">${escapeHtml(item.apelido || '—')}</td>
      <td data-label="CPF">${formatCpf(item.cpf)}</td>
      <td data-label="Passagens">${Number(item.quantidade)}</td>
      <td data-label="Total">${dinheiro.format(Number(item.valorTotal || 0))}</td>
      <td data-label="Ações" class="actions">
        <button class="row-action" data-action="editar" data-id="${item.id}">Editar</button>
        <button class="row-action danger" data-action="excluir" data-id="${item.id}">Excluir</button>
      </td>
    `;

    el.lista.appendChild(tr);
  }
}

el.lista.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const item = state.inscricoes.find((row) => row.id === button.dataset.id);
  if (!item) return;

  if (button.dataset.action === 'editar') {
    const novoNome = prompt('Nome completo:', item.nome);
    if (novoNome === null) return;

    const novoApelido = prompt('Apelido (opcional):', item.apelido || '');
    if (novoApelido === null) return;

    const novaQtd = prompt('Quantidade de passagens (1 a 20):', item.quantidade);
    if (novaQtd === null) return;

    const nome = cleanText(novoNome);
    const apelido = cleanText(novoApelido);
    const quantidade = Number(novaQtd);

    if (!fullNameIsValid(nome)) {
      alert('Informe um nome completo válido.');
      return;
    }

    if (apelido.length > 40) {
      alert('O apelido deve ter no máximo 40 caracteres.');
      return;
    }

    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 20) {
      alert('A quantidade deve ser um número inteiro entre 1 e 20.');
      return;
    }

    try {
      const batch = writeBatch(db);

      batch.update(doc(db, 'inscricoes', item.id), {
        nome,
        apelido,
        quantidade,
        valorTotal: quantidade * VALOR_PASSAGEM,
      });

      batch.set(doc(db, 'participantesPublicos', item.id), {
        nomePublico: publicName(nome, apelido),
        quantidade,
        criadoEm: item.criadoEm || serverTimestamp(),
      });

      await batch.commit();
      await loadRegistrations();
    } catch (error) {
      console.error(error);
      alert('Não foi possível atualizar o cadastro.');
    }
  }

  if (button.dataset.action === 'excluir') {
    if (!confirm(`Excluir o cadastro de ${item.nome}?`)) return;

    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'inscricoes', item.id));
      batch.delete(doc(db, 'participantesPublicos', item.id));
      await batch.commit();
      await loadRegistrations();
    } catch (error) {
      console.error(error);
      alert('Não foi possível excluir o cadastro.');
    }
  }
});

function xmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

el.btnExcel.addEventListener('click', () => {
  if (!state.inscricoes.length) {
    alert('Não há inscrições para exportar.');
    return;
  }

  const rows = state.inscricoes
    .map((item, index) => `
      <Row>
        <Cell><Data ss:Type="Number">${index + 1}</Data></Cell>
        <Cell><Data ss:Type="String">${xmlEscape(item.nome)}</Data></Cell>
        <Cell><Data ss:Type="String">${xmlEscape(item.apelido || '')}</Data></Cell>
        <Cell><Data ss:Type="String">${formatCpf(item.cpf)}</Data></Cell>
        <Cell><Data ss:Type="Number">${Number(item.quantidade)}</Data></Cell>
        <Cell><Data ss:Type="Number">${VALOR_PASSAGEM}</Data></Cell>
        <Cell><Data ss:Type="Number">${Number(item.valorTotal || 0)}</Data></Cell>
      </Row>
    `)
    .join('');

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Inscrições">
  <Table>
   <Row>
    <Cell><Data ss:Type="String">Nº</Data></Cell>
    <Cell><Data ss:Type="String">Nome completo</Data></Cell>
    <Cell><Data ss:Type="String">Apelido</Data></Cell>
    <Cell><Data ss:Type="String">CPF</Data></Cell>
    <Cell><Data ss:Type="String">Passagens</Data></Cell>
    <Cell><Data ss:Type="String">Valor unitário</Data></Cell>
    <Cell><Data ss:Type="String">Valor total</Data></Cell>
   </Row>
   ${rows}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  });

  downloadBlob(blob, 'Mambucaba_2026_Inscricoes.xls');
});

el.btnPdf.addEventListener('click', () => {
  if (!state.inscricoes.length) {
    alert('Não há inscrições para exportar.');
    return;
  }

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const totalPassagens = state.inscricoes.reduce(
    (sum, item) => sum + Number(item.quantidade || 0),
    0
  );

  const totalValor = state.inscricoes.reduce(
    (sum, item) => sum + Number(item.valorTotal || 0),
    0
  );

  pdf.setFontSize(18);
  pdf.text('Mambucaba 2026 — Relação de Participantes', 14, 16);

  pdf.setFontSize(10);
  pdf.text(
    'Evento: 28/11/2026 • Vila Histórica de Mambucaba • Passagem: R$ 90,00',
    14,
    23
  );

  pdf.text(
    `Cadastros: ${state.inscricoes.length} | Passagens: ${totalPassagens} | Valor total: ${dinheiro.format(totalValor)}`,
    14,
    29
  );

  autoTable(pdf, {
    startY: 34,
    head: [['Nº', 'Nome completo', 'Apelido', 'CPF', 'Passagens', 'Valor unitário', 'Valor total']],
    body: state.inscricoes.map((item, index) => [
      index + 1,
      item.nome,
      item.apelido || '—',
      formatCpf(item.cpf),
      Number(item.quantidade),
      dinheiro.format(VALOR_PASSAGEM),
      dinheiro.format(Number(item.valorTotal || 0)),
    ]),
    styles: { fontSize: 8.5 },
  });

  pdf.save('Mambucaba_2026_Inscricoes.pdf');
});

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

refreshTotal();
loadPublicList();
