/**
 * Database Adapter - Caputo Ações
 * 
 * Suporta três modos com tolerância a falhas:
 * 1. Supabase (Produção / Vercel Serverless): ativado quando SUPABASE_URL e SUPABASE_KEY/SUPABASE_ANON_KEY estão configurados.
 * 2. MongoDB Atlas (Produção / Vercel Serverless): ativado quando MONGODB_URI está configurado.
 * 3. Arquivo Local JSON (Desenvolvimento / Fallback): grava em data/db.json e /tmp/caputo_db.json.
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');

const DB_FILE_PATH = path.join(__dirname, '..', 'data', 'db.json');
const TMP_FILE_PATH = path.join(process.env.TMPDIR || '/tmp', 'caputo_db.json');

// Estrutura padrão limpa sem dados fictícios que possam sobrescrever a interface
const DEFAULT_DATA = {
  destaque: {
    id: 'destaque_1',
    titulo: 'Nova Hilux',
    subtitulo: 'Apenas R$ 0,50 a cota.',
    precoCota: '0,50',
    imagemUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&auto=format&fit=crop&q=80',
    statusBadge: 'Encerrando em breve!',
    linkCheckout: 'https://wa.me/5500000000000',
    porcentagemVendido: 0
  },
  acoes: [],
  encerradas: [],
  ganhadores: [],
  videos: [],
  bilhetesPremiados: [],
  config: {
    whatsappUrl: 'https://wa.me/5500000000000',
    instagramUrl: 'https://instagram.com/caputoacoes',
    cloudinaryCloudName: 'dxeju6d3e',
    cloudinaryUploadPreset: 'caputo_videos'
  },
  analytics: {
    today: '01/10/2026',
    todayViews: 0,
    totalViews: 0,
    history: {}
  },
  financeiro: {
    transacoes: []
  },
  updatedAt: '2020-01-01T00:00:00.000Z'
};

// Cache de conexões para ambiente Serverless (Vercel)
let cachedClient = null;
let cachedDb = null;
let cachedSupabase = null;
let memoryFallback = null;

// --- SUPABASE CLIENT & OPS ---
function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  if (!cachedSupabase) {
    cachedSupabase = createClient(url.trim(), key.trim(), {
      auth: { persistSession: false }
    });
  }
  return cachedSupabase;
}

async function getSupabaseData() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('caputo_data')
      .select('data')
      .eq('id', 'current_state')
      .maybeSingle();

    if (error) {
      console.warn('⚠️ Supabase (leitura):', error.message);
      return null;
    }

    if (data && data.data) {
      return data.data;
    }

    // Se o registro não existe ainda, inicializa com o estado atual
    const initialData = readLocalFile();
    await saveSupabaseData(initialData);
    return initialData;
  } catch (err) {
    console.warn('⚠️ Exceção ao consultar Supabase:', err.message);
    return null;
  }
}

async function saveSupabaseData(appData) {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('caputo_data')
      .upsert({
        id: 'current_state',
        data: appData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) {
      console.error('❌ Erro ao gravar no Supabase:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('❌ Exceção ao salvar no Supabase:', err.message);
    return false;
  }
}

// --- MONGODB CLIENT & OPS ---
async function getMongoDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;

  if (cachedClient && cachedDb) {
    try {
      await cachedDb.command({ ping: 1 });
      return cachedDb;
    } catch (pingErr) {
      console.warn('⚠️ Conexão MongoDB Atlas expirou. Reconectando...');
      cachedClient = null;
      cachedDb = null;
    }
  }

  try {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      maxPoolSize: 10
    });
    await client.connect();
    cachedClient = client;
    cachedDb = client.db(process.env.MONGODB_DB_NAME || 'caputo_acoes');
    console.log('✅ Conectado ao MongoDB Atlas com sucesso.');
    return cachedDb;
  } catch (err) {
    console.error('❌ Erro ao conectar ao MongoDB Atlas:', err.message);
    cachedClient = null;
    cachedDb = null;
    return null;
  }
}

// Leitura com prioridade para dados mais recentes gravados
function readLocalFile() {
  try {
    if (memoryFallback) return memoryFallback;

    // 1. Tentar ler de /tmp (área gravável no ambiente Vercel)
    if (fs.existsSync(TMP_FILE_PATH)) {
      const content = fs.readFileSync(TMP_FILE_PATH, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed) {
        memoryFallback = parsed;
        return parsed;
      }
    }

    // 2. Tentar ler de data/db.json
    if (fs.existsSync(DB_FILE_PATH)) {
      const content = fs.readFileSync(DB_FILE_PATH, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed) {
        memoryFallback = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn('⚠️ Erro ao ler arquivos locais de banco:', err.message);
  }
  return DEFAULT_DATA;
}

// Gravação resiliente em disco/memória
function writeLocalFile(data) {
  memoryFallback = data;
  let success = false;

  // 1. Tentar gravar em data/db.json (funciona em dev / servidores normais)
  try {
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
    success = true;
  } catch (err) {
    // EROFS em ambiente serverless (Vercel)
  }

  // 2. Gravar em /tmp (área temporária permitida na Vercel)
  try {
    fs.writeFileSync(TMP_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
    success = true;
  } catch (err) {
    // Falha silenciosa em /tmp
  }

  return success;
}

function normalizeAppData(data) {
  if (!data) return JSON.parse(JSON.stringify(DEFAULT_DATA));
  data.acoes = data.acoes || [];
  data.encerradas = data.encerradas || [];
  data.ganhadores = data.ganhadores || [];
  data.videos = data.videos || [];
  data.bilhetesPremiados = data.bilhetesPremiados || [];
  data.financeiro = data.financeiro || { transacoes: [] };
  data.financeiro.transacoes = data.financeiro.transacoes || [];
  if (data.destaque && data.destaque.subtitulo) {
    data.destaque.subtitulo = data.destaque.subtitulo.replace(/\.?\s*Sorteio pela Loteria Federal\.?/gi, '').trim();
  }
  if (Array.isArray(data.ganhadores)) {
    data.ganhadores.forEach(g => {
      if (g.bilhete && g.bilhete.toLowerCase().includes('federal')) {
        g.bilhete = 'Cota Contemplada';
      }
    });
  }
  return data;
}

/**
 * Retorna todos os dados da plataforma com suporte a Supabase, MongoDB e Local
 */
async function getAppData() {
  // 1. Prioridade: Supabase
  if (process.env.SUPABASE_URL && (process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    const sbData = await getSupabaseData();
    if (sbData) {
      return normalizeAppData(sbData);
    }
  }

  // 2. Prioridade: MongoDB Atlas
  if (process.env.MONGODB_URI) {
    const db = await getMongoDb();
    if (db) {
      try {
        const collection = db.collection('app_data');
        const doc = await collection.findOne({ _id: 'current_state' });
        if (doc) {
          const { _id, ...cleanData } = doc;
          return normalizeAppData(cleanData);
        }

        const initialData = readLocalFile();
        await collection.updateOne(
          { _id: 'current_state' },
          { $set: { ...initialData, updatedAt: new Date().toISOString() } },
          { upsert: true }
        );
        return normalizeAppData(initialData);
      } catch (err) {
        console.error('❌ Erro ao consultar MongoDB, usando fallback local:', err.message);
        cachedClient = null;
        cachedDb = null;
      }
    }
  }

  // 3. Fallback: Arquivo Local
  return normalizeAppData(readLocalFile());
}

/**
 * Salva os dados atualizados da plataforma em Nuvem e Local
 */
async function saveAppData(data) {
  let savedInCloud = false;
  data.updatedAt = new Date().toISOString();

  // 1. Gravar no Supabase se configurado
  if (process.env.SUPABASE_URL && (process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    const sbOk = await saveSupabaseData(data);
    if (sbOk) savedInCloud = true;
  }

  // 2. Gravar no MongoDB se configurado
  if (process.env.MONGODB_URI) {
    const db = await getMongoDb();
    if (db) {
      try {
        const collection = db.collection('app_data');
        const updatePayload = { ...data };
        delete updatePayload._id;

        await collection.updateOne(
          { _id: 'current_state' },
          { $set: updatePayload },
          { upsert: true }
        );
        savedInCloud = true;
      } catch (err) {
        console.error('❌ Erro ao salvar no MongoDB:', err.message);
        cachedClient = null;
        cachedDb = null;
      }
    }
  }

  const savedLocally = writeLocalFile(data);
  return savedInCloud || savedLocally;
}

/**
 * Informações sobre o status do armazenamento
 */
function getStorageStatus() {
  const hasSupabase = !!(process.env.SUPABASE_URL && (process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
  const hasMongoConfig = !!(process.env.MONGODB_URI && process.env.MONGODB_URI.trim());

  if (hasSupabase) {
    return {
      mode: 'supabase',
      connected: true,
      provider: 'Supabase',
      message: 'Supabase Conectado'
    };
  }

  return {
    mode: hasMongoConfig ? 'mongodb' : 'local',
    connected: hasMongoConfig && !!cachedDb,
    hasMongoConfig: hasMongoConfig,
    provider: hasMongoConfig ? 'MongoDB Atlas' : 'Local',
    message: hasMongoConfig 
      ? (cachedDb ? 'MongoDB Atlas Conectado' : 'Conectando ao MongoDB Atlas...')
      : 'Modo Local'
  };
}

module.exports = {
  getAppData,
  saveAppData,
  writeLocalFile,
  getMongoDb,
  getSupabaseClient,
  getStorageStatus
};
