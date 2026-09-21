/**
 * Database Adapter - Caputo Ações
 * 
 * Suporta dois modos:
 * 1. MongoDB Atlas (Produção / Vercel Serverless): ativado quando MONGODB_URI está configurado.
 * 2. Arquivo Local JSON (Desenvolvimento / Local): fallback automático para data/db.json.
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const DB_FILE_PATH = path.join(__dirname, '..', 'data', 'db.json');

// Estrutura padrão inicial caso o banco esteja vazio
const DEFAULT_DATA = {
  destaque: {
    id: 'destaque_1',
    titulo: 'NOVA HILUX 4x4 + R$ 20 MIL',
    subtitulo: 'Apenas R$ 0,50 a cota. Sorteio pela Loteria Federal.',
    precoCota: '0,50',
    imagemUrl: 'https://placehold.co/800x1000/111827/ca8a04?text=FOTO+DA+AÇÃO',
    statusBadge: 'Encerrando em breve!',
    linkCheckout: 'https://wa.me/5500000000000',
    porcentagemVendido: 85
  },
  acoes: [],
  encerradas: [],
  ganhadores: [],
  videos: [],
  config: {
    whatsappUrl: 'https://wa.me/5500000000000',
    instagramUrl: 'https://instagram.com/caputoacoes'
  }
};

// Cache de conexão para ambiente Serverless (Vercel)
let cachedClient = null;
let cachedDb = null;
let memoryFallback = null;

async function getMongoDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;

  if (cachedClient && cachedDb) {
    return cachedDb;
  }

  try {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    await client.connect();
    cachedClient = client;
    cachedDb = client.db(process.env.MONGODB_DB_NAME || 'caputo_acoes');
    console.log('✅ Conectado ao MongoDB Atlas com sucesso.');
    return cachedDb;
  } catch (err) {
    console.error('❌ Erro ao conectar ao MongoDB Atlas:', err.message);
    return null;
  }
}

// Leitura do arquivo local JSON
function readLocalFile() {
  try {
    if (memoryFallback) return memoryFallback;

    if (fs.existsSync(DB_FILE_PATH)) {
      const content = fs.readFileSync(DB_FILE_PATH, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn('⚠️ Erro ao ler db.json local:', err.message);
  }
  return DEFAULT_DATA;
}

// Gravação no arquivo local JSON
function writeLocalFile(data) {
  memoryFallback = data;
  try {
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.warn('⚠️ Não foi possível gravar em db.json (sistema somente leitura). Mantido em memória temporária:', err.message);
    return false;
  }
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
          return cleanData;
        }

        // Se for a primeira vez no MongoDB, popula com os dados iniciais locais
        const initialData = readLocalFile();
        await collection.updateOne(
          { _id: 'current_state' },
          { $set: { ...initialData, updatedAt: new Date() } },
          { upsert: true }
        );
        return initialData;
      } catch (err) {
        console.error('❌ Erro ao consultar MongoDB, usando fallback:', err.message);
      }
    }
  }

  return readLocalFile();
}

/**
 * Salva os dados atualizados da plataforma
 */
async function saveAppData(data) {
  if (process.env.MONGODB_URI) {
    const db = await getMongoDb();
    if (db) {
      try {
        const collection = db.collection('app_data');
        const updatePayload = { ...data, updatedAt: new Date() };
        delete updatePayload._id;

        await collection.updateOne(
          { _id: 'current_state' },
          { $set: updatePayload },
          { upsert: true }
        );
        return true;
      } catch (err) {
        console.error('❌ Erro ao salvar no MongoDB:', err.message);
      }
    }
  }

  return writeLocalFile(data);
}

module.exports = {
  getAppData,
  saveAppData
};
