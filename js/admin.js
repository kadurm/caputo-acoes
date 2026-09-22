let authToken = localStorage.getItem('caputo_token');
let uploadedImageUrls = {};

document.addEventListener('DOMContentLoaded', () => {
  initAdmin();
});

async function initAdmin() {
  authToken = localStorage.getItem('caputo_token');
  if (!authToken) {
    showLoginScreen();
    return;
  }

  try {
    const res = await fetch('/api/auth/verify', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const json = await res.json();
    if (json.success) {
      hideLoginScreen();
      loadAdminData();
    } else {
      showLoginScreen();
    }
  } catch (err) {
    console.error('Erro ao verificar autenticação:', err);
    showLoginScreen();
  }
}

function showLoginScreen() {
  const loginOverlay = document.getElementById('login-screen');
  if (loginOverlay) {
    loginOverlay.classList.remove('hidden');
  }
}

function hideLoginScreen() {
  const loginOverlay = document.getElementById('login-screen');
  if (loginOverlay) {
    loginOverlay.classList.add('hidden');
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const errorBox = document.getElementById('login-error');

  if (errorBox) errorBox.classList.add('hidden');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailInput.value,
        password: passwordInput.value
      })
    });

    const json = await res.json();
    if (json.success && json.token) {
      localStorage.setItem('caputo_token', json.token);
      authToken = json.token;
      showToast('Login realizado com sucesso!', 'success');
      hideLoginScreen();
      loadAdminData();
    } else {
      if (errorBox) {
        errorBox.textContent = json.message || 'Credenciais inválidas.';
        errorBox.classList.remove('hidden');
      }
      showToast(json.message || 'Falha no login', 'error');
    }
  } catch (err) {
    console.error('Erro ao efetuar login:', err);
    showToast('Erro de conexão com o servidor.', 'error');
  }
}

function logoutAdmin() {
  localStorage.removeItem('caputo_token');
  authToken = null;
  showToast('Sessão encerrada com sucesso.', 'info');
  showLoginScreen();
}

async function loadAdminData() {
  try {
    const res = await fetch('/api/public/data');
    const json = await res.json();
    if (json.success && json.data) {
      renderAdminDashboard(json.data);
    }
  } catch (err) {
    console.error('Erro ao carregar dados do painel:', err);
    showToast('Falha ao sincronizar dados do servidor.', 'error');
  }
}

function renderAdminDashboard(db) {
  // Update Stats Cards
  const totalAcoes = (db.acoes ? db.acoes.length : 0) + (db.destaque && db.destaque.titulo ? 1 : 0);
  const totalGanhadores = db.ganhadores ? db.ganhadores.length : 0;
  
  const statAcoes = document.querySelector('#view-dashboard .grid > div:nth-child(1) p.text-3xl');
  if (statAcoes) statAcoes.textContent = totalAcoes;

  const statGanhadores = document.querySelector('#view-dashboard .grid > div:nth-child(3) p.text-3xl');
  if (statGanhadores) statGanhadores.textContent = totalGanhadores;

  // Update Highlight Banner Card in Dashboard
  if (db.destaque && db.destaque.titulo) {
    const highlightCard = document.querySelector('#view-dashboard .bg-white.rounded-2xl .flex.flex-col');
    if (highlightCard) {
      highlightCard.innerHTML = `
        <div class="flex items-center gap-4 w-full sm:w-auto">
            <img src="${db.destaque.imagemUrl}" class="w-16 h-16 rounded-xl object-cover shadow-sm border border-gray-200">
            <div>
                <h4 class="font-bold text-gray-900">${db.destaque.titulo}</h4>
                <p class="text-sm text-gray-600">R$ ${db.destaque.precoCota} a cota • <span class="font-medium text-brand-action">${db.destaque.porcentagemVendido}% Vendido</span></p>
            </div>
        </div>
        <button onclick="switchView('acoes', document.querySelectorAll('.nav-btn')[1])" class="w-full sm:w-auto px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Editar Ação
        </button>
      `;
    }
  }

  // Render Table: Ações
  const acoesTbody = document.querySelector('#view-acoes table tbody');
  if (acoesTbody) {
    let rowsHtml = '';
    
    // Add Destaque if present
    if (db.destaque && db.destaque.titulo) {
      rowsHtml += `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="p-4 w-20">
                <img src="${db.destaque.imagemUrl}" class="w-14 h-14 rounded-xl object-cover shadow-sm">
            </td>
            <td class="p-4">
                <p class="font-bold text-gray-900">${db.destaque.titulo}</p>
                <p class="text-sm text-gray-500">Cota: R$ ${db.destaque.precoCota}</p>
            </td>
            <td class="p-4 w-48">
                <div class="w-full bg-gray-200 rounded-full h-2 mb-1 overflow-hidden">
                    <div class="bg-brand-action h-2 rounded-full" style="width: ${db.destaque.porcentagemVendido}%"></div>
                </div>
                <span class="text-xs font-semibold text-gray-600">${db.destaque.porcentagemVendido}% Vendido</span>
            </td>
            <td class="p-4">
                <span class="px-3 py-1 bg-yellow-100 text-yellow-800 border border-yellow-200 text-xs font-bold rounded-lg flex w-max items-center gap-1">
                    <i class="ph-fill ph-star"></i> Destaque Principal
                </span>
            </td>
            <td class="p-4 text-right">
                <div class="flex justify-end gap-2">
                    <button onclick="deleteAcaoItem('${db.destaque.id}')" class="text-gray-400 hover:text-red-600 bg-white border border-gray-200 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Encerrar/Excluir"><i class="ph ph-trash text-lg"></i></button>
                </div>
            </td>
        </tr>
      `;
    }

    if (db.acoes && db.acoes.length > 0) {
      rowsHtml += db.acoes.map(acao => `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="p-4 w-20">
                <img src="${acao.imagemUrl}" class="w-14 h-14 rounded-xl object-cover shadow-sm">
            </td>
            <td class="p-4">
                <p class="font-bold text-gray-900">${acao.titulo}</p>
                <p class="text-sm text-gray-500">Cota: R$ ${acao.precoCota}</p>
            </td>
            <td class="p-4 w-48">
                <div class="w-full bg-gray-200 rounded-full h-2 mb-1 overflow-hidden">
                    <div class="bg-brand-action h-2 rounded-full" style="width: ${acao.porcentagemVendido}%"></div>
                </div>
                <span class="text-xs font-semibold text-gray-600">${acao.porcentagemVendido}% Vendido</span>
            </td>
            <td class="p-4">
                <span class="px-3 py-1 bg-green-100 text-green-800 border border-green-200 text-xs font-bold rounded-lg flex w-max items-center gap-1">
                    <i class="ph-fill ph-check-circle"></i> ${acao.localExibicao || 'Aba Ativas'}
                </span>
            </td>
            <td class="p-4 text-right">
                <div class="flex justify-end gap-2">
                    <button onclick="deleteAcaoItem('${acao.id}')" class="text-gray-400 hover:text-red-600 bg-white border border-gray-200 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Encerrar/Excluir"><i class="ph ph-trash text-lg"></i></button>
                </div>
            </td>
        </tr>
      `).join('');
    }

    acoesTbody.innerHTML = rowsHtml;
  }

  // Render Grid: Ganhadores
  const ganhadoresGrid = document.querySelector('#view-ganhadores .grid');
  if (ganhadoresGrid && db.ganhadores) {
    ganhadoresGrid.innerHTML = db.ganhadores.map(g => `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative group">
          <div class="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onclick="deleteGanhadorItem('${g.id}')" class="p-2 bg-white/90 backdrop-blur text-red-500 hover:text-red-700 rounded-lg shadow-sm"><i class="ph-bold ph-trash"></i></button>
          </div>
          
          <img src="${g.imagemUrl}" class="w-full h-48 object-cover">
          <div class="p-5">
              <h4 class="font-bold text-lg text-gray-900">${g.nome}</h4>
              <p class="text-sm text-gray-600 mt-1">Prêmio: <span class="font-semibold text-gray-900">${g.premio}</span></p>
              
              <div class="mt-4 bg-gray-50 border border-gray-100 rounded-xl p-3 flex justify-between items-center">
                  <div>
                      <p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Bilhete</p>
                      <p class="font-mono font-bold text-brand-action">${g.bilhete}</p>
                  </div>
                  <div class="text-right">
                      <p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Data</p>
                      <p class="text-sm font-semibold text-gray-700">${g.data}</p>
                  </div>
              </div>
          </div>
      </div>
    `).join('');
  }

  // Render Grid: Vídeos
  const videosGrid = document.querySelector('#view-videos .grid');
  if (videosGrid && db.videos) {
      const isMp4 = v.videoUrl && v.videoUrl.toLowerCase().includes('.mp4');
      const mediaHtml = isMp4 ? `
        <div class="aspect-[9/16] bg-black relative flex items-center justify-center">
            <video controls preload="metadata" playsinline class="w-full h-full object-cover">
                <source src="${v.videoUrl}" type="video/mp4">
            </video>
        </div>
      ` : `
        <a href="${v.videoUrl}" target="_blank" class="aspect-[9/16] bg-gray-900 relative flex items-center justify-center group cursor-pointer block">
            <img src="${v.thumbnailUrl}" class="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-50 transition-opacity">
            <div class="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center relative z-10 shadow-lg">
                <i class="ph-fill ph-play text-white text-xl"></i>
            </div>
        </a>
      `;

      return `
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            ${mediaHtml}
          <div class="p-4">
              <h4 class="font-bold text-gray-900 line-clamp-2 leading-snug">${v.titulo}</h4>
              <div class="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                  <span class="text-xs font-medium text-gray-500">${v.data}</span>
                  <div class="flex gap-2">
                      <button onclick="deleteVideoItem('${v.id}')" class="text-gray-400 hover:text-red-600 p-1 rounded-md transition-colors"><i class="ph-bold ph-trash text-lg"></i></button>
                  </div>
              </div>
          </div>
      </div>
    `).join('');
  }

  // Populate Config Form
  if (db.config) {
    const whatsappInput = document.querySelector('#view-configuracoes input[type="url"]:first-of-type');
    const instagramInput = document.querySelector('#view-configuracoes input[type="url"]:last-of-type');
    if (whatsappInput && db.config.whatsappUrl) whatsappInput.value = db.config.whatsappUrl;
    if (instagramInput && db.config.instagramUrl) instagramInput.value = db.config.instagramUrl;
  }
}

// Upload Image Handler via API (/api/upload)
async function handleFileUpload(fileInput, formKey) {
  if (!fileInput.files || fileInput.files.length === 0) return;
  const file = fileInput.files[0];

  const formData = new FormData();
  formData.append('file', file);

  showToast('Enviando imagem...', 'info');

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: formData
    });

    const json = await res.json();
    if (json.success && json.url) {
      uploadedImageUrls[formKey] = json.url;
      showToast('Imagem carregada com sucesso!', 'success');
    } else {
      showToast('Erro ao enviar imagem.', 'error');
    }
  } catch (err) {
    console.error('Erro no upload de imagem:', err);
    showToast('Falha no upload da imagem.', 'error');
  }
}

// API CRUD Call: Create Nova Ação
async function submitNovaAcao(event) {
  event.preventDefault();
  const form = event.target;
  
  const payload = {
    titulo: form.querySelector('input[placeholder*="HILUX"]').value,
    precoCota: form.querySelector('input[placeholder="0,50"]').value,
    localExibicao: form.querySelector('select').value,
    linkCheckout: form.querySelector('input[type="url"]').value,
    imagemUrl: uploadedImageUrls['modal-acao'] || 'https://placehold.co/400x500/111827/ca8a04?text=FOTO+AÇÃO',
    porcentagemVendido: 0
  };

  try {
    const res = await fetch('/api/acoes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      showToast('Ação cadastrada com sucesso!', 'success');
      closeModal();
      form.reset();
      delete uploadedImageUrls['modal-acao'];
      loadAdminData();
    } else {
      showToast(json.message || 'Erro ao cadastrar ação.', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Erro ao conectar com a API.', 'error');
  }
}

// API CRUD Call: Delete Ação
async function deleteAcaoItem(id) {
  if (!confirm('Deseja realmente excluir esta ação?')) return;
  try {
    const res = await fetch(`/api/acoes/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const json = await res.json();
    if (json.success) {
      showToast('Ação removida.', 'success');
      loadAdminData();
    }
  } catch (err) {
    showToast('Erro ao remover ação.', 'error');
  }
}

// API CRUD Call: Create Ganhador
async function submitNovoGanhador(event) {
  event.preventDefault();
  const form = event.target;
  const inputs = form.querySelectorAll('input');

  const payload = {
    nome: inputs[1].value,
    premio: inputs[2].value,
    bilhete: inputs[3].value,
    data: inputs[4].value ? new Date(inputs[4].value).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
    imagemUrl: uploadedImageUrls['modal-ganhador'] || 'https://placehold.co/600x400/222/ca8a04?text=GANHADOR'
  };

  try {
    const res = await fetch('/api/ganhadores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      showToast('Ganhador cadastrado com sucesso!', 'success');
      closeModal();
      form.reset();
      delete uploadedImageUrls['modal-ganhador'];
      loadAdminData();
    }
  } catch (err) {
    showToast('Erro ao registrar ganhador.', 'error');
  }
}

// API CRUD Call: Delete Ganhador
async function deleteGanhadorItem(id) {
  if (!confirm('Deseja remover este ganhador?')) return;
  try {
    const res = await fetch(`/api/ganhadores/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const json = await res.json();
    if (json.success) {
      showToast('Ganhador removido.', 'success');
      loadAdminData();
    }
  } catch (err) {
    showToast('Erro ao excluir ganhador.', 'error');
  }
}

// API CRUD Call: Create Vídeo
async function submitNovoVideo(event) {
  event.preventDefault();
  const form = event.target;
  const inputs = form.querySelectorAll('input');

  const payload = {
    titulo: inputs[0].value,
    videoUrl: inputs[1].value,
    data: inputs[2].value ? new Date(inputs[2].value).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
    thumbnailUrl: uploadedImageUrls['modal-video'] || 'https://placehold.co/800x450/111/fff?text=VIDEO'
  };

  try {
    const res = await fetch('/api/videos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      showToast('Vídeo adicionado com sucesso!', 'success');
      closeModal();
      form.reset();
      delete uploadedImageUrls['modal-video'];
      loadAdminData();
    }
  } catch (err) {
    showToast('Erro ao salvar vídeo.', 'error');
  }
}

// API CRUD Call: Delete Vídeo
async function deleteVideoItem(id) {
  if (!confirm('Deseja remover este vídeo?')) return;
  try {
    const res = await fetch(`/api/videos/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const json = await res.json();
    if (json.success) {
      showToast('Vídeo removido.', 'success');
      loadAdminData();
    }
  } catch (err) {
    showToast('Erro ao excluir vídeo.', 'error');
  }
}

// API CRUD Call: Configurações
async function submitConfiguracoes(event) {
  event.preventDefault();
  const form = event.target;
  const inputs = form.querySelectorAll('input[type="url"]');

  const payload = {
    whatsappUrl: inputs[0].value,
    instagramUrl: inputs[1].value
  };

  try {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      showToast('Configurações salvas com sucesso!', 'success');
      loadAdminData();
    }
  } catch (err) {
    showToast('Erro ao salvar configurações.', 'error');
  }
}
