# Portal de Cadastro de Desembargos - IDAF
---
## Preparativos
1. Instalar as dependências do Node rodando o seguinte comando na pasta `./backend`:
`npm install`

2. Adicionar o arquivo `.env` na pasta `./backend`, preenchendo-o com as seguintes informações relativas ao seu banco de dados:

```
    DB_HOST=IPdoBanco
    DB_PORT=PortaDoBanco
    DB_NAME=NomeDaDatabase
    DB_USER=UsuarioDoBanco
    DB_PASS=SenhaDoUsuarioDoBanco
    PORT=PortaQueVaiRodarOServidor
    SECRET=SenhaSecretaParaLogin
```

3. Confira os arquivos `.js` em `./backend/src/services`:
- Cada um dos arquivos possui ums variável que referencia o nome da tabela no Banco de Dados em que as queries serão realizadas. Por exemplo, em `desembargoService.js`:

```
const desembargoTable = 'desembargos_test';
```

- A tabela em que as queries de desembargo serão realizadas será a tabela ***desemabargos_test***. Altere para que fique coerente com o seu Banco de Dados em todos os arquivos em `./backend/src/services`.

4. A estrutura utulizada (em PostgreSQL) para as tabelas no BD nos ambientes de teste foram as seguintes:
- Tabela de Usuários:
```
CREATE TABLE USERS_TEST(
	ID BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	USERNAME TEXT UNIQUE,
	PASSWORD_HASH TEXT,
	ROLE TEXT CHECK(ROLE IN ('COMUM', 'GERENTE')),
	CREATED_AT TIMESTAMPTZ DEFAULT NOW(),
	NAME TEXT,
	POSITION TEXT
);
```

- Tabela de Desembargos:
```
CREATE TABLE DESEMBARGOS_TEST(
	ID BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	NUMERO_EMBARGO INTEGER,
	SERIE_EMBARGO CHAR CHECK(SERIE_EMBARGO IN ('A','B','C','D','E')),
	PROCESSO_SIMLAM TEXT,
	NUMERO_SEP BIGINT,
	NUMERO_EDOCS TEXT,
	COORDENADA_X DOUBLE PRECISION,
	COORDENADA_Y DOUBLE PRECISION,
	NOME_AUTUADO TEXT,
	AREA_DESEMBARGADA DOUBLE PRECISION,
	TIPO_DESEMBARGO TEXT CHECK(TIPO_DESEMBARGO IN('TOTAL','PARCIAL','INDEFERIMENTO')),
	DATA_DESEMBARGO DATE,
	RESPONSAVEL_DESEMBARGO TEXT NOT NULL REFERENCES USERS_TEST(USERNAME),
	DESCRICAO TEXT,
	STATUS TEXT CHECK(STATUS IN('APROVADO','EM ANÁLISE', 'REVISÃO PENDENTE')),
	APROVADO_POR TEXT REFERENCES USERS_TEST(USERNAME)
);
```

- Tabela de Log de Usuários:
```
CREATE TABLE USER_LOGS(
	ID BIGSERIAL PRIMARY KEY,
	USERNAME TEXT NOT NULL REFERENCES USERS_TEST(USERNAME),
	ACTION TEXT NOT NULL,
	DETAILS JSONB,
	IP INET,
	USER_AGENT TEXT,
	CREATED_AT TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- Tabela de Embargos:
```
CREATE TABLE EMBARGOS(
    N_UIF_EMB INTEGER,
    NORTHING DOUBLE PRECISION,
    EASTING DOUBLE PRECISION,
    PROCESSO TEXT,
    SEP_EDOCS TEXT
);
```

5. Para cadastrar os Usuários, pode-se utilizar o script em `./backend/src/config/setupUsers.js`.
- O script tentará criar a tabela `USERS_TEST` caso ela não exista. Para impedir esse funcionamento, basta comentar a linha `await runMigration();`.
- Em seguida, o script irá cadastrar os usuários descritos em cada id, seguindo o padrão `NomeDeUsuario, SenhaDeUsuario, CargoDoUsuario, NomeDoUSuario, CargoDoUsuario`
- O cargo do usuário deve ser `GERENTE` ou `COMUM`.
- É importante cadastrar os usuários por meio do script, em função da criptografia aplicada. 