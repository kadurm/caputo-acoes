let authToken = localStorage.getItem('caputo_token');
let uploadedImageUrls = {};
let uploadedVideoUrls = {};

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
    loginOverlay.classList.add('flex');
    loginOverlay.style.setProperty('display', 'flex', 'important');
  }
}

function hideLoginScreen() {
  const loginOverlay = document.getElementById('login-screen');
  if (loginOverlay) {
    loginOverlay.classList.add('hidden');
    loginOverlay.classList.remove('flex');
    loginOverlay.style.setProperty('display', 'none', 'important');
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const errorBox = document.getElementById('login-error');
  const submitBtn = event.target ? event.target.querySelector('button[type="submit"]') : null;

  if (errorBox) {
    errorBox.classList.add('hidden');
    errorBox.textContent = '';
  }

  const originalBtnText = submitBtn ? submitBtn.innerHTML : 'ACESSAR PAINEL ADMIN';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="ph-bold ph-spinner animate-spin text-lg mr-2"></i> Verificando...';
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailInput.value.trim(),
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
        errorBox.textContent = json.message || 'Credenciais inválidas. Verifique e-mail e senha.';
        errorBox.classList.remove('hidden');
      }
      showToast(json.message || 'Falha no login', 'error');
    }
  } catch (err) {
    console.error('Erro ao efetuar login:', err);
    if (errorBox) {
      errorBox.textContent = 'Erro de comunicação com o servidor.';
      errorBox.classList.remove('hidden');
    }
    showToast('Erro de conexão com o servidor.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
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

  // Render Grid: Vídeos (Ordem cronológica: mais novos no topo)
  const videosGrid = document.querySelector('#view-videos .grid');
  if (videosGrid && db.videos) {
    const sortedVideos = sortVideosChronological(db.videos);
    videosGrid.innerHTML = sortedVideos.map(v => {
      const isDirectVideo = v.videoUrl && (
        v.videoUrl.toLowerCase().includes('.mp4') ||
        v.videoUrl.toLowerCase().includes('.webm') ||
        v.videoUrl.toLowerCase().includes('.mov') ||
        v.videoUrl.includes('cloudinary.com') ||
        v.videoUrl.startsWith('data:video/')
      );
      const mediaHtml = isDirectVideo ? `
        <div class="aspect-[9/16] bg-black relative flex items-center justify-center">
            <video controls preload="metadata" playsinline class="w-full h-full object-cover">
                <source src="${v.videoUrl}">
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
      `;
    }).join('');
  }

  // Populate Config Form
  if (db.config) {
    const whatsappInput = document.getElementById('config-whatsapp') || document.querySelector('#view-configuracoes input[type="url"]:first-of-type');
    const instagramInput = document.getElementById('config-instagram') || document.querySelector('#view-configuracoes input[type="url"]:last-of-type');
    const cloudNameInput = document.getElementById('config-cloudinary-cloudname');
    const presetInput = document.getElementById('config-cloudinary-preset');

    if (whatsappInput && db.config.whatsappUrl) whatsappInput.value = db.config.whatsappUrl;
    if (instagramInput && db.config.instagramUrl) instagramInput.value = db.config.instagramUrl;
    if (cloudNameInput && db.config.cloudinaryCloudName) cloudNameInput.value = db.config.cloudinaryCloudName;
    if (presetInput && db.config.cloudinaryUploadPreset) presetInput.value = db.config.cloudinaryUploadPreset;
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

// Upload Video Handler via API or Direct Cloudinary
async function handleVideoUpload(fileInput, formKey) {
  if (!fileInput.files || fileInput.files.length === 0) return;
  const file = fileInput.files[0];
  const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
  const infoEl = document.getElementById('video-upload-info');

  const updateProgress = (percent, statusText) => {
    if (infoEl) {
      infoEl.innerHTML = `
        <div class="w-full mt-1">
          <div class="flex justify-between items-center text-xs text-brand-dark mb-1 font-semibold">
            <span><i class="ph-bold ph-spinner animate-spin"></i> ${statusText || 'Enviando...'}</span>
            <span>${percent}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div class="bg-red-600 h-1.5 rounded-full transition-all duration-300" style="width: ${percent}%"></div>
          </div>
        </div>
      `;
      infoEl.className = "mt-2 text-xs flex flex-col gap-1";
    }
  };

  showToast(`Iniciando envio do vídeo (${sizeMB} MB)...`, 'info');
  updateProgress(10, `Iniciando upload (${sizeMB} MB)...`);

  // 1. Verificar se Cloudinary está configurado para upload direto (Sem limite de 4.5MB da Vercel)
  let signData = null;
  try {
    const signRes = await fetch('/api/upload/sign', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (signRes.ok) {
      signData = await signRes.json();
    }
  } catch (e) {
    console.warn('Verificação de upload direto:', e);
  }

  // 2. Se Cloudinary estiver disponível: Upload Direto do Navegador
  if (signData && signData.success && signData.cloudName) {
    const cloudFormData = new FormData();
    cloudFormData.append('file', file);

    if (signData.type === 'signed') {
      cloudFormData.append('api_key', signData.apiKey);
      cloudFormData.append('timestamp', signData.timestamp);
      cloudFormData.append('signature', signData.signature);
      cloudFormData.append('folder', signData.folder);
    } else if (signData.type === 'unsigned') {
      cloudFormData.append('upload_preset', signData.uploadPreset);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${signData.cloudName}/video/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.min(98, Math.round((e.loaded / e.total) * 98));
        updateProgress(percent, `Enviando para a nuvem (${percent}%)...`);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          uploadedVideoUrls[formKey] = response.secure_url;
          if (infoEl) {
            infoEl.innerHTML = `<i class="ph-fill ph-check-circle text-green-600 text-base"></i> Vídeo pronto: <strong>${file.name}</strong> (${sizeMB} MB)`;
            infoEl.className = "mt-2 text-xs text-green-700 flex items-center gap-1.5 font-medium";
          }
          showToast('Vídeo enviado com sucesso!', 'success');
        } catch (parseErr) {
          handleUploadFallback(file, formKey, sizeMB, infoEl, updateProgress);
        }
      } else {
        console.error('Erro na resposta do Cloudinary:', xhr.responseText);
        handleUploadFallback(file, formKey, sizeMB, infoEl, updateProgress);
      }
    };

    xhr.onerror = () => {
      console.error('Erro de rede no Cloudinary');
      handleUploadFallback(file, formKey, sizeMB, infoEl, updateProgress);
    };

    xhr.send(cloudFormData);
    return;
  }

  // 3. Cloudinary não configurado
  // Se o arquivo tiver mais que 4.5MB, a hospedagem Vercel aborta conexões com erro 413
  if (file.size > 4.5 * 1024 * 1024) {
    if (infoEl) {
      infoEl.innerHTML = `
        <div class="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-900 mt-2">
          <p class="font-bold flex items-center gap-1 mb-1 text-amber-950">
            <i class="ph-bold ph-warning-circle text-base text-amber-600"></i> Arquivo de ${sizeMB} MB excede o limite do servidor (4.5 MB)
          </p>
          <p class="mb-2 leading-relaxed text-amber-900">
            O servidor Vercel limita uploads diretos a 4.5 MB. Opções para este vídeo:
          </p>
          <ul class="list-disc list-inside space-y-1 font-medium text-amber-800">
            <li>Conecte sua conta <strong>Cloudinary</strong> na aba Configurações (grátis até 100MB por vídeo), OU</li>
            <li>Insira o link direto do vídeo (YouTube, Google Drive ou link direto) no campo abaixo, OU</li>
            <li>Reduza a resolução do vídeo no celular/computador para menos de 4.5 MB.</li>
          </ul>
        </div>
      `;
      infoEl.className = "mt-2 text-xs flex flex-col gap-1";
    }
    showToast(`O arquivo tem ${sizeMB} MB (limite da Vercel sem Cloudinary é 4.5 MB).`, 'warning');
    return;
  }

  // Arquivo menor que 4.5MB: upload pelo backend padrão
  handleUploadFallback(file, formKey, sizeMB, infoEl, updateProgress);
}

// Fallback para envio padrão (/api/upload)
async function handleUploadFallback(file, formKey, sizeMB, infoEl, updateProgress) {
  const formData = new FormData();
  formData.append('file', file);

  updateProgress(40, `Enviando vídeo (${sizeMB} MB)...`);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: formData
    });

    if (res.status === 413) {
      if (infoEl) {
        infoEl.innerHTML = `<i class="ph-bold ph-warning-circle text-amber-600 text-base"></i> Arquivo muito grande (${sizeMB} MB). Limite de 4.5 MB atingido. Use um link ou ative o Cloudinary.`;
        infoEl.className = "mt-2 text-xs text-amber-700 flex items-center gap-1.5 font-medium";
      }
      showToast('Arquivo excede o limite permitido pela hospedagem.', 'error');
      return;
    }

    const json = await res.json();
    if (json.success && json.url) {
      uploadedVideoUrls[formKey] = json.url;
      if (infoEl) {
        infoEl.innerHTML = `<i class="ph-fill ph-check-circle text-green-600 text-base"></i> Vídeo pronto: <strong>${file.name}</strong> (${sizeMB} MB)`;
        infoEl.className = "mt-2 text-xs text-green-700 flex items-center gap-1.5 font-medium";
      }
      showToast('Vídeo enviado com sucesso!', 'success');
    } else {
      if (infoEl) {
        infoEl.innerHTML = `<i class="ph-bold ph-warning-circle text-red-600 text-base"></i> Falha: ${json.message || 'Erro no upload'}`;
        infoEl.className = "mt-2 text-xs text-red-600 flex items-center gap-1.5 font-medium";
      }
      showToast(json.message || 'Erro ao enviar vídeo.', 'error');
    }
  } catch (err) {
    console.error('Erro no upload de vídeo:', err);
    if (infoEl) {
      infoEl.innerHTML = `<i class="ph-bold ph-warning-circle text-red-600 text-base"></i> Erro de conexão no upload. Para arquivos grandes, ative o Cloudinary ou use um link externo.`;
      infoEl.className = "mt-2 text-xs text-red-600 flex items-center gap-1.5 font-medium";
    }
    showToast('Falha de conexão ao enviar vídeo.', 'error');
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
  const titulo = form.querySelector('#video-titulo').value.trim();
  const dataInput = form.querySelector('#video-data').value;
  const linkManual = form.querySelector('#video-url-input') ? form.querySelector('#video-url-input').value.trim() : '';
  const finalVideoUrl = uploadedVideoUrls['modal-video'] || linkManual;

  if (!finalVideoUrl) {
    showToast('Por favor, selecione um arquivo de vídeo para envio.', 'error');
    return;
  }

  const payload = {
    titulo: titulo,
    videoUrl: finalVideoUrl,
    data: dataInput ? new Date(dataInput + 'T12:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
    thumbnailUrl: uploadedImageUrls['modal-video'] || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=80'
  };

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Salvar Vídeo';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="ph-bold ph-spinner animate-spin mr-1"></i> Salvando...';
  }

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
      delete uploadedVideoUrls['modal-video'];
      delete uploadedImageUrls['modal-video'];
      const infoEl = document.getElementById('video-upload-info');
      if (infoEl) {
        infoEl.innerHTML = '<i class="ph-bold ph-video-camera text-base text-red-600"></i> Nenhum arquivo selecionado ainda.';
        infoEl.className = "mt-2 text-xs text-gray-500 flex items-center gap-1.5";
      }
      loadAdminData();
    } else {
      showToast(json.message || 'Erro ao salvar vídeo.', 'error');
    }
  } catch (err) {
    showToast('Erro ao salvar vídeo.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
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
  const whatsappInput = document.getElementById('config-whatsapp');
  const instagramInput = document.getElementById('config-instagram');
  const cloudNameInput = document.getElementById('config-cloudinary-cloudname');
  const presetInput = document.getElementById('config-cloudinary-preset');

  const payload = {
    whatsappUrl: whatsappInput ? whatsappInput.value.trim() : '',
    instagramUrl: instagramInput ? instagramInput.value.trim() : '',
    cloudinaryCloudName: cloudNameInput ? cloudNameInput.value.trim() : '',
    cloudinaryUploadPreset: presetInput ? presetInput.value.trim() : ''
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
    } else {
      showToast(json.message || 'Erro ao salvar configurações.', 'error');
    }
  } catch (err) {
    showToast('Erro ao salvar configurações.', 'error');
  }
}

// Helper para converter data BR (DD/MM/YYYY) para timestamp
function parseDateBR(dateStr) {
  if (!dateStr) return 0;
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    return new Date(year, month, day).getTime();
  }
  const timestamp = Date.parse(dateStr);
  return isNaN(timestamp) ? 0 : timestamp;
}

// Ordenar vídeos por ordem cronológica (mais novos no topo)
function sortVideosChronological(videos) {
  if (!Array.isArray(videos)) return [];
  return [...videos].sort((a, b) => {
    const timeA = parseDateBR(a.data);
    const timeB = parseDateBR(b.data);
    if (timeB !== timeA) return timeB - timeA;
    const idA = parseInt((a.id || '').replace(/\D/g, ''), 10) || 0;
    const idB = parseInt((b.id || '').replace(/\D/g, ''), 10) || 0;
    return idB - idA;
  });
}
