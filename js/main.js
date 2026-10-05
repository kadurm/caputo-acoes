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

function isDefaultFactoryImage(url) {
  if (!url || typeof url !== 'string') return true;
  const lower = url.toLowerCase().trim();
  return lower.includes('images.unsplash.com') || lower.includes('placehold.co') || lower === '';
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
      const finalData = json.data;
      // Salva os dados oficiais do servidor no cache local para futuras visitas rápidas
      try {
        localStorage.setItem('caputo_app_data', JSON.stringify(finalData));
      } catch (storageErr) {}
      // Renderiza os dados oficiais recebidos do servidor
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

  // 3. Render Ações Relâmpago - Botão GARANTIR NÚMEROS
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
                    <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md mt-1 mb-2 border border-amber-200/50 w-max">
                        <i class="ph-fill ph-lightning text-xs text-amber-600"></i> Poucos Números • Sorteio Rápido
                    </span>
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
            <p class="text-xs text-gray-500 max-w-xs mx-auto">Novas ações relâmpago são lançadas a qualquer momento. Fique atento para garantir seus números!</p>
        </div>
      `;
    }
  }

  // 4. Render Bilhetes Premiados (Categorizados/separados por cada campanha ativa no momento)
  const tabBilhetesContainer = document.getElementById('lista-bilhetes-premiados');
  if (tabBilhetesContainer) {
    const todosBilhetes = db.bilhetesPremiados || [];
    // Filtrar bilhetes disponíveis (ou sem status definido)
    const bilhetesDisponiveis = todosBilhetes.filter(b => b.status === 'disponivel' || !b.status);

    // Mapear campanhas ativas no momento (sem duplicidade entre destaque e acoes)
    const campanhasAtivas = [];
    const titulosVistos = new Map(); // tituloNormalizado -> indice em campanhasAtivas
    const idsVistos = new Map();

    if (db.destaque && db.destaque.titulo) {
      const titNorm = db.destaque.titulo.trim().toLowerCase();
      const idNorm = db.destaque.id || 'destaque_1';
      const cDestaque = {
        id: idNorm,
        titulo: db.destaque.titulo,
        precoCota: db.destaque.precoCota,
        imagemUrl: db.destaque.imagemUrl,
        linkCheckout: db.destaque.linkCheckout,
        tipo: 'Destaque Principal',
        allIds: [idNorm]
      };
      campanhasAtivas.push(cDestaque);
      titulosVistos.set(titNorm, 0);
      idsVistos.set(idNorm, 0);
    }

    if (Array.isArray(db.acoes)) {
      db.acoes.forEach(a => {
        if (a.localExibicao !== 'Aba: Encerradas' && a.status !== 'encerrada') {
          const titNorm = a.titulo ? a.titulo.trim().toLowerCase() : '';
          const idNorm = a.id || '';

          // Se já existe campanha cadastrada com o mesmo título (ex: Destaque Principal é a mesma ação ativa)
          if (titNorm && titulosVistos.has(titNorm)) {
            const idx = titulosVistos.get(titNorm);
            const existente = campanhasAtivas[idx];
            if (idNorm && !existente.allIds.includes(idNorm)) {
              existente.allIds.push(idNorm);
              idsVistos.set(idNorm, idx);
            }
            if (!existente.imagemUrl && a.imagemUrl) existente.imagemUrl = a.imagemUrl;
            if (!existente.linkCheckout && a.linkCheckout) existente.linkCheckout = a.linkCheckout;
            if (!existente.precoCota && a.precoCota) existente.precoCota = a.precoCota;
            return;
          }

          if (idNorm && idsVistos.has(idNorm)) {
            return;
          }

          const novaCampanha = {
            id: a.id,
            titulo: a.titulo,
            precoCota: a.precoCota,
            imagemUrl: a.imagemUrl,
            linkCheckout: a.linkCheckout,
            tipo: a.localExibicao === 'Aba: Relâmpago' ? 'Ação Relâmpago' : 'Ação Ativa',
            allIds: [a.id]
          };
          campanhasAtivas.push(novaCampanha);
          const novoIdx = campanhasAtivas.length - 1;
          if (titNorm) titulosVistos.set(titNorm, novoIdx);
          if (idNorm) idsVistos.set(idNorm, novoIdx);
        }
      });
    }

    // Agrupar bilhetes disponíveis por campanha ativa garantindo que nenhum bilhete seja duplicado
    const gruposPorCampanha = [];
    const bilhetesProcessados = new Set();

    campanhasAtivas.forEach(campanha => {
      const bilhetesDaCampanha = bilhetesDisponiveis.filter(b => {
        const uniqueKey = b.id || `${b.numero}_${b.acaoId || b.acaoTitulo}`;
        if (bilhetesProcessados.has(uniqueKey)) return false;

        const matchId = b.acaoId && (campanha.id === b.acaoId || (campanha.allIds && campanha.allIds.includes(b.acaoId)));
        const matchTitulo = b.acaoTitulo && campanha.titulo && (b.acaoTitulo.toLowerCase().trim() === campanha.titulo.toLowerCase().trim());

        if (matchId || matchTitulo) {
          bilhetesProcessados.add(uniqueKey);
          return true;
        }
        return false;
      });

      if (bilhetesDaCampanha.length > 0) {
        gruposPorCampanha.push({
          campanha,
          bilhetes: bilhetesDaCampanha
        });
      }
    });

    // Se houver bilhetes disponíveis restantes (ex: ação com título diferente das ativas)
    const bilhetesRestantes = bilhetesDisponiveis.filter(b => {
      const uniqueKey = b.id || `${b.numero}_${b.acaoId || b.acaoTitulo}`;
      return !bilhetesProcessados.has(uniqueKey);
    });

    if (bilhetesRestantes.length > 0) {
      const mapaRestantes = new Map();
      bilhetesRestantes.forEach(b => {
        const tituloAcao = b.acaoTitulo || 'Ação em Andamento';
        if (!mapaRestantes.has(tituloAcao)) {
          mapaRestantes.set(tituloAcao, []);
        }
        mapaRestantes.get(tituloAcao).push(b);
      });

      mapaRestantes.forEach((bilhetesLista, tituloAcao) => {
        gruposPorCampanha.push({
          campanha: {
            id: 'geral_' + Math.random().toString(36).substring(2, 6),
            titulo: tituloAcao,
            precoCota: '',
            imagemUrl: DEFAULT_CARD_IMG,
            linkCheckout: whatsappSuporte,
            tipo: 'Ação Ativa'
          },
          bilhetes: bilhetesLista
        });
      });
    }

    if (gruposPorCampanha.length > 0) {
      tabBilhetesContainer.innerHTML = gruposPorCampanha.map(({ campanha, bilhetes }) => {
        const linkAcao = getWhatsAppActionLink(campanha, whatsappSuporte, campanha.titulo);
        const imgSrc = (campanha.imagemUrl && campanha.imagemUrl.trim()) ? campanha.imagemUrl.trim() : DEFAULT_CARD_IMG;

        return `
          <div class="bg-white rounded-2xl shadow-sm border border-emerald-200/70 overflow-hidden hover:shadow-md transition-shadow">
              <!-- Cabeçalho da Campanha Ativa -->
              <div class="p-4 bg-gradient-to-r from-emerald-50/70 via-gray-50 to-white border-b border-emerald-100 flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3">
                      <div class="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden border border-gray-200 flex-shrink-0">
                          <img src="${imgSrc}" alt="${escapeHtml(campanha.titulo)}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='${DEFAULT_CARD_IMG}';">
                      </div>
                      <div>
                          <span class="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-emerald-200 inline-flex items-center gap-1">
                              <i class="ph-fill ph-ticket"></i> ${escapeHtml(campanha.tipo || 'Ação Ativa')}
                          </span>
                          <h4 class="font-bold text-gray-900 text-sm sm:text-base leading-snug mt-0.5">${escapeHtml(campanha.titulo)}</h4>
                          ${campanha.precoCota ? `<p class="text-xs text-gray-500">Cota: apenas R$ ${campanha.precoCota}</p>` : ''}
                      </div>
                  </div>
                  <a href="${linkAcao}" target="_blank" class="flex-shrink-0 bg-brand-dark hover:bg-black text-white text-xs font-bold px-3 py-2 rounded-xl shadow-sm flex items-center gap-1 transition-transform active:scale-95">
                      <span>Participar</span> <i class="ph-bold ph-arrow-right"></i>
                  </a>
              </div>

              <!-- Lista de Bilhetes Disponíveis -->
              <div class="p-4 space-y-2.5">
                  <div class="flex items-center justify-between text-[11px] text-gray-500 font-bold uppercase tracking-wider px-1">
                      <span>Número Premiado</span>
                      <span>Prêmio Instantâneo</span>
                  </div>

                  <div class="grid grid-cols-1 gap-2.5">
                      ${bilhetes.map(b => `
                          <div class="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-emerald-50/60 to-white border border-emerald-200/80 hover:border-emerald-300 transition-colors shadow-xs">
                              <div class="flex items-center gap-3">
                                  <div class="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-sm shadow-emerald-600/30">
                                      <i class="ph-fill ph-ticket"></i>
                                  </div>
                                  <div>
                                      <span class="font-mono text-lg font-black tracking-wider text-emerald-950">${escapeHtml(b.numero)}</span>
                                      <div class="flex items-center gap-1 mt-0.5">
                                          <span class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.2 rounded-full">
                                              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Disponível
                                          </span>
                                      </div>
                                  </div>
                              </div>
                              <div class="text-right">
                                  <span class="inline-block bg-white border border-emerald-200 px-3 py-1.5 rounded-xl font-extrabold text-sm text-emerald-800 shadow-xs">
                                      ${escapeHtml(b.premio)}
                                  </span>
                              </div>
                          </div>
                      `).join('')}
                  </div>
              </div>

              <!-- Rodapé da Campanha: Chamada para Ação -->
              <div class="p-3 bg-emerald-50/30 border-t border-emerald-100/70 flex items-center justify-between gap-3 text-xs">
                  <span class="text-gray-600 flex items-center gap-1 font-medium">
                      <i class="ph-fill ph-sparkle text-amber-500"></i> ${bilhetes.length} bilhete${bilhetes.length === 1 ? '' : 's'} disponível${bilhetes.length === 1 ? '' : 'is'}
                  </span>
                  <a href="${linkAcao}" target="_blank" class="font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1">
                      Garantir cotas desta ação <i class="ph-bold ph-caret-right"></i>
                  </a>
              </div>
          </div>
        `;
      }).join('');
    } else {
      tabBilhetesContainer.innerHTML = `
        <div class="bg-white rounded-2xl p-8 text-center border border-gray-200 shadow-sm">
            <div class="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 text-2xl">
                <i class="ph-fill ph-ticket"></i>
            </div>
            <h4 class="font-bold text-gray-800 text-base mb-1">Nenhum Bilhete Premiado disponível no momento</h4>
            <p class="text-xs text-gray-500 max-w-xs mx-auto">Novos números e prêmios instantâneos são liberados com frequência. Fique atento às nossas ações ativas!</p>
        </div>
      `;
    }
  }

  // 5. Render Vídeos / Comprovações (Ordem cronológica: mais novos no topo)
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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
