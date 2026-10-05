// Caderno de Caixa — controle simples de entradas e saídas para o microempreendedor (MEI).
// Usa apenas a biblioteca padrão do Node.js (sem npm install).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const INDEX = fs.readFileSync(path.join(__dirname, 'public', 'index.html'));

const load = () => {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return []; }
};
const save = (itens) => fs.writeFileSync(DATA_FILE, JSON.stringify(itens, null, 2));

function validar(b) {
  if (!b || typeof b.descricao !== 'string' || !b.descricao.trim()) return 'descricao obrigatoria';
  if (!['entrada', 'saida'].includes(b.tipo)) return 'tipo deve ser entrada ou saida';
  if (typeof b.valor !== 'number' || !(b.valor > 0)) return 'valor deve ser maior que zero';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.data || '')) return 'data deve estar no formato AAAA-MM-DD';
  return null;
}

function resumo(itens) {
  const soma = (tipo) => itens.filter((i) => i.tipo === tipo).reduce((t, i) => t + i.valor, 0);
  const entradas = soma('entrada');
  const saidas = soma('saida');
  return { entradas, saidas, saldo: entradas - saidas };
}

// Autenticação opcional: se APP_PASSWORD estiver definida, exige login (usuário qualquer).
function autorizado(req) {
  const senha = process.env.APP_PASSWORD;
  if (!senha) return true;
  const [, token = ''] = (req.headers.authorization || '').split(' ');
  return Buffer.from(token, 'base64').toString().split(':')[1] === senha;
}

function enviar(res, status, corpo) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(corpo === undefined ? '' : JSON.stringify(corpo));
}

async function lerJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw); } catch { return null; }
}

const server = http.createServer(async (req, res) => {
  const inicio = Date.now();
  // Log estruturado de cada requisição (lido pelo painel de logs do provedor de nuvem).
  res.on('finish', () => console.log(JSON.stringify({
    metodo: req.method, rota: req.url, status: res.statusCode, ms: Date.now() - inicio,
  })));

  if (req.url === '/health') return enviar(res, 200, { status: 'ok', uptime: Math.round(process.uptime()) });

  if (!autorizado(req)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Caderno de Caixa"' });
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(INDEX);
  }

  if (req.url === '/api/lancamentos') {
    if (req.method === 'GET') {
      const itens = load();
      return enviar(res, 200, { itens, resumo: resumo(itens) });
    }
    if (req.method === 'POST') {
      const b = await lerJson(req);
      const erro = validar(b);
      if (erro) return enviar(res, 400, { erro });
      const item = { id: crypto.randomUUID(), descricao: b.descricao.trim(), tipo: b.tipo, valor: b.valor, data: b.data };
      save([...load(), item]);
      return enviar(res, 201, item);
    }
  }

  const m = req.url.match(/^\/api\/lancamentos\/([\w-]+)$/);
  if (m && req.method === 'DELETE') {
    const itens = load();
    const restantes = itens.filter((i) => i.id !== m[1]);
    if (restantes.length === itens.length) return enviar(res, 404, { erro: 'nao encontrado' });
    save(restantes);
    return enviar(res, 204);
  }

  enviar(res, 404, { erro: 'rota nao encontrada' });
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`Caderno de Caixa rodando em http://localhost:${PORT}`));
}

module.exports = { server, validar, resumo };
