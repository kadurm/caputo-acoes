/**
 * Database Adapter - Caputo Ações
 * 
 * Suporta dois modos com tolerância a falhas:
 * 1. MongoDB Atlas (Produção / Vercel Serverless): ativado quando MONGODB_URI está configurado.
 * 2. Arquivo Local JSON (Desenvolvimento / Local): grava em data/db.json e /tmp/caputo_db.json.
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

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
  updatedAt: new Date().toISOString()
};

// Cache de conexão para ambiente Serverless (Vercel)
let cachedClient = null;
let cachedDb = null;
let memoryFallback = null;

async function getMongoDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;

  if (cachedClient && cachedDb) {
    try {
      // Testar saúde da conexão antes de reutilizar
      await cachedDb.command({ ping: 1 });
      return cachedDb;
    } catch (pingErr) {
      console.warn('⚠️ Conexão MongoDB Atlas expirou ou foi fechada. Reconectando...');
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
 * Retorna todos os dados da plataforma
 */
async function getAppData() {
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

        // Se for a primeira vez no MongoDB, popula com os dados locais
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

  return normalizeAppData(readLocalFile());
}

/**
 * Salva os dados atualizados da plataforma
 */
async function saveAppData(data) {
  let savedInMongo = false;
  data.updatedAt = new Date().toISOString();

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
        savedInMongo = true;
      } catch (err) {
        console.error('❌ Erro ao salvar no MongoDB:', err.message);
        cachedClient = null;
        cachedDb = null;
      }
    }
  }

  const savedLocally = writeLocalFile(data);
  return savedInMongo || savedLocally;
}

/**
 * Informações sobre o status do armazenamento
 */
function getStorageStatus() {
  const hasMongoConfig = !!(process.env.MONGODB_URI && process.env.MONGODB_URI.trim());
  return {
    mode: hasMongoConfig ? 'mongodb' : 'local',
    connected: hasMongoConfig && !!cachedDb,
    hasMongoConfig: hasMongoConfig,
    message: hasMongoConfig 
      ? (cachedDb ? 'MongoDB Atlas Conectado' : 'Conectando ao MongoDB Atlas...')
      : 'Modo Local (Para persistência permanente na nuvem, adicione MONGODB_URI na Vercel)'
  };
}

module.exports = {
  getAppData,
  saveAppData,
  writeLocalFile,
  getMongoDb,
  getStorageStatus
};
