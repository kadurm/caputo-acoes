document.addEventListener('DOMContentLoaded', () => {
  fetchPublicData();
  recordPageView();
});

async function recordPageView() {
  try {
    await fetch('/api/analytics/pageview', { method: 'POST' });
  } catch (err) {
    // Falha silenciosa para analytics
  }
}

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
  // WhatsApp definido para suporte e atendimento (mesmo número para compra de números)
  const whatsappSuporte = (db.config && db.config.whatsappUrl && db.config.whatsappUrl.trim())
    ? db.config.whatsappUrl.trim()
    : 'https://wa.me/5500000000000';

  // 1. Render Destaque (Flyer Principal)
  if (db.destaque && db.destaque.titulo) {
    const destaqueSection = document.querySelector('main section:first-of-type');
    // Em 'Comprar números' o botão redireciona para o número do WhatsApp definido para suporte
    const linkComprar = (db.destaque.linkCheckout && !db.destaque.linkCheckout.includes('5500000000000'))
      ? db.destaque.linkCheckout.trim()
      : whatsappSuporte;

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
                
                <a id="btn-comprar-destaque" href="${linkComprar}" target="_blank" class="w-full bg-brand-action hover:bg-green-500 text-white font-bold text-lg py-4 rounded-xl shadow-[0_4px_0_0_#14532d] active:shadow-[0_0px_0_0_#14532d] active:translate-y-1 transition-all flex items-center justify-center gap-2">
                    <i class="ph ph-shopping-cart text-2xl"></i>
                    COMPRAR NÚMEROS
                </a>
            </div>
        </div>
      `;
    }
  } else {
    // Fallback: se não renderizar destaque via JS, atualizar o botão existente
    const btnComprar = document.getElementById('btn-comprar-destaque');
    if (btnComprar && whatsappSuporte) {
      btnComprar.href = whatsappSuporte;
    }
  }

  // 2. Render Ações Ativas
  const tabAtivasContainer = document.querySelector('#tab-ativas .space-y-4');
  if (tabAtivasContainer && db.acoes && db.acoes.length > 0) {
    tabAtivasContainer.innerHTML = db.acoes.map(acao => {
      const linkAcao = (acao.linkCheckout && !acao.linkCheckout.includes('5500000000000'))
        ? acao.linkCheckout.trim()
        : whatsappSuporte;

      return `
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
              <a href="${linkAcao}" target="_blank" class="w-full bg-brand-dark text-white font-bold py-2.5 rounded-lg text-sm shadow flex items-center justify-center gap-2">
                  PARTICIPAR AGORA <i class="ph-bold ph-arrow-right"></i>
              </a>
          </div>
      </div>
    `;
    }).join('');
  }



  // 4. Render Vídeos / Comprovações (Ordem cronológica: mais novos no topo)
  const tabVideosContainer = document.querySelector('#tab-resultados .space-y-6');
  if (tabVideosContainer && db.videos && db.videos.length > 0) {
    const sortedVideos = sortVideosChronological(db.videos);
    tabVideosContainer.innerHTML = sortedVideos.map(v => {
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
