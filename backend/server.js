require('dotenv').config();

const express = require('express');
const cors = require('cors');
const pool = require('./db');
const authRoutes = require('./routes/auth.routes');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('Servidor Pingo de Gente está funcionando.');
});

app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database,
        NOW() AS server_time
    `);

    res.json({
      ok: true,
      message: 'API conectada ao Neon com sucesso.',
      database: result.rows[0].database,
      serverTime: result.rows[0].server_time
    });
  } catch (error) {
    console.error('Erro ao conectar ao Neon:', error.message);

    res.status(500).json({
      ok: false,
      message: 'Não foi possível conectar ao Neon.'
    });
  }
});
app.get('/api/produtos', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM products
       WHERE ativo = true
       ORDER BY criado_em DESC`
    );

    const produtos = [];

    for (const produto of result.rows) {
      `SELECT ordem, imagem_base64, estoque, tamanho
 FROM product_photos
 WHERE product_id = $1
 ORDER BY ordem ASC`,
        [produto.id]
      );

     let fotos = fotosResult.rows.map(foto => ({
  ordem: foto.ordem,
  url: foto.imagem_base64,
  estoque: Number(foto.estoque) || 0,
  tamanho: foto.tamanho || ''
}));

      if (fotos.length === 0 && produto.foto_url) {
  fotos = [{
    ordem: 0,
    url: produto.foto_url,
    estoque: 0,
    tamanho: ''
  }];
}

      produtos.push({
        ...produto,
        fotos
      });
    }

    res.json(produtos);
  } catch (error) {
    console.error('Erro ao listar produtos:', error.message);

    res.status(500).json({
      erro: 'Erro ao listar produtos.'
    });
  }
});

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const pastaUploads = path.join(__dirname, 'uploads');

if (!fs.existsSync(pastaUploads)) {
  fs.mkdirSync(pastaUploads);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, pastaUploads),
  filename: (req, file, cb) => {
    const nome = Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
    cb(null, nome);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Envie apenas imagens.'));
    }
  }
});
const jwt = require('jsonwebtoken');

function verificarAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.replace('Bearer ', '').trim();

  if (!token) {
    return res.status(401).json({
      erro: 'Token não informado.'
    });
  }

  let payload;

  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({
      erro: 'Token inválido ou expirado.'
    });
  }

  if (!['admin', 'lojista'].includes(payload.role)) {
    return res.status(403).json({
      erro: 'Acesso restrito a administradores e lojistas.'
    });
  }

  req.usuario = payload;
  next();
}
function verificarPerfil(perfisPermitidos) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.replace('Bearer ', '').trim();

    if (!token) {
      return res.status(401).json({
        ok: false,
        message: 'Token não informado.'
      });
    }

    let payload;

    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({
        ok: false,
        message: 'Token inválido ou expirado.'
      });
    }

    if (!perfisPermitidos.includes(payload.role)) {
      return res.status(403).json({
        ok: false,
        message: 'Acesso restrito.'
      });
    }

    req.usuario = payload;
    next();
  };
}
app.use('/uploads', express.static(pastaUploads));
async function gerarCodigoUnico() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const numeros = '0123456789';

  const gerar = () => {
    let codigo = '';

    for (let i = 0; i < 3; i++) {
      codigo += letras[Math.floor(Math.random() * letras.length)];
    }

    for (let i = 0; i < 4; i++) {
      codigo += numeros[Math.floor(Math.random() * numeros.length)];
    }

    return codigo;
  };

  let codigo = gerar();
  let tentativas = 0;

  while (tentativas < 50) {
    const existe = await pool.query(
      'SELECT 1 FROM products WHERE codigo = $1 LIMIT 1',
      [codigo]
    );

    if (existe.rowCount === 0) {
      return codigo;
    }

    codigo = gerar();
    tentativas++;
  }

  throw new Error('Não foi possível gerar um código único.');
}

app.post('/api/produtos', verificarAdmin, async (req, res) => {
  try {
    const {
      nome,
      categoria,
      precoReal,
      precoPromocional,
      estoque,
      fotoUrl
    } = req.body;

    if (!nome || !categoria) {
      return res.status(400).json({
        erro: 'Nome e categoria são obrigatórios.'
      });
    }

    const codigoFinal = await gerarCodigoUnico();

    const result = await pool.query(
      `INSERT INTO products
        (nome, codigo, categoria, preco_real, preco_promocional, estoque, foto_url, ativo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING *`,
      [
        nome,
        codigoFinal,
        categoria,
        precoReal,
        precoPromocional,
        estoque,
        fotoUrl || null
      ]
    );
const produtoId = result.rows[0].id;

const fotosParaSalvar = Array.isArray(req.body.fotos)
  ? req.body.fotos
      .map(foto => ({
        imagem: foto.imagem || foto,
        estoque: Number(foto.estoque) || 0,
        tamanho: foto.tamanho || ''
      }))
      .filter(foto => Boolean(foto.imagem))
  : [];
for (let i = 0; i < fotosParaSalvar.length; i++) {
  await pool.query(
    `INSERT INTO product_photos
      (product_id, imagem_base64, ordem, estoque, tamanho)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      produtoId,
      fotosParaSalvar[i].imagem,
      i,
      fotosParaSalvar[i].estoque,
      fotosParaSalvar[i].tamanho
    ]
  );
}
res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('Erro ao cadastrar produto:', error.message);

    res.status(500).json({
      erro: 'Erro ao cadastrar produto.'
    });
  }
});

app.put('/api/produtos/:id', verificarAdmin, async (req, res) => {
  try {
    const {
      nome,
      codigo,
      categoria,
      precoReal,
      precoPromocional,
      estoque,
      fotoUrl,
      fotos
    } = req.body;

    if (!nome || !codigo || !categoria) {
      return res.status(400).json({
        erro: 'Nome, código e categoria são obrigatórios.'
      });
    }

   const fotosFinais = Array.isArray(fotos)
  ? fotos
      .map(foto => ({
        imagem: typeof foto === 'string' ? foto : foto.imagem,
        estoque: Number(foto.estoque) || 0,
        tamanho: foto.tamanho || ''
      }))
      .filter(foto => Boolean(foto.imagem))
  : [];
    const fotoPrincipal = fotosFinais[0]?.imagem || fotoUrl || null;

    const result = await pool.query(
      `UPDATE products
       SET nome = $1,
           codigo = $2,
           categoria = $3,
           preco_real = $4,
           preco_promocional = $5,
           estoque = $6,
           foto_url = $7,
           ativo = true
       WHERE id = $8
       RETURNING *`,
      [
        nome,
        codigo,
        categoria,
        precoReal,
        precoPromocional,
        estoque,
        fotoPrincipal,
        req.params.id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        erro: 'Produto não encontrado.'
      });
    }

    await pool.query(
      'DELETE FROM product_photos WHERE product_id = $1',
      [req.params.id]
    );

    for (let i = 0; i < fotosFinais.length; i++) {
  await pool.query(
    `INSERT INTO product_photos
      (product_id, imagem_base64, ordem, estoque, tamanho)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      req.params.id,
      fotosFinais[i].imagem,
      i,
      fotosFinais[i].estoque,
      fotosFinais[i].tamanho
    ]
  );
}

    const fotosAtualizadas = await pool.query(
  `SELECT id, imagem_base64 AS url, ordem, estoque, tamanho
   FROM product_photos
   WHERE product_id = $1
   ORDER BY ordem`,
  [req.params.id]
);

    res.json({
      ...result.rows[0],
      fotos: fotosAtualizadas.rows
    });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error.message);

    if (error.code === '23505') {
      return res.status(409).json({
        erro: 'Já existe outro produto com este código.'
      });
    }

    res.status(500).json({
      erro: 'Erro ao atualizar produto.'
    });
  }
});

app.patch('/api/produtos/:id/publicar', verificarAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE products
       SET ativo = true
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        erro: 'Produto não encontrado.'
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao publicar produto:', error.message);

    res.status(500).json({
      erro: 'Erro ao publicar produto.'
    });
  }
});

app.delete('/api/produtos/:id', verificarAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM products WHERE id = $1',
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        erro: 'Produto não encontrado.'
      });
    }

    res.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao excluir produto:', error.message);

    res.status(500).json({
      erro: 'Erro ao excluir produto.'
    });
  }
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor iniciado na porta ${PORT}`);
});