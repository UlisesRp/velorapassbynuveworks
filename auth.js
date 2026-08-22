(() => {
  const $ = (selector) => document.querySelector(selector);

  const authScreen = $("#authScreen");
  const appShell = $("#appShell");
  const loginForm = $("#loginForm");
  const loginEmail = $("#loginEmail");
  const loginPassword = $("#loginPassword");
  const loginButton = $("#loginButton");
  const loginError = $("#loginError");
  const authStatus = $("#authStatus");
  const authUserEmail = $("#authUserEmail");
  const logoutButton = $("#logoutButton");
  const togglePassword = $("#togglePassword");

  function setLoginBusy(isBusy, text = "Entrando…") {
    loginButton.disabled = isBusy;
    loginButton.textContent = isBusy ? text : "Entrar a Velora Pass";
  }

  function showError(message = "") {
    loginError.textContent = message;
    loginError.classList.toggle("show", Boolean(message));
  }

  function showLogin(message = "") {
    document.body.classList.remove("auth-ready");
    document.body.classList.add("auth-pending");
    authScreen.classList.add("show");
    appShell.setAttribute("aria-hidden", "true");
    authStatus.textContent = message;
    authStatus.hidden = !message;
    authUserEmail.textContent = "—";
    setLoginBusy(false);
  }

  function showApp(session) {
    const email = session?.user?.email || "Usuario autorizado";
    authUserEmail.textContent = email;
    authScreen.classList.remove("show");
    document.body.classList.remove("auth-pending");
    document.body.classList.add("auth-ready");
    appShell.removeAttribute("aria-hidden");
    showError("");
  }

  function friendlyAuthError(error) {
    const msg = String(error?.message || "").toLowerCase();
    if (msg.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
    if (msg.includes("email not confirmed")) return "Ese correo todavía no está confirmado en Supabase.";
    if (msg.includes("rate limit")) return "Demasiados intentos. Espera un momento y vuelve a intentar.";
    return error?.message || "No pudimos iniciar sesión. Revisa tus datos e intenta de nuevo.";
  }

  async function initializeAuth() {
    if (typeof db === "undefined" || !db?.auth) {
      showLogin();
      showError("No se pudo cargar Supabase. Revisa supabase-client.js y la conexión a internet.");
      return;
    }

    authStatus.hidden = false;
    authStatus.textContent = "Comprobando sesión…";

    const { data, error } = await db.auth.getSession();
    if (error) {
      showLogin();
      showError(error.message);
      return;
    }

    if (data.session) showApp(data.session);
    else showLogin();

    db.auth.onAuthStateChange((_event, session) => {
      if (session) showApp(session);
      else showLogin();
    });
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showError("");

    const email = loginEmail.value.trim();
    const password = loginPassword.value;
    if (!email || !password) {
      showError("Escribe correo y contraseña.");
      return;
    }

    setLoginBusy(true);
    const { data, error } = await db.auth.signInWithPassword({ email, password });

    if (error) {
      setLoginBusy(false);
      showError(friendlyAuthError(error));
      return;
    }

    loginPassword.value = "";
    showApp(data.session);
  });

  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = "Saliendo…";
    const { error } = await db.auth.signOut();
    logoutButton.disabled = false;
    logoutButton.textContent = "Cerrar sesión";
    if (error) showError(error.message);
  });

  togglePassword.addEventListener("click", () => {
    const showing = loginPassword.type === "text";
    loginPassword.type = showing ? "password" : "text";
    togglePassword.textContent = showing ? "Ver" : "Ocultar";
    togglePassword.setAttribute("aria-label", showing ? "Mostrar contraseña" : "Ocultar contraseña");
  });

  initializeAuth();
})();
