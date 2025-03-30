require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const path = require("path");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();
app.use(express.json());

// Configuração explícita do CORS
app.use(cors({
    origin: "http://127.0.0.1:5500", // Permite especificamente essa origem
    methods: ["GET", "POST", "PUT", "DELETE"],    // Métodos permitidos
    allowedHeaders: ["Content-Type"] // Cabeçalhos permitidos
}));

app.use(express.static("."));

// Função conexão com o banco PostgreSQL
async function connect() {
    if (global.connection) return global.connection.connect();

    const pool = new Pool({
        connectionString: process.env.CONNECTION_STRING,
        ssl: { rejectUnauthorized: false },
    });

    try {
        const client = await pool.connect();
        console.log("Criou o pool de conexão");
        const res = await client.query("SELECT NOW()");
        console.log("Teste de conexão:", res.rows[0]);
        client.release();
        global.connection = pool;
        return pool.connect();
    } catch (err) {
        console.error("Erro ao conectar ao banco:", err.message);
        throw err;
    }
}
// Conexão com o banco Firebase
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

app.post("/api/dados-pessoais", async (req, res) => {
    const { nome, sobrenome, data_nascimento, cpf, usuario } = req.body;

    try {
        const client = await connect();
        await client.query("BEGIN");

        // Inserção no PostgreSQL
        const postgresResult = await client.query(`
            INSERT INTO schema1.dados_pessoais (nome, sobrenome, data_nascimento, cpf, usuario) 
            VALUES ($1, $2, $3, $4, $5) RETURNING *
        `, [nome, sobrenome, data_nascimento, cpf, usuario]);

        // Inserção no Firestore
        const firebaseResult = await db.collection("usuarios").doc(usuario).collection("dados_pessoais").doc(usuario).set({
            primeiro_nome: nome,
            sobrenome: sobrenome,
            data_nascimento: data_nascimento,
            cpf: cpf
        });

        await client.query("COMMIT");
        res.status(201).json({ postgres: postgresResult.rows[0], firebase: firebaseResult });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Erro ao criar dados pessoais:", err);
        res.status(500).json({ error: "Erro ao criar dados pessoais: " + err.message });
    }
});

// Nova rota para atualizar dados pessoais
app.put("/api/dados-pessoais", async (req, res) => {
    console.log("Recebendo requisição de atualização:", req.body);
    const { nome, sobrenome, data_nascimento, cpf, usuario } = req.body;

    try {
        const client = await connect();
        const query = `
            UPDATE schema1.dados_pessoais
            SET nome = $1, sobrenome = $2, data_nascimento = $3, cpf = $4
            WHERE usuario = $5
            RETURNING *`;
        const values = [nome, sobrenome, data_nascimento, cpf, usuario];
        console.log("Executando query de atualização com valores:", values);
        const result = await client.query(query, values);
        console.log("Resultado da query de atualização:", result.rows[0]);
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("Erro ao atualizar dados pessoais:", err.message, err.stack);
        res.status(500).json({ error: "Erro ao atualizar dados pessoais: " + err.message });
    }
});

// Rota para apagar dados pessoais
app.delete("/api/dados-pessoais/:usuario", async (req, res) => {
    const usuario = req.params.usuario;

    if (!usuario) {
        return res.status(400).json({ error: "O campo 'usuario' é obrigatório" });
    }

    try {
        const client = await connect();
        const query = `
            DELETE FROM schema1.dados_pessoais
            WHERE usuario = $1
            RETURNING *`;
        const values = [usuario];

        const result = await client.query(query, values);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        res.status(200).json({ message: "Dados pessoais apagados com sucesso", deleted: result.rows[0] });
    } catch (err) {
        console.error("Erro ao apagar dados pessoais:", err);
        res.status(500).json({ error: "Erro ao apagar dados pessoais: " + err.message });
    }
});

// Rota para salvar contato
app.post("/api/contato", async (req, res) => {
    console.log("Recebendo requisição:", req.body);
    const { login, email, telefone, redes_sociais } = req.body;

   

    try {
        const client = await connect();
        const query = `
            INSERT INTO schema1.contato (login, email, telefone, redes_sociais)
            VALUES ($1, $2, $3, $4) RETURNING *`;
        const values = [login, email, telefone, redes_sociais];

        console.log("Executando query com valores:", values);
        const result = await client.query(query, values);

        console.log("Resultado da query:", result.rows[0]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("Erro ao salvar contato:", err);
        res.status(500).json({ error: "Erro ao salvar contato: " + err.message });
    }
});

// Rota para atualizar contato
app.put("/api/contato", async (req, res) => {
    console.log("Recebendo requisição de atualização de contato:", req.body);
    const { login, email, telefone, redes_sociais } = req.body;

  
    try {
        const client = await connect();
        const query = `
            UPDATE schema1.contato
            SET email = $2, telefone = $3, redes_sociais = $4
            WHERE login = $1
            RETURNING *`;
        const values = [login, email, telefone, redes_sociais];

        console.log("Executando query de atualização de contato com valores:", values);
        const result = await client.query(query, values);

        console.log("Resultado da query de atualização de contato:", result.rows[0]);
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("Erro ao atualizar contato:", err);
        res.status(500).json({ error: "Erro ao atualizar contato: " + err.message });
    }
});

// Rota para apagar contato
app.delete("/api/contato/:login", async (req, res) => {
    const login = req.params.login;

    if (!login) {
        return res.status(400).json({ error: "O campo 'login' é obrigatório" });
    }

    try {
        const client = await connect();
        const query = `
            DELETE FROM schema1.contato
            WHERE login = $1
            RETURNING *`;
        const values = [login];

        const result = await client.query(query, values);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Contato não encontrado" });
        }

        res.status(200).json({ message: "Contato apagado com sucesso", deleted: result.rows[0] });
    } catch (err) {
        console.error("Erro ao apagar contato:", err);
        res.status(500).json({ error: "Erro ao apagar contato: " + err.message });
    }
});

// Rota para salvar salário
app.post("/api/salario", async (req, res) => {
    console.log("Recebendo requisição:", req.body);
    const { login, transacao } = req.body;


    try {
        const client = await connect();
        const query = `
            INSERT INTO schema1.salario (login, transacao)
            VALUES ($1, $2) RETURNING *`;
        const values = [login, transacao];

        console.log("Executando query com valores:", values);
        const result = await client.query(query, values);

        console.log("Resultado da query:", result.rows[0]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("Erro ao salvar transacao:", err);
        res.status(500).json({ error: "Erro ao salvar contato: " + err.message });
    }
});

// Rota para atualizar salário
app.put("/api/salario", async (req, res) => {
    console.log("Recebendo requisição de atualização de salário:", req.body);
    const { login, transacao } = req.body;

    try {
        const client = await connect();
        const query = `
            UPDATE schema1.salario
            SET transacao = $2
            WHERE login = $1
            RETURNING *`;
        const values = [login, transacao];

        console.log("Executando query de atualização de salário com valores:", values);
        const result = await client.query(query, values);

        console.log("Resultado da query de atualização de salário:", result.rows[0]);
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("Erro ao atualizar salário:", err);
        res.status(500).json({ error: "Erro ao atualizar salário: " + err.message });
    }
});

// Rota para apagar salário
app.delete("/api/salario/:login", async (req, res) => {
    const login = req.params.login;

    if (!login) {
        return res.status(400).json({ error: "O campo 'login' é obrigatório" });
    }

    try {
        const client = await connect();
        const query = `
            DELETE FROM schema1.salario
            WHERE login = $1
            RETURNING *`;
        const values = [login];

        const result = await client.query(query, values);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Salário não encontrado" });
        }

        res.status(200).json({ message: "Salário apagado com sucesso", deleted: result.rows[0] });
    } catch (err) {
        console.error("Erro ao apagar salário:", err);
        res.status(500).json({ error: "Erro ao apagar salário: " + err.message });
    }
});

// Rota para buscar todos os dados pessoais
app.get("/api/dados-pessoais", async (req, res) => {
    try {
        const client = await connect();
        const query = "SELECT * FROM schema1.dados_pessoais";
        const result = await client.query(query);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Erro ao buscar dados pessoais:", err);
        res.status(500).json({ error: "Erro ao buscar dados pessoais: " + err.message });
    }
});

// Rota para buscar todos os contatos
app.get("/api/contato", async (req, res) => {
    try {
        const client = await connect();
        const query = "SELECT * FROM schema1.contato";
        const result = await client.query(query);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Erro ao buscar contatos:", err);
        res.status(500).json({ error: "Erro ao buscar contatos: " + err.message });
    }
});

// Rota para buscar todos os salários
app.get("/api/salario", async (req, res) => {
    try {
        const client = await connect();
        const query = "SELECT * FROM schema1.salario";
        const result = await client.query(query);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Erro ao buscar salários:", err);
        res.status(500).json({ error: "Erro ao buscar salários: " + err.message });
    }
});

// Rota para servir o HTML
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});



const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Sistema rodando na porta ${port}...`);
});
