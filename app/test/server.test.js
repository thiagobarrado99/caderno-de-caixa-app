const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_FILE = path.join(os.tmpdir(), `caderno-teste-${process.pid}.json`);
delete process.env.APP_PASSWORD; // no Render a senha real existe durante o build; os testes controlam a sua própria
const { server, validar, resumo } = require('../server');

let base;
before(() => new Promise((ok) => server.listen(0, () => {
  base = `http://localhost:${server.address().port}`;
  ok();
})));
after(() => { server.close(); fs.rmSync(process.env.DATA_FILE, { force: true }); });

const novo = (extra = {}) => ({ descricao: 'Formatação de notebook', tipo: 'entrada', valor: 150, data: '2026-09-20', ...extra });
const post = (body) => fetch(`${base}/api/lancamentos`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test('validar aceita lançamento correto', () => {
  assert.strictEqual(validar(novo()), null);
});

test('validar rejeita dados inválidos', () => {
  assert.match(validar(novo({ descricao: ' ' })), /descricao/);
  assert.match(validar(novo({ tipo: 'outro' })), /tipo/);
  assert.match(validar(novo({ valor: -5 })), /valor/);
  assert.match(validar(novo({ data: '20/09/2026' })), /data/);
});

test('resumo calcula entradas, saídas e saldo', () => {
  const r = resumo([novo({ valor: 300 }), novo({ tipo: 'saida', valor: 120 })]);
  assert.deepStrictEqual(r, { entradas: 300, saidas: 120, saldo: 180 });
});

test('GET /health responde ok (usado pelo monitoramento)', async () => {
  const r = await fetch(`${base}/health`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual((await r.json()).status, 'ok');
});

test('GET / entrega a página', async () => {
  const r = await fetch(base);
  assert.strictEqual(r.status, 200);
  assert.match(await r.text(), /Caderno de Caixa/);
});

test('fluxo completo: criar, listar e excluir lançamento', async () => {
  const criado = await post(novo({ valor: 200 }));
  assert.strictEqual(criado.status, 201);
  const { id } = await criado.json();

  const lista = await (await fetch(`${base}/api/lancamentos`)).json();
  assert.ok(lista.itens.some((i) => i.id === id));
  assert.strictEqual(lista.resumo.entradas, 200);

  const del = await fetch(`${base}/api/lancamentos/${id}`, { method: 'DELETE' });
  assert.strictEqual(del.status, 204);
  const del2 = await fetch(`${base}/api/lancamentos/${id}`, { method: 'DELETE' });
  assert.strictEqual(del2.status, 404);
});

test('POST inválido retorna 400', async () => {
  const r = await post(novo({ valor: 0 }));
  assert.strictEqual(r.status, 400);
});

test('com APP_PASSWORD definida, exige autenticação', async () => {
  process.env.APP_PASSWORD = 'segredo';
  try {
    assert.strictEqual((await fetch(base)).status, 401);
    const auth = { Authorization: 'Basic ' + Buffer.from('thiago:segredo').toString('base64') };
    assert.strictEqual((await fetch(base, { headers: auth })).status, 200);
    assert.strictEqual((await fetch(`${base}/health`)).status, 200); // health continua público
  } finally {
    delete process.env.APP_PASSWORD;
  }
});
