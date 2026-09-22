document.addEventListener('DOMContentLoaded', () => {
  fetchPublicData();
});

async function fetchPublicData() {
  try {
    const res = await fetch('/api/public/data');
    if (!res.ok) throw new Error('Falha ao carregar dados da API');
    const json = await res.json();
    if (json.success && json.data) {
      renderPageData(json.data);
    }
  } catch (err) {
    console.warn('Usando dados estáticos de fallback:', err);
  }
}

function renderPageData(db) {
  // 1. Render Destaque (Flyer Principal)
  if (db.destaque && db.destaque.titulo) {
    const destaqueSection = document.querySelector('main section:first-of-type');
    if (destaqueSection) {
      destaqueSection.innerHTML = `
        <div class="relative w-full aspect-[4/5] rounded-2xl overflow-hidden shadow-lg border border-gray-200 bg-gray-900 group">
            <img src="${db.destaque.imagemUrl}" alt="${db.destaque.titulo}" class="w-full h-full object-cover">
            
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4">
                <span class="bg-red-600 text-white text-xs font-bold uppercase px-3 py-1 rounded-full w-max mb-2 animate-pulse-slow">
                    ${db.destaque.statusBadge || 'Encerrando em breve!'}
                </span>
                <h3 class="text-white font-bold text-2xl leading-tight mb-1 shadow-black drop-shadow-md">${db.destaque.titulo}</h3>
                <p class="text-gray-300 text-sm mb-4">${db.destaque.subtitulo || `Apenas R$ ${db.destaque.precoCota} a cota.`}</p>
                
                <a href="${db.destaque.linkCheckout || '#'}" target="_blank" class="w-full bg-brand-action hover:bg-green-500 text-white font-bold text-lg py-4 rounded-xl shadow-[0_4px_0_0_#14532d] active:shadow-[0_0px_0_0_#14532d] active:translate-y-1 transition-all flex items-center justify-center gap-2">
                    <i class="ph ph-shopping-cart text-2xl"></i>
                    COMPRAR NÚMEROS
                </a>
            </div>
        </div>
      `;
    }
  }

  // 2. Render Ações Ativas
  const tabAtivasContainer = document.querySelector('#tab-ativas .space-y-4');
  if (tabAtivasContainer && db.acoes && db.acoes.length > 0) {
    tabAtivasContainer.innerHTML = db.acoes.map(acao => `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div class="flex p-3 gap-4">
              <div class="w-24 h-24 rounded-xl bg-gray-200 flex-shrink-0 overflow-hidden">
                  <img src="${acao.imagemUrl}" alt="${acao.titulo}" class="w-full h-full object-cover">
              </div>
              <div class="flex flex-col justify-center flex-1">
                  <span class="text-[10px] font-bold text-brand-action uppercase tracking-wider mb-1">${acao.porcentagemVendido}% Vendido</span>
                  <h4 class="font-bold text-gray-900 leading-tight mb-1">${acao.titulo}</h4>
                  <p class="text-xs text-gray-500 mb-2">Por apenas R$ ${acao.precoCota}</p>
                  
                  <div class="w-full bg-gray-100 rounded-full h-2 mb-2">
                      <div class="bg-brand-action h-2 rounded-full" style="width: ${acao.porcentagemVendido}%"></div>
                  </div>
              </div>
          </div>
          <div class="p-3 bg-gray-50 border-t border-gray-100">
              <a href="${acao.linkCheckout || '#'}" target="_blank" class="w-full bg-brand-dark text-white font-bold py-2.5 rounded-lg text-sm shadow flex items-center justify-center gap-2">
                  PARTICIPAR AGORA <i class="ph-bold ph-arrow-right"></i>
              </a>
          </div>
      </div>
    `).join('');
  }

  // 3. Render Ganhadores
  const tabGanhadoresContainer = document.querySelector('#tab-ganhadores .space-y-4');
  if (tabGanhadoresContainer && db.ganhadores && db.ganhadores.length > 0) {
    tabGanhadoresContainer.innerHTML = db.ganhadores.map(g => `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative">
          <div class="absolute top-0 right-0 bg-brand-gold text-white text-xs font-bold px-3 py-1 rounded-bl-xl z-10 flex items-center gap-1">
              <i class="ph-fill ph-star"></i> Entregue
          </div>
          <img src="${g.imagemUrl}" alt="${g.nome}" class="w-full h-48 object-cover">
          <div class="p-4">
              <h4 class="font-bold text-lg text-gray-900">${g.nome} ${g.cidade ? `<span class="text-xs text-gray-500 font-medium">(${g.cidade})</span>` : ''}</h4>
              <p class="text-sm text-gray-600">Ganhador(a) da <span class="font-semibold text-gray-900">${g.premio}</span></p>
              
              <div class="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3 flex justify-between items-center">
                  <div>
                      <p class="text-xs text-gray-500 uppercase font-semibold">Bilhete Sorteado</p>
                      <p class="font-mono text-xl font-bold text-brand-action">${g.bilhete}</p>
                  </div>
                  <div class="text-right">
                      <p class="text-xs text-gray-500 uppercase font-semibold">Data</p>
                      <p class="text-sm font-medium text-gray-800">${g.data}</p>
                  </div>
              </div>
          </div>
      </div>
    `).join('');
  }

  // 4. Render Vídeos / Comprovações
  const tabVideosContainer = document.querySelector('#tab-resultados .space-y-6');
  if (tabVideosContainer && db.videos && db.videos.length > 0) {
    tabVideosContainer.innerHTML = db.videos.map(v => {
      const isMp4 = v.videoUrl && v.videoUrl.toLowerCase().includes('.mp4');
      const mediaHtml = isMp4 ? `
        <div class="aspect-[9/16] bg-black relative flex items-center justify-center">
            <video controls preload="metadata" playsinline class="w-full h-full object-cover">
                <source src="${v.videoUrl}" type="video/mp4">
                Seu navegador não suporta a tag de vídeo.
            </video>
        </div>
      ` : `
        <a href="${v.videoUrl}" target="_blank" class="aspect-[9/16] bg-gray-900 relative flex items-center justify-center block">
            <img src="${v.thumbnailUrl}" alt="${v.titulo}" class="absolute inset-0 w-full h-full object-cover opacity-60">
            <button class="relative z-10 w-16 h-16 bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform">
                <i class="ph-fill ph-play text-2xl"></i>
            </button>
        </a>
      `;

      return `
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            ${mediaHtml}
            <div class="p-4">
                <h4 class="font-bold text-gray-900 leading-tight">${v.titulo}</h4>
                <p class="text-xs text-gray-500 mt-1"><i class="ph ph-calendar"></i> ${v.data}</p>
            </div>
        </div>
      `;
    }).join('');
  }

  // 5. Render Encerradas
  const tabEncerradasContainer = document.querySelector('#tab-passadas .grid');
  if (tabEncerradasContainer && db.encerradas && db.encerradas.length > 0) {
    tabEncerradasContainer.innerHTML = db.encerradas.map(e => `
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden opacity-75">
          <img src="${e.imagemUrl}" alt="${e.titulo}" class="w-full aspect-square object-cover grayscale">
          <div class="p-2 text-center bg-gray-100">
              <span class="bg-gray-800 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Finalizada</span>
              <h4 class="font-semibold text-xs text-gray-800 mt-1 truncate">${e.titulo}</h4>
          </div>
      </div>
    `).join('');
  }

  // 6. Update Contact Links (WhatsApp e Instagram)
  if (db.config) {
    const whatsappBtn = document.querySelector('footer a[href*="wa.me"], div.fixed.bottom-0 a[href*="wa.me"]');
    if (whatsappBtn && db.config.whatsappUrl) {
      whatsappBtn.href = db.config.whatsappUrl;
    }
    const instagramBtn = document.querySelector('footer a[href*="instagram.com"], div.fixed.bottom-0 a[href*="instagram.com"]');
    if (instagramBtn && db.config.instagramUrl) {
      instagramBtn.href = db.config.instagramUrl;
    }
  }
}
