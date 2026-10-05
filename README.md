# 📒 Caderno de Caixa

Aplicação web para o microempreendedor (MEI) registrar **entradas e saídas** do negócio e ver o saldo, acessível pelo celular ou computador por estar hospedada em nuvem.

Projeto Integrado de Computação em Nuvem, ADS/UNIFEOB, 3º trimestre de 2026.

## Rodar localmente (só precisa do Node.js 20 ou mais recente)

```bash
git clone https://github.com/thiagobarrado99/caderno-de-caixa-app
cd caderno-de-caixa-app/app
npm start
```

Abra **http://localhost:3000**. Não há dependências, então não precisa rodar `npm install`.

Rodar os testes automatizados:

```bash
npm test          # 8 testes (unidade + integração da API)
npm run coverage  # testes + relatório de cobertura
```

Com Docker (opcional):

```bash
cd app
docker build -t caderno-de-caixa .
docker run -p 3000:3000 caderno-de-caixa
```

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/` | Interface web |
| GET | `/health` | Verificação de saúde, usada pelo monitoramento |
| GET | `/api/lancamentos` | Lista os lançamentos e o resumo (entradas, saídas, saldo) |
| POST | `/api/lancamentos` | Cria um lançamento `{descricao, tipo: "entrada"\|"saida", valor, data: "AAAA-MM-DD"}` |
| DELETE | `/api/lancamentos/:id` | Remove um lançamento |

## Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---|---|
| `PORT` | `3000` | Porta HTTP (o provedor de nuvem define automaticamente) |
| `APP_PASSWORD` | sem senha | Quando definida, exige login (HTTP Basic) para acessar o app. `/health` continua público |
| `DATA_FILE` | `./data.json` | Arquivo onde os lançamentos são salvos |

## Deploy em nuvem

### Opção A: Render (PaaS, plano gratuito), a utilizada no projeto
1. Faça um fork ou use este repositório: https://github.com/thiagobarrado99/caderno-de-caixa-app
2. No [Render](https://render.com), escolha **New → Blueprint** e selecione o repositório. O arquivo `render.yaml` (na raiz do repositório) configura tudo:
   - `rootDir: app` indica a pasta da aplicação;
   - `buildCommand: npm test` faz o deploy **só acontecer se os testes passarem**;
   - `healthCheckPath: /health` faz o Render reiniciar a instância se ela parar de responder;
   - `autoDeploy: true` publica automaticamente cada push na `main` (CD).
3. Em **Environment**, defina `APP_PASSWORD` para proteger o acesso.
4. (Opcional) Em **Settings → Custom Domains**, configure um domínio próprio. O HTTPS é emitido automaticamente.

> No plano gratuito o disco é temporário, então os dados são apagados a cada novo deploy. Para uso real, adicione um *Persistent Disk* e aponte `DATA_FILE` para ele.

### Opção B: AWS (IaaS com EC2)
```bash
# na instância EC2 (Amazon Linux), com a porta 80 liberada no Security Group:
sudo dnf install -y nodejs git
git clone https://github.com/thiagobarrado99/caderno-de-caixa-app && cd caderno-de-caixa-app/app
sudo PORT=80 APP_PASSWORD=<senha> node server.js
```
Para escalar horizontalmente na AWS, use o `Dockerfile` no **AWS App Runner**, que escala automaticamente conforme o número de requisições.

## Qualidade e monitoramento
- **Testes automatizados** com o executor nativo do Node (`node:test`): validação, cálculo do saldo, API completa e autenticação.
- **CI**: `.github/workflows/ci.yml` (na raiz do repositório) roda os testes e a cobertura em todo push e pull request.
- **CD**: o Render só publica se `npm test` passar.
- **Monitoramento**: `/health` + logs estruturados em JSON de cada requisição (método, rota, status e tempo em ms), visíveis no painel **Logs** e **Metrics** do Render. Também pode ser ligado a um monitor externo de disponibilidade, como o UptimeRobot.
