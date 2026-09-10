const menuToggle = document.querySelector('.menu-toggle');
const siteMenu = document.querySelector('#site-menu');

menuToggle?.addEventListener('click', () => {
  const abierto = siteMenu.classList.toggle('is-open');
  menuToggle.setAttribute('aria-expanded', String(abierto));
});

siteMenu?.addEventListener('click', (evento) => {
  if (evento.target.closest('a')) {
    siteMenu.classList.remove('is-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
  }
});

const formulario = document.querySelector('#contact-form');
const estado = document.querySelector('#contact-status');

function mostrarEstado(mensaje, error = false) {
  estado.textContent = mensaje;
  estado.hidden = false;
  estado.classList.toggle('is-error', error);
}

formulario?.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const boton = formulario.querySelector('button[type="submit"]');
  boton.disabled = true;
  estado.hidden = true;
  try {
    const configuracion = await window.HABITA_CONFIG_PROMISE;
    const datos = Object.fromEntries(new FormData(formulario));
    const respuesta = await fetch(`${configuracion.apiUrl}/contacto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
    const cuerpo = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(cuerpo.error?.mensaje ?? 'No pudimos enviar la consulta.');
    formulario.reset();
    mostrarEstado(cuerpo.mensaje ?? 'Recibimos tu consulta. Te vamos a contactar pronto.');
  } catch (error) {
    mostrarEstado(error.message, true);
  } finally {
    boton.disabled = false;
  }
});
