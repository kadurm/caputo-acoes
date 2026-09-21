# 🍀 Caputo Ações

Plataforma moderna, responsiva e dinâmica para publicação e gerenciamento de ações entre amigos, rifas e sorteios.

---

## 🚀 Funcionalidades

- **📱 Landing Page Dinâmica (`index.html`):**
  - Banner em destaque com contagem regressiva/status.
  - Abas para Ações Ativas, Ações Encerradas, Ganhadores Anteriores e Vídeos de entregas.
  - Conexão direta aos canais oficiais (WhatsApp e Instagram).
  - Atualização dinâmica em tempo real consumindo a API.

- **🔒 Painel Administrativo Completo (`/admin`):**
  - Autenticação protegida por **JWT** e senhas criptografadas com **Bcrypt**.
  - Gerenciamento de Campanhas (cadastrar, alterar destaque, definir porcentagem vendida, excluir).
  - Cadastro de Ganhadores com fotos de entrega e bilhete sorteado.
  - Cadastro de Vídeos (YouTube/Vimeo) com miniaturas personalizadas.
  - Configuração de links de contato (WhatsApp e Instagram).

- **☁️ Arquitetura Pronta para Nuvem e Serverless:**
  - **Vercel Serverless Ready:** configurado com rewrites modernos em `vercel.json`.
  - **Banco de Dados Híbrido:** Suporte automático a **MongoDB Atlas** para produção e fallback para arquivo local `data/db.json` durante o desenvolvimento offline.
  - **Upload de Fotos:** Integração com **Cloudinary** com fallback automático para Data URLs caso as credenciais não estejam preenchidas.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** HTML5, Tailwind CSS, Vanilla JavaScript moderno, Phosphor Icons.
- **Backend:** Node.js, Express.
- **Segurança:** JSON Web Token (`jsonwebtoken`), `bcryptjs`.
- **Mídia:** `multer`, `cloudinary`.
- **Banco de Dados:** Driver oficial `mongodb` e persistência local em JSON.

---

## 📦 Como Rodar Localmente

### 1. Pré-requisitos
- Ter o [Node.js](https://nodejs.org/) instalado (versão 18 ou superior recomendada).

### 2. Instalação
Clone o repositório e instale as dependências:
```bash
git clone https://github.com/kadurm/caputo-acoes.git
cd "Caputo Ações"
npm install
```

### 3. Configurar Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto (você pode copiar do `.env.example`):
```bash
cp .env.example .env
```

Edite o `.env` conforme necessário:
```env
PORT=3000
JWT_SECRET=sua_chave_secreta_aqui
ADMIN_EMAIL=admin@caputo.com
ADMIN_PASSWORD=caputo123
```

### 4. Iniciar o Servidor
Execute em modo desenvolvimento:
```bash
npm run dev
```

Abra no seu navegador:
- **Landing Page:** [http://localhost:3000](http://localhost:3000)
- **Painel Admin:** [http://localhost:3000/admin](http://localhost:3000/admin)

---

## 🔐 Gerando Senha Criptografada (Bcrypt)

Para maior segurança em produção, você pode gerar um hash bcrypt para sua senha de administrador executando:

```bash
npm run hash "sua_senha_secreta"
```

O terminal exibirá uma linha como:
```env
ADMIN_PASSWORD_HASH=$2a$10$A4ltwdPu78.mkI2RDspBhO6GseC56ts2F2.IiQLGCgcq2qZhbM4xC
```
Basta colar essa linha no seu `.env` local ou nas configurações da Vercel!

---

## 🚀 Como Fazer o Deploy na Vercel

O projeto está 100% configurado para rodar na Vercel sem necessidade de configurações adicionais de build.

### 1. Banco de Dados (MongoDB Atlas Gratuito)
1. Crie uma conta gratuita em [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Crie um Cluster gratuito (M0 Sandbox).
3. Em **Database Access**, crie um usuário e senha para o banco.
4. Em **Network Access**, adicione acesso de qualquer lugar (`0.0.0.0/0`).
5. Clique em **Connect** -> **Drivers** (Node.js) e copie a string de conexão:
   `mongodb+srv://usuario:senha@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority`

### 2. Configurar Variáveis na Vercel
Ao importar o projeto na [Vercel](https://vercel.com):
1. Importe o repositório do GitHub.
2. Em **Environment Variables**, adicione:
   - `JWT_SECRET`: uma string longa e aleatória.
   - `ADMIN_EMAIL`: seu e-mail de login de admin.
   - `ADMIN_PASSWORD_HASH`: o hash gerado com `npm run hash`.
   - `MONGODB_URI`: sua string de conexão do MongoDB Atlas.
   - `MONGODB_DB_NAME`: `caputo_acoes`
   - `CLOUDINARY_CLOUD_NAME`: (opcional) seu Cloud Name do Cloudinary.
   - `CLOUDINARY_API_KEY`: (opcional) sua API Key.
   - `CLOUDINARY_API_SECRET`: (opcional) seu API Secret.
3. Clique em **Deploy**.

Após o deploy:
- A página inicial estará acessível em `https://seu-projeto.vercel.app/`
- O painel admin estará em `https://seu-projeto.vercel.app/admin`

---

## 📁 Estrutura do Projeto

```
.
├── api/
│   ├── index.js          # Servidor Express e rotas da API (compatível com Vercel Serverless)
│   └── db.js             # Camada híbrida de persistência (MongoDB Atlas + db.json fallback)
├── data/
│   └── db.json           # Banco de dados local em formato JSON
├── images/               # Imagens estáticas e assets
├── js/
│   ├── admin.js          # Lógica do painel administrativo
│   └── main.js           # Lógica dinâmica da landing page
├── scripts/
│   └── generate-hash.js  # Utilitário para gerar hash Bcrypt de senhas
├── .env.example          # Exemplo de configuração de variáveis
├── index.html            # Landing page principal
├── painel_admin_caputo_a_es.html # Template do painel de administração
├── package.json          # Dependências e scripts npm
├── vercel.json           # Configuração de rewrites e rotas para deploy na Vercel
└── README.md             # Este manual de instruções
```

---

## 📜 Licença
Projeto desenvolvido para **Caputo Ações**. Todos os direitos reservados.
