const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

function criarRespostaUsuario(user) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    telefone: user.telefone,
    cep: user.cep,
    rua: user.rua,
    numero: user.numero,
    bairro: user.bairro,
    cidade: user.cidade,
    role: user.role,
    createdAt: user.created_at || null
  };
}

/*
  POST /api/auth/register

  Cadastro público:
  todo usuário novo é criado obrigatoriamente como "cliente".
*/
router.post('/register', async (req, res) => {
  try {
    const {
      nome,
      email,
      senha,
      telefone = null,
      cep = null,
      rua = null,
      numero = null,
      bairro = null,
      cidade = null
    } = req.body;

    const nomeLimpo = typeof nome === 'string' ? nome.trim() : '';
    const emailLimpo = typeof email === 'string'
      ? email.trim().toLowerCase()
      : '';
    const senhaTexto = typeof senha === 'string' ? senha : '';

    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (nomeLimpo.length < 3) {
      return res.status(400).json({
        ok: false,
        message: 'Informe um nome com pelo menos 3 caracteres.'
      });
    }

    if (!emailValido.test(emailLimpo)) {
      return res.status(400).json({
        ok: false,
        message: 'Informe um e-mail válido.'
      });
    }

    if (senhaTexto.length < 6) {
      return res.status(400).json({
        ok: false,
        message: 'A senha deve ter pelo menos 6 caracteres.'
      });
    }

    const userExists = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [emailLimpo]
    );

    if (userExists.rowCount > 0) {
      return res.status(409).json({
        ok: false,
        message: 'Este e-mail já está cadastrado.'
      });
    }

    const passwordHash = await bcrypt.hash(senhaTexto, 12);

    const result = await pool.query(
      `INSERT INTO users
        (
          nome,
          email,
          password_hash,
          telefone,
          cep,
          rua,
          numero,
          bairro,
          cidade,
          role
        )
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING
        id,
        nome,
        email,
        telefone,
        cep,
        rua,
        numero,
        bairro,
        cidade,
        role,
        created_at`,
      [
        nomeLimpo,
        emailLimpo,
        passwordHash,
        telefone || null,
        cep || null,
        rua || null,
        numero || null,
        bairro || null,
        cidade || null,
        'cliente'
      ]
    );

    const user = result.rows[0];

    return res.status(201).json({
      ok: true,
      message: 'Conta criada com sucesso.',
      user: criarRespostaUsuario(user)
    });
  } catch (error) {
    console.error('Erro no cadastro:', error.message);

    return res.status(500).json({
      ok: false,
      message: 'Não foi possível criar a conta.'
    });
  }
});

/*
  POST /api/auth/login
*/
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    const emailLimpo = typeof email === 'string'
      ? email.trim().toLowerCase()
      : '';

    const senhaTexto = typeof senha === 'string' ? senha : '';

    if (!emailLimpo || !senhaTexto) {
      return res.status(400).json({
        ok: false,
        message: 'Informe e-mail e senha.'
      });
    }

    const result = await pool.query(
      `SELECT
        id,
        nome,
        email,
        password_hash,
        telefone,
        cep,
        rua,
        numero,
        bairro,
        cidade,
        role,
        created_at
       FROM users
       WHERE email = $1`,
      [emailLimpo]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        ok: false,
        message: 'E-mail ou senha incorretos.'
      });
    }

    const user = result.rows[0];

    const senhaCorreta = await bcrypt.compare(
      senhaTexto,
      user.password_hash
    );

    if (!senhaCorreta) {
      return res.status(401).json({
        ok: false,
        message: 'E-mail ou senha incorretos.'
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET não foi configurado no arquivo .env.');
    }

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '8h'
      }
    );

    return res.json({
      ok: true,
      message: 'Login realizado com sucesso.',
      token,
      user: criarRespostaUsuario(user)
    });
  } catch (error) {
    console.error('Erro no login:', error.message);

    return res.status(500).json({
      ok: false,
      message: 'Não foi possível realizar o login.'
    });
  }
});

/*
  PUT /api/auth/profile

  Atualiza somente o perfil da conta autenticada.
  O role não pode ser alterado por esta rota.
*/
router.put('/profile', async (req, res) => {
  try {
    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ')
      ? authorization.substring(7)
      : null;

    if (!token) {
      return res.status(401).json({
        ok: false,
        message: 'Token não informado.'
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET não foi configurado no arquivo .env.');
    }

    let payload;

    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        ok: false,
        message: 'Token inválido ou expirado.'
      });
    }

    const usuarioId = payload.sub;

    const {
      nome,
      telefone = null,
      cep = null,
      rua = null,
      numero = null,
      bairro = null,
      cidade = null
    } = req.body;

    const nomeLimpo = typeof nome === 'string' ? nome.trim() : '';

    if (nomeLimpo.length < 3) {
      return res.status(400).json({
        ok: false,
        message: 'Informe um nome com pelo menos 3 caracteres.'
      });
    }

    const result = await pool.query(
      `UPDATE users
       SET
        nome = $1,
        telefone = $2,
        cep = $3,
        rua = $4,
        numero = $5,
        bairro = $6,
        cidade = $7
       WHERE id = $8
       RETURNING
        id,
        nome,
        email,
        telefone,
        cep,
        rua,
        numero,
        bairro,
        cidade,
        role,
        created_at`,
      [
        nomeLimpo,
        telefone || null,
        cep || null,
        rua || null,
        numero || null,
        bairro || null,
        cidade || null,
        usuarioId
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Usuário não encontrado.'
      });
    }

    const user = result.rows[0];

    return res.json({
      ok: true,
      message: 'Perfil atualizado com sucesso.',
      user: criarRespostaUsuario(user)
    });
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error.message);

    return res.status(500).json({
      ok: false,
      message: 'Não foi possível atualizar o perfil.'
    });
  }
});
/*
  GET /api/auth/users

  Lista todos os usuários.
  Apenas administradores podem acessar.
*/
router.get('/users', async (req, res) => {
  try {
    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ')
      ? authorization.substring(7)
      : null;

    if (!token) {
      return res.status(401).json({
        ok: false,
        message: 'Token não informado.'
      });
    }

    let payload;

    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        ok: false,
        message: 'Token inválido ou expirado.'
      });
    }

    const adminCheck = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [payload.sub]
    );

    if (adminCheck.rowCount === 0 || adminCheck.rows[0].role !== 'admin') {
      return res.status(403).json({
        ok: false,
        message: 'Acesso restrito a administradores.'
      });
    }

    const result = await pool.query(
      `SELECT
         id,
         nome,
         email,
         telefone,
         role,
         created_at
       FROM users
       ORDER BY created_at DESC`
    );

    return res.json({
      ok: true,
      users: result.rows
    });
  } catch (error) {
    console.error('Erro ao listar usuários:', error.message);

    return res.status(500).json({
      ok: false,
      message: 'Não foi possível listar os usuários.'
    });
  }
});


/*
  PATCH /api/auth/users/:id/role

  Altera o perfil de um usuário.
  Apenas administradores podem acessar.
*/
router.patch('/users/:id/role', async (req, res) => {
  try {
    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ')
      ? authorization.substring(7)
      : null;

    if (!token) {
      return res.status(401).json({
        ok: false,
        message: 'Token não informado.'
      });
    }

    let payload;

    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        ok: false,
        message: 'Token inválido ou expirado.'
      });
    }

    const adminCheck = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [payload.sub]
    );

    if (adminCheck.rowCount === 0 || adminCheck.rows[0].role !== 'admin') {
      return res.status(403).json({
        ok: false,
        message: 'Acesso restrito a administradores.'
      });
    }

    const { id } = req.params;
    const { role } = req.body;

    const perfisPermitidos = ['cliente', 'lojista', 'admin'];

    if (!perfisPermitidos.includes(role)) {
      return res.status(400).json({
        ok: false,
        message: 'Perfil inválido.'
      });
    }

    const result = await pool.query(
      `UPDATE users
       SET role = $1
       WHERE id = $2
       RETURNING id, nome, email, role`,
      [role, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Usuário não encontrado.'
      });
    }

    return res.json({
      ok: true,
      message: 'Perfil atualizado com sucesso.',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Erro ao atualizar perfil do usuário:', error.message);

    return res.status(500).json({
      ok: false,
      message: 'Não foi possível atualizar o perfil.'
    });
  }
});
module.exports = router;