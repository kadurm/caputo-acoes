const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

const { getAppData, saveAppData } = require('./db');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuração do Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

const JWT_SECRET = process.env.JWT_SECRET || 'caputo_acoes_secret_key_2026';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@caputo.com').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'caputo123';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

// Log informativo de segurança no startup
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  [SEGURANÇA] JWT_SECRET não definido em variáveis de ambiente. Usando chave padrão.');
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

// Memory Storage for Uploads (suporte a arquivos e vídeos de até 100MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

// --- PUBLIC ENDPOINTS ---

// GET /api/public/data - Obter todo o conteúdo público para a Landing Page
app.get('/api/public/data', async (req, res) => {
  try {
    const db = await getAppData();
    res.json({
      success: true,
      data: db
    });
  } catch (err) {
    console.error('Erro ao obter dados públicos:', err);
    res.status(500).json({ success: false, message: 'Erro ao carregar dados.' });
  }
});

// --- AUTHENTICATION ENDPOINTS ---

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'E-mail e senha são obrigatórios.'
    });
  }

  const normalizedEmail = email.toLowerCase().trim();
  if (normalizedEmail !== ADMIN_EMAIL) {
    return res.status(401).json({
      success: false,
      message: 'Credenciais inválidas. Verifique seu e-mail e senha.'
    });
  }

  let isValidPassword = false;

  // 1. Validação via hash bcrypt se ADMIN_PASSWORD_HASH estiver configurado
  if (ADMIN_PASSWORD_HASH) {
    isValidPassword = bcrypt.compareSync(password, ADMIN_PASSWORD_HASH);
  } 
  // 2. Se ADMIN_PASSWORD já for um hash bcrypt
  else if (ADMIN_PASSWORD.startsWith('$2a$') || ADMIN_PASSWORD.startsWith('$2b$')) {
    isValidPassword = bcrypt.compareSync(password, ADMIN_PASSWORD);
  } 
  // 3. Fallback para senha em texto puro
  else {
    isValidPassword = (password === ADMIN_PASSWORD);
  }

  if (isValidPassword) {
    const token = jwt.sign({ email: normalizedEmail, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({
      success: true,
      token,
      user: { email: normalizedEmail, role: 'admin' }
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

// POST /api/upload (Cloudinary com Fallback Local para Vídeos e Imagens)
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file && !req.body.base64) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });
    }

    const isVideo = req.file && (
      (req.file.mimetype && req.file.mimetype.startsWith('video/')) ||
      /\.(mp4|mov|avi|webm|m4v)$/i.test(req.file.originalname || '')
    );

    // 1. Se Cloudinary estiver configurado
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      const fileBuffer = req.file ? req.file.buffer : Buffer.from(req.body.base64.split(',')[1], 'base64');
      
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'caputo_acoes', resource_type: 'auto' },
        (error, result) => {
          if (error) {
            console.error('Erro no Cloudinary:', error);
            if (isVideo && req.file) {
              return saveVideoLocally(req.file, res);
            }
            const base64Url = req.file ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` : req.body.base64;
            return res.json({ success: true, url: base64Url, fallback: true });
          }
          return res.json({ success: true, url: result.secure_url });
        }
      );
      
      return uploadStream.end(fileBuffer);
    } else {
      // 2. Modo Local (ou fallback)
      if (isVideo && req.file) {
        return saveVideoLocally(req.file, res);
      }

      // Imagens: Data URL Base64
      const mimeType = req.file ? req.file.mimetype : 'image/jpeg';
      const base64Content = req.file ? req.file.buffer.toString('base64') : req.body.base64;
      const dataUrl = req.file ? `data:${mimeType};base64,${base64Content}` : base64Content;
      
      return res.json({
        success: true,
        url: dataUrl,
        message: 'Upload realizado com sucesso.'
      });
    }
  } catch (err) {
    console.error('Erro no upload:', err);
    res.status(500).json({ success: false, message: 'Falha no processamento do arquivo.' });
  }
});

// Helper para salvar vídeos localmente
function saveVideoLocally(file, res) {
  try {
    const uploadDir = path.join(__dirname, '..', 'Sorteios', 'Finalizadas');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const cleanName = (file.originalname || 'video.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `upload_${Date.now()}_${cleanName}`;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, file.buffer);
    return res.json({
      success: true,
      url: `/Sorteios/Finalizadas/${encodeURIComponent(fileName)}`,
      message: 'Vídeo enviado e salvo com sucesso!'
    });
  } catch (err) {
    console.error('Erro ao salvar vídeo no disco:', err);
    return res.status(500).json({ success: false, message: 'Erro ao gravar vídeo no servidor.' });
  }
}

// --- ADMIN CRUD ENDPOINTS ---

// CRUD: Ações
app.get('/api/acoes', authenticateToken, async (req, res) => {
  try {
    const db = await getAppData();
    res.json({ success: true, data: db.acoes || [], destaque: db.destaque || {}, encerradas: db.encerradas || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao buscar ações.' });
  }
});

app.post('/api/acoes', authenticateToken, async (req, res) => {
  try {
    const db = await getAppData();
    db.acoes = db.acoes || [];
    db.encerradas = db.encerradas || [];

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

    await saveAppData(db);
    res.json({ success: true, message: 'Ação salva com sucesso!', data: novaAcao });
  } catch (err) {
    console.error('Erro ao criar ação:', err);
    res.status(500).json({ success: false, message: 'Erro ao salvar ação.' });
  }
});

app.delete('/api/acoes/:id', authenticateToken, async (req, res) => {
  try {
    const db = await getAppData();
    const id = req.params.id;
    db.acoes = (db.acoes || []).filter(a => a.id !== id);
    db.encerradas = (db.encerradas || []).filter(a => a.id !== id);
    if (db.destaque && db.destaque.id === id) {
      db.destaque = {};
    }
    await saveAppData(db);
    res.json({ success: true, message: 'Ação removida com sucesso.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao remover ação.' });
  }
});

// CRUD: Ganhadores
app.get('/api/ganhadores', authenticateToken, async (req, res) => {
  try {
    const db = await getAppData();
    res.json({ success: true, data: db.ganhadores || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao buscar ganhadores.' });
  }
});

app.post('/api/ganhadores', authenticateToken, async (req, res) => {
  try {
    const db = await getAppData();
    db.ganhadores = db.ganhadores || [];

    const novoGanhador = {
      id: 'ganhador_' + Date.now(),
      nome: req.body.nome,
      premio: req.body.premio,
      bilhete: req.body.bilhete,
      data: req.body.data || new Date().toLocaleDateString('pt-BR'),
      imagemUrl: req.body.imagemUrl || 'https://placehold.co/600x400/222/ca8a04?text=GANHADOR'
    };

    db.ganhadores.unshift(novoGanhador);
    await saveAppData(db);
    res.json({ success: true, message: 'Ganhador cadastrado com sucesso!', data: novoGanhador });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao salvar ganhador.' });
  }
});

app.delete('/api/ganhadores/:id', authenticateToken, async (req, res) => {
  try {
    const db = await getAppData();
    db.ganhadores = (db.ganhadores || []).filter(g => g.id !== req.params.id);
    await saveAppData(db);
    res.json({ success: true, message: 'Ganhador removido com sucesso.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao remover ganhador.' });
  }
});

// CRUD: Vídeos
app.get('/api/videos', authenticateToken, async (req, res) => {
  try {
    const db = await getAppData();
    res.json({ success: true, data: db.videos || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao buscar vídeos.' });
  }
});

app.post('/api/videos', authenticateToken, async (req, res) => {
  try {
    const db = await getAppData();
    db.videos = db.videos || [];

    const novoVideo = {
      id: 'video_' + Date.now(),
      titulo: req.body.titulo,
      data: req.body.data || new Date().toLocaleDateString('pt-BR'),
      videoUrl: req.body.videoUrl,
      thumbnailUrl: req.body.thumbnailUrl || 'https://placehold.co/800x450/111/fff?text=THUMBNAIL'
    };

    db.videos.unshift(novoVideo);
    await saveAppData(db);
    res.json({ success: true, message: 'Vídeo adicionado com sucesso!', data: novoVideo });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao salvar vídeo.' });
  }
});

app.delete('/api/videos/:id', authenticateToken, async (req, res) => {
  try {
    const db = await getAppData();
    db.videos = (db.videos || []).filter(v => v.id !== req.params.id);
    await saveAppData(db);
    res.json({ success: true, message: 'Vídeo removido com sucesso.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao remover vídeo.' });
  }
});

// CONFIGURAÇÕES
app.get('/api/config', async (req, res) => {
  try {
    const db = await getAppData();
    res.json({ success: true, data: db.config || {} });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao buscar configurações.' });
  }
});

app.put('/api/config', authenticateToken, async (req, res) => {
  try {
    const db = await getAppData();
    db.config = {
      whatsappUrl: req.body.whatsappUrl || (db.config && db.config.whatsappUrl) || '',
      instagramUrl: req.body.instagramUrl || (db.config && db.config.instagramUrl) || ''
    };
    await saveAppData(db);
    res.json({ success: true, message: 'Configurações salvas com sucesso!', data: db.config });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao salvar configurações.' });
  }
});

// Servir arquivos estáticos no ambiente local
const rootDir = path.join(__dirname, '..');
app.use(express.static(rootDir));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(rootDir, 'painel_admin_caputo_a_es.html'));
});

// Iniciar servidor se executado diretamente (ex: node api/index.js)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n🚀 Servidor Caputo Ações rodando em: http://localhost:${PORT}`);
    console.log(`📱 Landing Page: http://localhost:${PORT}/index.html`);
    console.log(`🔒 Painel Admin: http://localhost:${PORT}/admin\n`);
  });
}

module.exports = app;
