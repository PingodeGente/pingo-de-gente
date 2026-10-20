function atualizarInterfaceUsuario() {
  const usuarioTexto = sessionStorage.getItem('usuarioLogado');

  if (!usuarioTexto) {
    return;
  }

  const usuario = JSON.parse(usuarioTexto);

  const botaoLogin = document.querySelector('.btn-login');

  if (botaoLogin) {
    botaoLogin.textContent = usuario.nome;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  atualizarInterfaceUsuario();
});