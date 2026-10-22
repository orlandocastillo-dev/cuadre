// Corre antes de pintar la página (sin defer): va en un archivo aparte para que la política
// de seguridad (CSP) no tenga que permitir scripts escritos dentro del HTML.

// Si el botón del correo abrió la presentación en vez de la app, se pasa a la app con el mismo enlace.
if (/[?&](token_hash|code|error_description)=/.test(location.search)) location.replace("app/" + location.search);

document.documentElement.classList.add("js");
