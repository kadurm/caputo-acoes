#!/usr/bin/env node
/**
 * Gerador de Hash Bcrypt para Senha de Administrador
 * Uso:
 *   node scripts/generate-hash.js [sua_senha]
 * Exemplo:
 *   node scripts/generate-hash.js "caputo123"
 */

const bcrypt = require('bcryptjs');

const rawPassword = process.argv[2];

if (!rawPassword) {
  console.log('\n======================================================');
  console.log('   CAPUTO AÇÕES - GERADOR DE HASH BCRYPT DE SENHA     ');
  console.log('======================================================\n');
  console.log('⚠️  Nenhuma senha informada.');
  console.log('👉 Uso: npm run hash "<sua_senha>"');
  console.log('   Ex: npm run hash "caputo123"\n');
  process.exit(1);
}

const saltRounds = 10;
const hash = bcrypt.hashSync(rawPassword, saltRounds);

console.log('\n======================================================');
console.log('✅ Hash gerado com sucesso!');
console.log('======================================================');
console.log(`🔑 Senha original:  ${rawPassword}`);
console.log(`🔒 Hash Bcrypt:     ${hash}`);
console.log('======================================================');
console.log('Copie o hash acima e configure no seu arquivo .env ou no Vercel:');
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
