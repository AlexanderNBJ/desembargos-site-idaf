const usuarioService = require('../services/usuarioService');

exports.listarUsuarios = async (req, res) => {
  try {
    const usuarios = await usuarioService.listarUsuarios();
    res.json({ success: true, data: usuarios });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erro ao listar usuários' });
  }
};

exports.me = async (req, res) => {
  try {
    // req.user deve ser preenchido pelo requireAuth (decodificando o JWT local)
    const logged = req.user || {};
    // tenta por id primeiro (caso nosso JWT tenha id e exista no BD)
    if (logged.id) {
      const usuario = await usuarioService.buscarUsuarioPorId(logged.id);
      if (usuario) {
        return res.json({ success: true, data: usuario });
      }
    }

    // tenta por username (email)
    if (logged.username) {
      const usuario2 = await usuarioService.buscarUsuarioPorUsername(logged.username);
      if (usuario2) {
        return res.json({ success: true, data: usuario2 });
      }
    }

    // se não existir usuário local, retorna dados construídos a partir do token (mínimo necessário)
    const fallback = {
      id: logged.id || null,
      username: logged.username || logged.email || null,
      name: logged.name || logged.username || logged.email || '-',
      position: logged.position || (logged.role ? String(logged.role) : '')
    };

    return res.json({ success: true, data: fallback });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erro ao buscar usuário logado' });
  }
};
