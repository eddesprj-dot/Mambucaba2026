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
  setDoc,
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
const LIMITE_MEMBROS = 20;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const dinheiro = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const state = {
  membros: [],
  familiasPublicas: [],
  familiasPrivadas: [],
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
          <span class="tag">CADASTRO POR FAMÍLIA</span>
          <h2>Responsável pela família</h2>
        </div>
        <span class="price-badge">R$ 90,00 / pessoa</span>
      </div>

      <form id="form-familia" novalidate>
        <div class="form-grid">
          <label class="field-wide">
            Nome completo
            <input
              id="responsavel-nome"
              maxlength="120"
              autocomplete="name"
              placeholder="Digite o nome completo do responsável"
              required
            />
            <small>O nome completo ficará protegido e não será exibido na lista pública.</small>
          </label>

          <label>
            Apelido <span class="optional">(opcional)</span>
            <input
              id="responsavel-apelido"
              maxlength="40"
              autocomplete="off"
              placeholder="Ex.: Edshow"
            />
          </label>

          <label>
            CPF
            <input
              id="responsavel-cpf"
              inputmode="numeric"
              maxlength="14"
              autocomplete="off"
              placeholder="000.000.000-00"
              required
            />
          </label>
        </div>

        <div class="members-box">
          <div class="members-head">
            <div>
              <span class="tag">MEMBROS DA FAMÍLIA</span>
              <h3>Quem mais vai viajar?</h3>
            </div>
            <button id="btn-adicionar-membro" class="btn btn-secondary" type="button">
              + Adicionar membro
            </button>
          </div>

          <div id="membros-container" class="members-list"></div>
          <p id="sem-membros" class="members-empty">
            Nenhum outro membro incluído. O responsável já conta como 1 passageiro.
          </p>
        </div>

        <div class="family-summary">
          <article>
            <span>Família</span>
            <strong id="resumo-familia">1 pessoa</strong>
          </article>
          <article>
            <span>Passagens</span>
            <strong id="resumo-passagens">1</strong>
          </article>
          <article class="summary-total">
            <span>Valor total</span>
            <strong id="resumo-total">${dinheiro.format(VALOR_PASSAGEM)}</strong>
          </article>
        </div>

        <label class="check-row">
          <input id="consentimento" type="checkbox" required />
          <span>
            Autorizo o uso dos dados informados exclusivamente para organização,
            documentação de passageiros e emissão/controle das passagens desta viagem.
          </span>
        </label>

        <button id="btn-enviar" class="btn btn-primary" type="submit">
          Confirmar inscrição da família
        </button>

        <p id="form-msg" class="message" aria-live="polite"></p>
      </form>

      <div class="privacy">
        <strong>Privacidade:</strong> CPF, nome completo e idade dos filhos não aparecem publicamente.
        Na lista pública será exibido somente o primeiro nome + primeiro sobrenome do responsável,
        com apelido entre parênteses quando informado, e o total de passageiros da família.
      </div>
    </section>

    <section id="comprovante" class="card success-card hidden">
      <div class="success-mark">✓</div>
      <div>
        <span class="tag">INSCRIÇÃO CONFIRMADA</span>
        <h2>Família registrada!</h2>
        <div id="comprovante-dados"></div>
      </div>
    </section>

    <section class="card public-card">
      <div class="public-head">
        <div>
          <span class="tag">LISTA PÚBLICA</span>
          <h2>Famílias confirmadas</h2>
          <p>Somente o responsável abreviado, apelido e quantidade da família ficam visíveis.</p>
        </div>

        <div class="public-stats">
          <article>
            <span>Famílias</span>
            <strong id="public-total-familias">0</strong>
          </article>
          <article>
            <span>Passageiros</span>
            <strong id="public-total-passageiros">0</strong>
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
              <th>Responsável</th>
              <th>Família</th>
              <th>Passagens</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody id="public-lista"></tbody>
        </table>
      </div>

      <p id="public-vazio" class="empty hidden">Ainda não há famílias exibidas.</p>
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
            <span>Famílias</span>
            <strong id="stat-familias">0</strong>
          </article>
          <article>
            <span>Passageiros</span>
            <strong id="stat-passageiros">0</strong>
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
          <input id="busca" type="search" placeholder="Buscar por família, passageiro, apelido ou CPF" />
          <div class="toolbar-buttons">
            <button id="btn-excel" class="btn btn-secondary" type="button">Baixar Excel</button>
            <button id="btn-pdf" class="btn btn-secondary" type="button">Gerar PDF</button>
            <button id="btn-pdf-onibus" class="btn btn-secondary" type="button">PDF Empresa de Ônibus</button>
          </div>
        </div>

        <div class="family-admin-list" id="familias-admin"></div>
        <p id="admin-vazio" class="empty hidden">Nenhuma família encontrada.</p>
      </div>
    </section>

    <footer class="footer-area">
      <div class="creator-credit">⚙️ Criado por <strong>Edshow</strong></div>
      <div class="footer-event">Evento em Mambucaba • 28/11/2026</div>
    </footer>
  </main>

  <dialog id="dialog-tipo" class="member-dialog">
    <form method="dialog" class="dialog-card">
      <span class="tag">NOVO MEMBRO</span>
      <h3>Quem você deseja adicionar?</h3>
      <div class="member-type-grid">
        <button value="ESPOSA/COMPANHEIRA" class="member-type" type="submit">Esposa / Companheira</button>
        <button value="FILHO(A)" class="member-type" type="submit">Filho(a)</button>
        <button value="OUTRO MEMBRO" class="member-type" type="submit">Outro membro</button>
      </div>
      <button value="cancel" class="btn btn-outline dialog-cancel" type="submit">Cancelar</button>
    </form>
  </dialog>
`;

const el = {
  form: document.querySelector('#form-familia'),
  responsavelNome: document.querySelector('#responsavel-nome'),
  responsavelApelido: document.querySelector('#responsavel-apelido'),
  responsavelCpf: document.querySelector('#responsavel-cpf'),
  membrosContainer: document.querySelector('#membros-container'),
  semMembros: document.querySelector('#sem-membros'),
  btnAdicionarMembro: document.querySelector('#btn-adicionar-membro'),
  dialogTipo: document.querySelector('#dialog-tipo'),
  consentimento: document.querySelector('#consentimento'),
  resumoFamilia: document.querySelector('#resumo-familia'),
  resumoPassagens: document.querySelector('#resumo-passagens'),
  resumoTotal: document.querySelector('#resumo-total'),
  btnEnviar: document.querySelector('#btn-enviar'),
  formMsg: document.querySelector('#form-msg'),
  comprovante: document.querySelector('#comprovante'),
  comprovanteDados: document.querySelector('#comprovante-dados'),

  publicLista: document.querySelector('#public-lista'),
  publicVazio: document.querySelector('#public-vazio'),
  publicTotalFamilias: document.querySelector('#public-total-familias'),
  publicTotalPassageiros: document.querySelector('#public-total-passageiros'),
  publicTotalPassagens: document.querySelector('#public-total-passagens'),

  abrirAdmin: document.querySelector('#abrir-admin'),
  adminPanel: document.querySelector('#admin-panel'),
  loginBox: document.querySelector('#login-box'),
  formLogin: document.querySelector('#form-login'),
  adminSenha: document.querySelector('#admin-senha'),
  loginMsg: document.querySelector('#login-msg'),
  dashboard: document.querySelector('#dashboard'),
  btnSair: document.querySelector('#btn-sair'),
  busca: document.querySelector('#busca'),
  familiasAdmin: document.querySelector('#familias-admin'),
  adminVazio: document.querySelector('#admin-vazio'),
  statFamilias: document.querySelector('#stat-familias'),
  statPassageiros: document.querySelector('#stat-passageiros'),
  statPassagens: document.querySelector('#stat-passagens'),
  statValor: document.querySelector('#stat-valor'),
  btnExcel: document.querySelector('#btn-excel'),
  btnPdf: document.querySelector('#btn-pdf'),
  btnPdfOnibus: document.querySelector('#btn-pdf-onibus'),
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

  return (
    checkDigit(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    checkDigit(cpf.slice(0, 10), 11) === Number(cpf[10])
  );
}

function maskCpf(value) {
  const cpf = digits(value);
  return cpf.length === 11 ? `***.***.***-${cpf.slice(-2)}` : '—';
}

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function upperText(value) {
  return cleanText(value).toLocaleUpperCase('pt-BR');
}

function fullNameIsValid(value) {
  const parts = cleanText(value).split(' ').filter(Boolean);
  return parts.length >= 2 && parts.every((part) => part.length >= 2);
}

function publicName(fullName, nickname = '') {
  const parts = upperText(fullName).split(' ').filter(Boolean);
  const base = parts.slice(0, 2).join(' ');
  const nick = upperText(nickname);
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

function makeId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatDate(value) {
  if (!value) return '—';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function totalPessoas() {
  return 1 + state.membros.length;
}

function refreshSummary() {
  const pessoas = totalPessoas();
  el.resumoFamilia.textContent = `${pessoas} ${pessoas === 1 ? 'pessoa' : 'pessoas'}`;
  el.resumoPassagens.textContent = pessoas;
  el.resumoTotal.textContent = dinheiro.format(pessoas * VALOR_PASSAGEM);
  el.semMembros.classList.toggle('hidden', state.membros.length > 0);
}

function memberTemplate(member) {
  const isChild = member.tipo === 'FILHO(A)';
  const cpfObrigatorio = !isChild;

  return `
    <article class="member-card" data-id="${member.id}">
      <div class="member-card-head">
        <div>
          <span class="member-kind">${escapeHtml(member.tipo)}</span>
          <strong>Membro ${state.membros.findIndex((m) => m.id === member.id) + 1}</strong>
        </div>
        <button class="remove-member" type="button" data-remove="${member.id}">Remover</button>
      </div>

      <div class="member-fields">
        <label class="field-wide">
          Nome completo
          <input
            data-field="nome"
            value="${escapeHtml(member.nome)}"
            maxlength="120"
            placeholder="Nome completo"
            required
          />
        </label>

        <label>
          Apelido <span class="optional">(opcional)</span>
          <input
            data-field="apelido"
            value="${escapeHtml(member.apelido)}"
            maxlength="40"
            placeholder="Apelido"
          />
        </label>

        <label>
          CPF ${isChild ? '<span class="optional">(opcional)</span>' : ''}
          <input
            data-field="cpf"
            value="${escapeHtml(formatCpf(member.cpf))}"
            inputmode="numeric"
            maxlength="14"
            placeholder="000.000.000-00"
            ${cpfObrigatorio ? 'required' : ''}
          />
        </label>

        ${isChild ? `
          <label>
            Idade
            <input
              data-field="idade"
              value="${member.idade ?? ''}"
              inputmode="numeric"
              type="number"
              min="0"
              max="17"
              placeholder="Idade"
              required
            />
          </label>
        ` : ''}
      </div>
    </article>
  `;
}

function renderMembers() {
  el.membrosContainer.innerHTML = state.membros.map(memberTemplate).join('');
  refreshSummary();
}

el.btnAdicionarMembro.addEventListener('click', () => {
  if (state.membros.length >= LIMITE_MEMBROS - 1) {
    alert(`Limite máximo de ${LIMITE_MEMBROS} passageiros por família.`);
    return;
  }
  el.dialogTipo.showModal();
});

el.dialogTipo.addEventListener('close', () => {
  const tipo = el.dialogTipo.returnValue;
  if (!['ESPOSA/COMPANHEIRA', 'FILHO(A)', 'OUTRO MEMBRO'].includes(tipo)) return;

  state.membros.push({
    id: makeId(),
    tipo,
    nome: '',
    apelido: '',
    cpf: '',
    idade: null,
  });

  renderMembers();
});

el.membrosContainer.addEventListener('input', (event) => {
  const card = event.target.closest('.member-card');
  if (!card) return;

  const member = state.membros.find((item) => item.id === card.dataset.id);
  if (!member) return;

  const field = event.target.dataset.field;
  if (!field) return;

  if (field === 'cpf') {
    event.target.value = formatCpf(event.target.value);
    member.cpf = digits(event.target.value);
  } else if (field === 'idade') {
    member.idade = event.target.value === '' ? null : Number(event.target.value);
  } else {
    member[field] = event.target.value;
  }
});

el.membrosContainer.addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove]');
  if (!button) return;

  state.membros = state.membros.filter((item) => item.id !== button.dataset.remove);
  renderMembers();
});

el.responsavelCpf.addEventListener('input', () => {
  el.responsavelCpf.value = formatCpf(el.responsavelCpf.value);
});

function validateFamily() {
  const responsavel = {
    tipo: 'RESPONSÁVEL',
    nome: upperText(el.responsavelNome.value),
    apelido: upperText(el.responsavelApelido.value),
    cpf: digits(el.responsavelCpf.value),
    idade: null,
  };

  if (!fullNameIsValid(responsavel.nome)) {
    return { error: 'Informe o nome completo do responsável.' };
  }

  if (!cpfIsValid(responsavel.cpf)) {
    return { error: 'Informe um CPF válido para o responsável.' };
  }

  const membros = [];

  for (const item of state.membros) {
    const membro = {
      tipo: item.tipo,
      nome: upperText(item.nome),
      apelido: upperText(item.apelido),
      cpf: digits(item.cpf),
      idade: item.tipo === 'FILHO(A)' ? Number(item.idade) : null,
    };

    if (!fullNameIsValid(membro.nome)) {
      return { error: `Informe o nome completo de ${membro.tipo}.` };
    }

    if (membro.tipo === 'FILHO(A)') {
      if (!Number.isInteger(membro.idade) || membro.idade < 0 || membro.idade > 17) {
        return { error: `Informe uma idade válida (0 a 17 anos) para ${membro.nome}.` };
      }
      if (membro.cpf && !cpfIsValid(membro.cpf)) {
        return { error: `O CPF informado para ${membro.nome} não é válido.` };
      }
    } else {
      if (!cpfIsValid(membro.cpf)) {
        return { error: `Informe um CPF válido para ${membro.nome}.` };
      }
    }

    membros.push(membro);
  }

  const cpfs = [responsavel.cpf, ...membros.map((m) => m.cpf).filter(Boolean)];
  if (new Set(cpfs).size !== cpfs.length) {
    return { error: 'Há CPF repetido dentro da própria família.' };
  }

  return { responsavel, membros };
}

el.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  el.formMsg.textContent = '';

  const result = validateFamily();
  if (result.error) {
    el.formMsg.textContent = result.error;
    return;
  }

  if (!el.consentimento.checked) {
    el.formMsg.textContent = 'Marque a autorização de uso dos dados.';
    return;
  }

  const { responsavel, membros } = result;
  const familiaId = responsavel.cpf;
  const pessoas = 1 + membros.length;
  const valorTotal = pessoas * VALOR_PASSAGEM;
  const nomePublico = publicName(responsavel.nome, responsavel.apelido);

  el.btnEnviar.disabled = true;
  el.btnEnviar.textContent = 'Salvando...';

  try {
    const batch = writeBatch(db);

    batch.set(doc(db, 'familias', familiaId), {
      responsavel,
      membros,
      totalPessoas: pessoas,
      totalPassagens: pessoas,
      valorUnitario: VALOR_PASSAGEM,
      valorTotal,
      criadoEm: serverTimestamp(),
    });

    batch.set(doc(db, 'familiasPublicas', familiaId), {
      nomePublico,
      totalPessoas: pessoas,
      totalPassagens: pessoas,
      criadoEm: serverTimestamp(),
    });

    await batch.commit();

    el.comprovanteDados.innerHTML = `
      <p><strong>${escapeHtml(responsavel.nome)}</strong>${responsavel.apelido ? ` <span class="nick">(${escapeHtml(responsavel.apelido)})</span>` : ''}</p>
      <p>CPF do responsável: ${maskCpf(responsavel.cpf)}</p>
      <p>${pessoas} ${pessoas === 1 ? 'passageiro' : 'passageiros'} • <strong>${dinheiro.format(valorTotal)}</strong></p>
      <p>Mambucaba • 28/11/2026</p>
    `;

    el.comprovante.classList.remove('hidden');
    el.form.reset();
    state.membros = [];
    renderMembers();
    el.formMsg.textContent = 'Cadastro da família realizado com sucesso.';
    el.comprovante.scrollIntoView({ behavior: 'smooth', block: 'center' });

    await loadPublicFamilies();
  } catch (error) {
    console.error(error);
    if (error?.code === 'permission-denied') {
      el.formMsg.textContent =
        'A inscrição foi bloqueada pelas regras de segurança. Atualize as regras do Firestore e tente novamente.';
    } else {
      el.formMsg.textContent = 'Não foi possível salvar agora. Tente novamente.';
    }
  } finally {
    el.btnEnviar.disabled = false;
    el.btnEnviar.textContent = 'Confirmar inscrição da família';
  }
});

async function loadPublicFamilies() {
  try {
    const [familiasSnap, antigosSnap] = await Promise.all([
      getDocs(collection(db, 'familiasPublicas')),
      getDocs(collection(db, 'participantesPublicos')),
    ]);

    const familiasNovas = familiasSnap.docs.map((snap) => ({
      id: snap.id,
      legacy: false,
      ...snap.data(),
    }));

    const idsNovos = new Set(familiasNovas.map((item) => item.id));

    const cadastrosAntigos = antigosSnap.docs
      .filter((snap) => !idsNovos.has(snap.id))
      .map((snap) => {
        const data = snap.data();
        return {
          id: snap.id,
          legacy: true,
          nomePublico: data.nomePublico || 'CADASTRO ANTERIOR',
          totalPessoas: 1,
          totalPassagens: Number(data.quantidade || 1),
          criadoEm: data.criadoEm || null,
        };
      });

    state.familiasPublicas = [...familiasNovas, ...cadastrosAntigos].sort((a, b) => {
      const da = a.criadoEm?.toMillis?.() || 0;
      const dbb = b.criadoEm?.toMillis?.() || 0;
      return da - dbb;
    });

    renderPublicFamilies();
  } catch (error) {
    console.error(error);
    state.familiasPublicas = [];
    renderPublicFamilies();
  }
}
function renderPublicFamilies() {
  const totalPassageiros = state.familiasPublicas.reduce(
    (sum, item) => sum + Number(item.totalPessoas || 0),
    0
  );

  const totalPassagens = state.familiasPublicas.reduce(
    (sum, item) => sum + Number(item.totalPassagens || 0),
    0
  );

  el.publicTotalFamilias.textContent = state.familiasPublicas.length;
  el.publicTotalPassageiros.textContent = totalPassageiros;
  el.publicTotalPassagens.textContent = totalPassagens;

  el.publicLista.innerHTML = '';
  el.publicVazio.classList.toggle('hidden', state.familiasPublicas.length > 0);

  state.familiasPublicas.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="#">${index + 1}</td>
      <td data-label="Responsável"><strong>${escapeHtml(upperText(item.nomePublico))}</strong></td>
      <td data-label="Família">${item.legacy ? 'CADASTRO ANTERIOR' : `${Number(item.totalPessoas)} ${Number(item.totalPessoas) === 1 ? 'pessoa' : 'pessoas'}`}</td>
      <td data-label="Passagens">${Number(item.totalPassagens)}</td>
      <td data-label="Data">${formatDate(item.criadoEm)}</td>
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
    await loadPrivateFamilies();
  } else {
    state.familiasPrivadas = [];
    el.loginBox.classList.remove('hidden');
    el.dashboard.classList.add('hidden');
    el.btnSair.classList.add('hidden');
  }
});

async function loadPrivateFamilies() {
  try {
    const [familiasSnap, antigosSnap] = await Promise.all([
      getDocs(collection(db, 'familias')),
      getDocs(collection(db, 'inscricoes')),
    ]);

    const familiasNovas = familiasSnap.docs.map((snap) => ({
      id: snap.id,
      legacy: false,
      ...snap.data(),
    }));

    const idsNovos = new Set(familiasNovas.map((item) => item.id));

    const cadastrosAntigos = antigosSnap.docs
      .filter((snap) => !idsNovos.has(snap.id))
      .map((snap) => {
        const data = snap.data();
        return {
          id: snap.id,
          legacy: true,
          responsavel: {
            tipo: 'CADASTRO ANTERIOR',
            nome: upperText(data.nome || ''),
            apelido: upperText(data.apelido || ''),
            cpf: data.cpf || snap.id,
            idade: null,
          },
          membros: [],
          totalPessoas: 1,
          totalPassagens: Number(data.quantidade || 1),
          valorUnitario: Number(data.valorUnitario || VALOR_PASSAGEM),
          valorTotal: Number(data.valorTotal || (Number(data.quantidade || 1) * VALOR_PASSAGEM)),
          criadoEm: data.criadoEm || null,
        };
      });

    state.familiasPrivadas = [...familiasNovas, ...cadastrosAntigos].sort((a, b) =>
      upperText(a.responsavel?.nome || '').localeCompare(
        upperText(b.responsavel?.nome || ''),
        'pt-BR'
      )
    );

    refreshAdmin();
  } catch (error) {
    console.error(error);
    alert('Não foi possível carregar as famílias e os cadastros anteriores.');
  }
}
function allPassengers() {
  return state.familiasPrivadas.flatMap((familia) => {
    const base = {
      familiaId: familia.id,
      familiaResponsavel: familia.responsavel?.nome || '',
    };

    return [
      {
        ...base,
        tipo: familia.legacy ? 'CADASTRO ANTERIOR' : 'RESPONSÁVEL',
        nome: familia.responsavel?.nome || '',
        apelido: familia.responsavel?.apelido || '',
        cpf: familia.responsavel?.cpf || '',
        idade: null,
      },
      ...(familia.membros || []).map((membro) => ({
        ...base,
        ...membro,
      })),
    ];
  });
}

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function filteredFamilies() {
  const term = normalizeSearch(state.filtro);
  if (!term) return state.familiasPrivadas;

  return state.familiasPrivadas.filter((familia) => {
    const haystack = [
      familia.responsavel?.nome,
      familia.responsavel?.apelido,
      familia.responsavel?.cpf,
      ...(familia.membros || []).flatMap((m) => [m.nome, m.apelido, m.cpf, m.tipo]),
    ]
      .map((value) => normalizeSearch(value))
      .join(' ');

    return haystack.includes(term) || haystack.includes(digits(term));
  });
}

el.busca.addEventListener('input', () => {
  state.filtro = el.busca.value;
  renderAdminFamilies();
});

function refreshAdmin() {
  const passageiros = state.familiasPrivadas.reduce(
    (sum, familia) => sum + Number(familia.totalPessoas || 0),
    0
  );
  const passagens = state.familiasPrivadas.reduce(
    (sum, familia) => sum + Number(familia.totalPassagens || 0),
    0
  );
  const valor = state.familiasPrivadas.reduce(
    (sum, familia) => sum + Number(familia.valorTotal || 0),
    0
  );

  el.statFamilias.textContent = state.familiasPrivadas.length;
  el.statPassageiros.textContent = passageiros;
  el.statPassagens.textContent = passagens;
  el.statValor.textContent = dinheiro.format(valor);

  renderAdminFamilies();
}

function renderAdminFamilies() {
  const familias = filteredFamilies();
  el.familiasAdmin.innerHTML = '';
  el.adminVazio.classList.toggle('hidden', familias.length > 0);

  familias.forEach((familia) => {
    const passageiros = [
      {
        tipo: familia.legacy ? 'CADASTRO ANTERIOR' : 'RESPONSÁVEL',
        ...familia.responsavel,
      },
      ...(familia.membros || []),
    ];

    const card = document.createElement('article');
    card.className = 'admin-family-card';
    card.innerHTML = `
      <div class="admin-family-head">
        <div>
          <span class="tag">${familia.legacy ? 'CADASTRO ANTERIOR' : 'FAMÍLIA'}</span>
          <h3>${escapeHtml(upperText(familia.responsavel?.nome || ''))}</h3>
          <p>${familia.legacy ? `${Number(familia.totalPassagens || 1)} passagem(ns) no modelo anterior` : `${passageiros.length} ${passageiros.length === 1 ? 'passageiro' : 'passageiros'}`} • ${dinheiro.format(Number(familia.valorTotal || 0))}</p>
        </div>
        <button class="row-action danger" type="button" data-delete-family="${familia.id}">
          Excluir família
        </button>
      </div>

      <div class="table-wrap">
        <table class="admin-passenger-table">
          <thead>
            <tr>
              <th>Vínculo</th>
              <th>Nome completo</th>
              <th>Apelido</th>
              <th>CPF</th>
              <th>Idade</th>
            </tr>
          </thead>
          <tbody>
            ${passageiros.map((p) => `
              <tr>
                <td data-label="Vínculo">${escapeHtml(p.tipo || '—')}</td>
                <td data-label="Nome">${escapeHtml(upperText(p.nome || ''))}</td>
                <td data-label="Apelido">${p.apelido ? escapeHtml(upperText(p.apelido)) : '—'}</td>
                <td data-label="CPF">${p.cpf ? formatCpf(p.cpf) : '—'}</td>
                <td data-label="Idade">${p.idade ?? '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    el.familiasAdmin.appendChild(card);
  });
}

el.familiasAdmin.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-delete-family]');
  if (!button) return;

  const familia = state.familiasPrivadas.find((item) => item.id === button.dataset.deleteFamily);
  if (!familia) return;

  if (!confirm(`Excluir a família de ${familia.responsavel?.nome}?`)) return;

  try {
    const batch = writeBatch(db);

    if (familia.legacy) {
      batch.delete(doc(db, 'inscricoes', familia.id));
      batch.delete(doc(db, 'participantesPublicos', familia.id));
    } else {
      batch.delete(doc(db, 'familias', familia.id));
      batch.delete(doc(db, 'familiasPublicas', familia.id));
    }

    await batch.commit();

    await loadPrivateFamilies();
    await loadPublicFamilies();
  } catch (error) {
    console.error(error);
    alert('Não foi possível excluir a família.');
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
  const passageiros = allPassengers();
  if (!passageiros.length) {
    alert('Não há passageiros para exportar.');
    return;
  }

  const rows = passageiros.map((item, index) => `
    <Row>
      <Cell><Data ss:Type="Number">${index + 1}</Data></Cell>
      <Cell><Data ss:Type="String">${xmlEscape(item.familiaResponsavel)}</Data></Cell>
      <Cell><Data ss:Type="String">${xmlEscape(item.tipo || '')}</Data></Cell>
      <Cell><Data ss:Type="String">${xmlEscape(item.nome || '')}</Data></Cell>
      <Cell><Data ss:Type="String">${xmlEscape(item.apelido || '')}</Data></Cell>
      <Cell><Data ss:Type="String">${item.cpf ? formatCpf(item.cpf) : ''}</Data></Cell>
      <Cell><Data ss:Type="String">${item.idade ?? ''}</Data></Cell>
      <Cell><Data ss:Type="Number">${VALOR_PASSAGEM}</Data></Cell>
    </Row>
  `).join('');

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Passageiros">
  <Table>
   <Row>
    <Cell><Data ss:Type="String">Nº</Data></Cell>
    <Cell><Data ss:Type="String">Família / Responsável</Data></Cell>
    <Cell><Data ss:Type="String">Vínculo</Data></Cell>
    <Cell><Data ss:Type="String">Nome completo</Data></Cell>
    <Cell><Data ss:Type="String">Apelido</Data></Cell>
    <Cell><Data ss:Type="String">CPF</Data></Cell>
    <Cell><Data ss:Type="String">Idade</Data></Cell>
    <Cell><Data ss:Type="String">Passagem</Data></Cell>
   </Row>
   ${rows}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  });

  downloadBlob(blob, 'Mambucaba_2026_Passageiros.xls');
});

el.btnPdf.addEventListener('click', () => {
  const passageiros = allPassengers();
  if (!passageiros.length) {
    alert('Não há passageiros para exportar.');
    return;
  }

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const totalFamilias = state.familiasPrivadas.length;
  const totalPassageiros = passageiros.length;
  const totalValor = totalPassageiros * VALOR_PASSAGEM;

  pdf.setFontSize(18);
  pdf.text('Mambucaba 2026 — Relação de Passageiros', 14, 16);

  pdf.setFontSize(10);
  pdf.text(
    'Evento: 28/11/2026 • Vila Histórica de Mambucaba • Passagem: R$ 90,00',
    14,
    23
  );

  pdf.text(
    `Famílias: ${totalFamilias} | Passageiros: ${totalPassageiros} | Valor total: ${dinheiro.format(totalValor)}`,
    14,
    29
  );

  autoTable(pdf, {
    startY: 34,
    head: [['Nº', 'Família/Responsável', 'Vínculo', 'Nome completo', 'Apelido', 'CPF', 'Idade']],
    body: passageiros.map((item, index) => [
      index + 1,
      item.familiaResponsavel,
      item.tipo || '—',
      item.nome || '',
      item.apelido || '—',
      item.cpf ? formatCpf(item.cpf) : '—',
      item.idade ?? '—',
    ]),
    styles: { fontSize: 7.8 },
  });

  pdf.save('Mambucaba_2026_Passageiros.pdf');
});

el.btnPdfOnibus.addEventListener('click', () => {
  const passageiros = allPassengers();
  if (!passageiros.length) {
    alert('Não há passageiros para exportar.');
    return;
  }

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  pdf.setFontSize(18);
  pdf.text('RELAÇÃO DE PASSAGEIROS — MAMBUCABA 2026', 14, 16);

  pdf.setFontSize(10);
  pdf.text('Data da viagem: 28/11/2026', 14, 23);
  pdf.text('Destino: Vila Histórica de Mambucaba', 14, 29);
  pdf.text(`Total de passageiros: ${passageiros.length}`, 14, 35);

  autoTable(pdf, {
    startY: 41,
    head: [['Nº', 'Família/Responsável', 'Vínculo', 'Nome completo do passageiro', 'CPF', 'Idade']],
    body: passageiros.map((item, index) => [
      index + 1,
      upperText(item.familiaResponsavel || ''),
      item.tipo || '—',
      upperText(item.nome || ''),
      item.cpf ? formatCpf(item.cpf) : '—',
      item.idade ?? '—',
    ]),
    styles: { fontSize: 8 },
  });

  pdf.save('Mambucaba_2026_Relacao_Passageiros_Empresa_Onibus.pdf');
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

renderMembers();
loadPublicFamilies();
