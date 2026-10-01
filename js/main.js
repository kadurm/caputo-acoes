// Hidratação síncrona imediata a partir do cache local para eliminar atraso (0ms)
(function hydrateFromCacheImmediately() {
  try {
    const cached = localStorage.getItem('caputo_app_data');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed) {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => {
            renderPageData(parsed);
          }, { once: true });
        } else {
          renderPageData(parsed);
        }
      }
    }
  } catch (e) {}
})();

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
    const res = await fetch(`/api/public/data?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
    });
    if (!res.ok) throw new Error('Falha ao carregar dados da API');
    const json = await res.json();
    if (json.success && json.data) {
      let finalData = json.data;
      // Proteger edições customizadas contra fallbacks padrão ou servidor stale
      const cachedRaw = localStorage.getItem('caputo_app_data');
      if (cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw);
          const cachedTime = cached.updatedAt ? new Date(cached.updatedAt).getTime() : 0;
          const serverTime = finalData.updatedAt ? new Date(finalData.updatedAt).getTime() : 0;

          const serverHasDefaultDestaque = (!finalData.destaque || !finalData.destaque.titulo || finalData.destaque.titulo === 'Ação Principal');
          const cacheHasCustomDestaque = (cached.destaque && cached.destaque.titulo && cached.destaque.titulo !== 'Ação Principal');

          if (cachedTime > serverTime || (serverHasDefaultDestaque && cacheHasCustomDestaque)) {
            finalData = {
              ...finalData,
              ...cached,
              destaque: cached.destaque || finalData.destaque,
              acoes: (cached.acoes && cached.acoes.length > 0) ? cached.acoes : finalData.acoes,
              config: { ...(finalData.config || {}), ...(cached.config || {}) },
              updatedAt: cached.updatedAt || new Date().toISOString()
            };
          } else {
            if (cached && cached.config && cached.config.whatsappUrl && !cached.config.whatsappUrl.includes('5500000000000')) {
              if (!finalData.config || !finalData.config.whatsappUrl || finalData.config.whatsappUrl.includes('5500000000000')) {
                finalData.config = finalData.config || {};
                finalData.config.whatsappUrl = cached.config.whatsappUrl;
              }
            }
          }
        } catch (e) {}
      }
      try {
        localStorage.setItem('caputo_app_data', JSON.stringify(finalData));
      } catch (storageErr) {}
      renderPageData(finalData);
    }
  } catch (err) {
    console.warn('Usando dados estáticos de fallback/cache:', err);
  }
}

function renderPageData(db) {
  // Salvar no cache local para carregamento instantâneo
  try {
    localStorage.setItem('caputo_app_data', JSON.stringify(db));
  } catch (e) {}

  // WhatsApp definido em Configurações para compras, participação e atendimento
  const whatsappSuporte = (db.config && db.config.whatsappUrl && db.config.whatsappUrl.trim())
    ? db.config.whatsappUrl.trim()
    : 'https://wa.me/5500000000000';

  // Helper para vincular o WhatsApp oficial das configurações a todos os botões de ação
  function getWhatsAppActionLink(acao, fallbackWhatsapp, actionTitle) {
    if (acao && acao.linkCheckout && acao.linkCheckout.trim() &&
        !acao.linkCheckout.includes('5500000000000') &&
        !acao.linkCheckout.includes('wa.me') &&
        !acao.linkCheckout.includes('whatsapp.com')) {
      return acao.linkCheckout.trim();
    }
    const baseLink = fallbackWhatsapp || 'https://wa.me/5500000000000';
    if (actionTitle && baseLink.includes('wa.me') && !baseLink.includes('text=')) {
      const sep = baseLink.includes('?') ? '&' : '?';
      return `${baseLink}${sep}text=${encodeURIComponent(`Olá! Quero participar da ação: ${actionTitle}`)}`;
    }
    return baseLink;
  }

// Imagens padrão de alta resolução e confiabilidade para fallback caso URLs quebrem
const DEFAULT_DESTAQUE_IMG = 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&auto=format&fit=crop&q=80';
const DEFAULT_CARD_IMG = 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400&auto=format&fit=crop&q=80';

  // 1. Render Destaque (Flyer Principal) - Botão COMPRAR NÚMEROS
  const destaqueSection = document.getElementById('destaque-section') || document.querySelector('main section:first-of-type');
  if (db.destaque && db.destaque.titulo) {
    const linkComprar = getWhatsAppActionLink(db.destaque, whatsappSuporte, db.destaque.titulo);
    const subtituloLimpo = (db.destaque.subtitulo || `Apenas R$ ${db.destaque.precoCota} a cota.`)
      .replace(/\.?\s*Sorteio pela Loteria Federal\.?/gi, '')
      .replace(/\.?\s*Loteria Federal\.?/gi, '')
      .trim();
    const imgSrcDestaque = (db.destaque.imagemUrl && db.destaque.imagemUrl.trim()) ? db.destaque.imagemUrl.trim() : DEFAULT_DESTAQUE_IMG;

    if (destaqueSection) {
      destaqueSection.innerHTML = `
        <div id="destaque-container" class="relative w-full aspect-[4/5] rounded-2xl overflow-hidden shadow-lg border border-gray-200 bg-gray-900 group">
            <img src="${imgSrcDestaque}" alt="${db.destaque.titulo}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='${DEFAULT_DESTAQUE_IMG}';">
            
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4">
                <span class="bg-red-600 text-white text-xs font-bold uppercase px-3 py-1 rounded-full w-max mb-2 animate-pulse-slow">
                    ${db.destaque.statusBadge || 'Encerrando em breve!'}
                </span>
                <h3 class="text-white font-bold text-2xl leading-tight mb-1 shadow-black drop-shadow-md">${db.destaque.titulo}</h3>
                <p class="text-gray-300 text-sm mb-4">${subtituloLimpo || `Apenas R$ ${db.destaque.precoCota} a cota.`}</p>
                
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
      btnComprar.href = getWhatsAppActionLink(null, whatsappSuporte, 'Ação Principal');
    }
  }

  // 2. Render Ações Ativas - Botão PARTICIPAR AGORA
  const todasAcoes = db.acoes || [];
  const acoesAtivas = todasAcoes.filter(a => a.localExibicao !== 'Aba: Relâmpago' && a.localExibicao !== 'Aba: Encerradas');
  const tabAtivasContainer = document.getElementById('lista-acoes-ativas') || document.querySelector('#tab-ativas .space-y-4');
  
  if (tabAtivasContainer) {
    if (acoesAtivas.length > 0) {
      tabAtivasContainer.innerHTML = acoesAtivas.map(acao => {
        const linkAcao = getWhatsAppActionLink(acao, whatsappSuporte, acao.titulo);
        const imgSrc = (acao.imagemUrl && acao.imagemUrl.trim()) ? acao.imagemUrl.trim() : DEFAULT_CARD_IMG;

        return `
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div class="flex p-3 gap-4">
                <div class="w-24 h-24 rounded-xl bg-gray-200 flex-shrink-0 overflow-hidden">
                    <img src="${imgSrc}" alt="${acao.titulo}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='${DEFAULT_CARD_IMG}';">
                </div>
                <div class="flex flex-col justify-center flex-1">
                    <span class="text-[10px] font-bold text-green-700 uppercase tracking-wider mb-1">Cotas Disponíveis</span>
                    <h4 class="font-bold text-gray-900 leading-tight mb-1">${acao.titulo}</h4>
                    <p class="text-xs text-gray-500 mb-2">Por apenas R$ ${acao.precoCota}</p>
                </div>
            </div>
            <div class="p-3 bg-gray-50 border-t border-gray-100">
                <a href="${linkAcao}" target="_blank" class="w-full bg-brand-dark hover:bg-black text-white font-bold py-2.5 rounded-lg text-sm shadow flex items-center justify-center gap-2 transition-colors">
                    PARTICIPAR AGORA <i class="ph-bold ph-arrow-right"></i>
                </a>
            </div>
        </div>
      `;
      }).join('');
    } else {
      tabAtivasContainer.innerHTML = `
        <div class="bg-white rounded-2xl p-8 text-center border border-gray-200 shadow-sm">
            <p class="text-sm text-gray-500">Nenhuma ação disponível no momento.</p>
        </div>
      `;
    }
  }

  // 3. Render Ações Relâmpago (Bilhetes Premiados) - Botão GARANTIR NÚMEROS
  const acoesRelampago = [
    ...(db.relampagos || []),
    ...todasAcoes.filter(a => a.localExibicao === 'Aba: Relâmpago')
  ];
  const tabRelampagoContainer = document.getElementById('lista-acoes-relampago');

  if (tabRelampagoContainer) {
    if (acoesRelampago.length > 0) {
      tabRelampagoContainer.innerHTML = acoesRelampago.map(acao => {
        const linkAcao = getWhatsAppActionLink(acao, whatsappSuporte, acao.titulo);
        const imgSrcRelampago = (acao.imagemUrl && acao.imagemUrl.trim()) ? acao.imagemUrl.trim() : DEFAULT_CARD_IMG;

        const tagVinculada = acao.acaoVinculada
          ? `<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md mt-1 mb-2 border border-amber-200/50">
               <i class="ph-bold ph-link text-xs text-amber-700"></i> ${acao.acaoVinculada}
             </span>`
          : `<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md mt-1 mb-2 border border-amber-200/50">
               <i class="ph-fill ph-lightning text-xs text-amber-600"></i> Resultado Rápido
             </span>`;

        return `
        <div class="bg-white rounded-2xl shadow-sm border border-amber-200/70 overflow-hidden hover:shadow-md transition-shadow">
            <div class="flex p-3 gap-4">
                <div class="w-24 h-24 rounded-xl bg-amber-50 flex-shrink-0 overflow-hidden border border-amber-100">
                    <img src="${imgSrcRelampago}" alt="${acao.titulo}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='${DEFAULT_CARD_IMG}';">
                </div>
                <div class="flex flex-col justify-center flex-1">
                    <div class="flex items-center gap-1.5 mb-0.5">
                        <span class="bg-amber-500 text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full flex items-center gap-0.5">
                            <i class="ph-fill ph-lightning"></i> Relâmpago
                        </span>
                    </div>
                    <h4 class="font-bold text-gray-900 leading-tight mb-0.5">${acao.titulo}</h4>
                    ${tagVinculada}
                    <p class="text-xs font-bold text-gray-700">Cota: R$ ${acao.precoCota}</p>
                </div>
            </div>
            <div class="p-3 bg-amber-50/40 border-t border-amber-100 flex gap-2">
                <a href="${linkAcao}" target="_blank" class="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl text-sm shadow-md flex items-center justify-center gap-2 transition-colors">
                    <i class="ph-fill ph-lightning text-lg"></i> GARANTIR NÚMEROS
                </a>
            </div>
        </div>
      `;
      }).join('');
    } else {
      tabRelampagoContainer.innerHTML = `
        <div class="bg-white rounded-2xl p-8 text-center border border-gray-200 shadow-sm">
            <div class="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-3 text-2xl">
                <i class="ph-fill ph-lightning"></i>
            </div>
            <h4 class="font-bold text-gray-800 text-base mb-1">Nenhuma Ação Relâmpago ativa no momento</h4>
            <p class="text-xs text-gray-500 max-w-xs mx-auto">Novas ações relâmpago e bilhetes premiados são lançados a qualquer momento. Acompanhe nossas redes!</p>
        </div>
      `;
    }
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

  // 5. Update Contact Links (WhatsApp e Instagram)
  if (db.config) {
    const whatsappBtn = document.getElementById('btn-contato-whatsapp') || document.querySelector('a[href*="wa.me"]');
    if (whatsappBtn && db.config.whatsappUrl) {
      whatsappBtn.href = db.config.whatsappUrl.trim();
    }
    const instagramBtn = document.getElementById('btn-contato-instagram') || document.querySelector('a[href*="instagram.com"]');
    if (instagramBtn && db.config.instagramUrl) {
      instagramBtn.href = db.config.instagramUrl.trim();
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
