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

exports.me = async (req, res) => {
  try {
    // assumindo que você tem o ID do usuário logado no req.user.id
    const usuario = await usuarioService.buscarUsuarioPorId(req.user.id);
    if (!usuario) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });

    res.json({ success: true, name: usuario.name, position: usuario.position });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erro ao buscar usuário logado' });
  }
};