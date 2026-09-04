const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure Cloudinary if environment variables are provided
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

const JWT_SECRET = process.env.JWT_SECRET || 'caputo_acoes_secret_key_2026';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@caputo.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'caputo123';

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

// Helper to read database
function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return {
        destaque: {},
        acoes: [],
        encerradas: [],
        ganhadores: [],
        videos: [],
        config: { whatsappUrl: '', instagramUrl: '' }
      };
    }
    const content = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Erro ao ler banco de dados:', err);
    return { destaque: {}, acoes: [], encerradas: [], ganhadores: [], videos: [], config: {} };
  }
}

// Helper to write database
function writeDB(data) {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Erro ao salvar no banco de dados:', err);
    return false;
  }
}

// JWT Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Acesso negado. Token não fornecido.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Token inválido ou expirado.' });
    }
    req.user = user;
    next();
  });
}

// Memory Storage for Uploads
const upload = multer({ storage: multer.memoryStorage() });

// --- PUBLIC ENDPOINTS ---

// GET /api/public/data - Get all public content for Landing Page
app.get('/api/public/data', (req, res) => {
  const db = readDB();
  res.json({
    success: true,
    data: db
  });
});

// --- AUTHENTICATION ENDPOINTS ---

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ email, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({
      success: true,
      token,
      user: { email, role: 'admin' }
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Credenciais inválidas. Verifique seu e-mail e senha.'
  });
});

// GET /api/auth/verify
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// --- UPLOAD ENDPOINT ---

// POST /api/upload (Cloudinary with Fallback)
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file && !req.body.base64) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });
    }

    // Check if Cloudinary credentials are valid
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
      const fileBuffer = req.file ? req.file.buffer : Buffer.from(req.body.base64.split(',')[1], 'base64');
      
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'caputo_acoes' },
        (error, result) => {
          if (error) {
            console.error('Erro no Cloudinary:', error);
            // Fallback to base64 if Cloudinary fails
            const base64Url = req.file ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` : req.body.base64;
            return res.json({ success: true, url: base64Url, fallback: true });
          }
          return res.json({ success: true, url: result.secure_url });
        }
      );
      
      return uploadStream.end(fileBuffer);
    } else {
      // Fallback mode: Convert buffer to base64 data URL
      const mimeType = req.file ? req.file.mimetype : 'image/jpeg';
      const base64Content = req.file ? req.file.buffer.toString('base64') : req.body.base64;
      const dataUrl = req.file ? `data:${mimeType};base64,${base64Content}` : base64Content;
      
      return res.json({
        success: true,
        url: dataUrl,
        message: 'Upload simulado via Data URL (Configure o Cloudinary no .env para URLs externas)'
      });
    }
  } catch (err) {
    console.error('Erro no upload:', err);
    res.status(500).json({ success: false, message: 'Falha no processamento da imagem.' });
  }
});

// --- ADMIN CRUD ENDPOINTS ---

// CRUD: Ações
app.get('/api/acoes', authenticateToken, (req, res) => {
  const db = readDB();
  res.json({ success: true, data: db.acoes, destaque: db.destaque, encerradas: db.encerradas });
});

app.post('/api/acoes', authenticateToken, (req, res) => {
  const db = readDB();
  const novaAcao = {
    id: 'acao_' + Date.now(),
    titulo: req.body.titulo,
    precoCota: req.body.precoCota,
    imagemUrl: req.body.imagemUrl || 'https://placehold.co/400x500/111827/ca8a04?text=FOTO+AÇÃO',
    porcentagemVendido: Number(req.body.porcentagemVendido) || 0,
    localExibicao: req.body.localExibicao || 'Aba: Ativas',
    linkCheckout: req.body.linkCheckout || 'https://wa.me/5500000000000',
    status: 'ativa'
  };

  if (req.body.localExibicao === 'Destaque Principal (Banner Topo)') {
    db.destaque = {
      id: novaAcao.id,
      titulo: novaAcao.titulo,
      subtitulo: `Apenas R$ ${novaAcao.precoCota} a cota. Sorteio pela Loteria Federal.`,
      precoCota: novaAcao.precoCota,
      imagemUrl: novaAcao.imagemUrl,
      statusBadge: 'Encerrando em breve!',
      linkCheckout: novaAcao.linkCheckout,
      porcentagemVendido: novaAcao.porcentagemVendido
    };
  } else if (req.body.localExibicao === 'Aba: Encerradas') {
    db.encerradas.unshift({
      id: novaAcao.id,
      titulo: novaAcao.titulo,
      imagemUrl: novaAcao.imagemUrl,
      status: 'Finalizada'
    });
  } else {
    db.acoes.unshift(novaAcao);
  }

  writeDB(db);
  res.json({ success: true, message: 'Ação criada com sucesso!', data: novaAcao });
});

app.delete('/api/acoes/:id', authenticateToken, (req, res) => {
  const db = readDB();
  const id = req.params.id;
  db.acoes = db.acoes.filter(a => a.id !== id);
  db.encerradas = db.encerradas.filter(a => a.id !== id);
  writeDB(db);
  res.json({ success: true, message: 'Ação removida com sucesso.' });
});

// CRUD: Ganhadores
app.get('/api/ganhadores', authenticateToken, (req, res) => {
  const db = readDB();
  res.json({ success: true, data: db.ganhadores });
});

app.post('/api/ganhadores', authenticateToken, (req, res) => {
  const db = readDB();
  const novoGanhador = {
    id: 'ganhador_' + Date.now(),
    nome: req.body.nome,
    premio: req.body.premio,
    bilhete: req.body.bilhete,
    data: req.body.data || new Date().toLocaleDateString('pt-BR'),
    imagemUrl: req.body.imagemUrl || 'https://placehold.co/600x400/222/ca8a04?text=GANHADOR'
  };

  db.ganhadores.unshift(novoGanhador);
  writeDB(db);
  res.json({ success: true, message: 'Ganhador cadastrado com sucesso!', data: novoGanhador });
});

app.delete('/api/ganhadores/:id', authenticateToken, (req, res) => {
  const db = readDB();
  db.ganhadores = db.ganhadores.filter(g => g.id !== req.params.id);
  writeDB(db);
  res.json({ success: true, message: 'Ganhador removido com sucesso.' });
});

// CRUD: Vídeos
app.get('/api/videos', authenticateToken, (req, res) => {
  const db = readDB();
  res.json({ success: true, data: db.videos });
});

app.post('/api/videos', authenticateToken, (req, res) => {
  const db = readDB();
  const novoVideo = {
    id: 'video_' + Date.now(),
    titulo: req.body.titulo,
    data: req.body.data || new Date().toLocaleDateString('pt-BR'),
    videoUrl: req.body.videoUrl,
    thumbnailUrl: req.body.thumbnailUrl || 'https://placehold.co/800x450/111/fff?text=THUMBNAIL'
  };

  db.videos.unshift(novoVideo);
  writeDB(db);
  res.json({ success: true, message: 'Vídeo adicionado com sucesso!', data: novoVideo });
});

app.delete('/api/videos/:id', authenticateToken, (req, res) => {
  const db = readDB();
  db.videos = db.videos.filter(v => v.id !== req.params.id);
  writeDB(db);
  res.json({ success: true, message: 'Vídeo removido com sucesso.' });
});

// CONFIGURAÇÕES
app.get('/api/config', (req, res) => {
  const db = readDB();
  res.json({ success: true, data: db.config });
});

app.put('/api/config', authenticateToken, (req, res) => {
  const db = readDB();
  db.config = {
    whatsappUrl: req.body.whatsappUrl || db.config.whatsappUrl,
    instagramUrl: req.body.instagramUrl || db.config.instagramUrl
  };
  writeDB(db);
  res.json({ success: true, message: 'Configurações salvas com sucesso!', data: db.config });
});

// Serve Static Frontend Files when running locally
const rootDir = path.join(__dirname, '..');
app.use(express.static(rootDir));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(rootDir, 'painel_admin_caputo_a_es.html'));
});

// Start Server locally if executed directly (e.g. node api/index.js)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n🚀 Servidor Caputo Ações rodando em: http://localhost:${PORT}`);
    console.log(`📱 Landing Page: http://localhost:${PORT}/index.html`);
    console.log(`🔒 Painel Admin: http://localhost:${PORT}/admin\n`);
  });
}

module.exports = app;
