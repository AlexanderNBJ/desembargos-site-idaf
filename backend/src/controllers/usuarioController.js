const usuarioService = require('../services/usuarioService');

exports.listarUsuarios = async (req, res) => {
  try {
    const usuarios = await usuarioService.listarUsuarios();
    const lista = usuarios.map(u => ({ id: u.id, nome: u.username }));
    res.json({ success: true, data: lista });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erro ao listar usuários' });
  }
};

