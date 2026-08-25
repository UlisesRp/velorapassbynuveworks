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
  const authUserName = $("#authUserName");
  const authUserEmail = $("#authUserEmail");
  const logoutButton = $("#logoutButton");
  const togglePassword = $("#togglePassword");

  const editUserButton = $("#editUserButton");
  const profileModal = $("#profileModal");
  const profileModalClose = $("#profileModalClose");
  const profileCancel = $("#profileCancel");
  const profileForm = $("#profileForm");
  const profileDisplayName = $("#profileDisplayName");
  const profileEmail = $("#profileEmail");
  const profileError = $("#profileError");
  const profileSave = $("#profileSave");

  let currentSession = null;
  let currentProfile = null;

  function fallbackName(user) {
    const metadataName = String(user?.user_metadata?.display_name || "").trim();
    if (metadataName) return metadataName;
    const email = String(user?.email || "");
    return email.includes("@") ? email.split("@")[0] : "Usuario";
  }

  function setLoginBusy(isBusy, text = "Entrando…") {
    loginButton.disabled = isBusy;
    loginButton.textContent = isBusy ? text : "Entrar a Velora Pass";
  }

  function showError(message = "") {
    loginError.textContent = message;
    loginError.classList.toggle("show", Boolean(message));
  }

  function showProfileError(message = "") {
    profileError.textContent = message;
    profileError.classList.toggle("show", Boolean(message));
  }

  function closeProfileModal() {
    profileModal?.classList.remove("open");
    showProfileError("");
    if (profileSave) {
      profileSave.disabled = false;
      profileSave.textContent = "Guardar cambios";
    }
  }

  function showLogin(message = "") {
    currentSession = null;
    currentProfile = null;
    document.body.classList.remove("auth-ready");
    document.body.classList.add("auth-pending");
    authScreen.classList.add("show");
    appShell.setAttribute("aria-hidden", "true");
    authStatus.textContent = message;
    authStatus.hidden = !message;
    authUserName.textContent = "—";
    authUserEmail.textContent = "—";
    closeProfileModal();
    setLoginBusy(false);
  }

  async function loadOwnProfile(user) {
    const fallback = { id:user.id, display_name:fallbackName(user), email:user.email || "" };
    const { data, error } = await db.from("profiles").select("id,display_name,email").eq("id", user.id).maybeSingle();
    if (error) {
      console.warn("No se pudo leer el perfil; se usará el nombre de respaldo.", error);
      return fallback;
    }
    if (data) return data;

    const { data: inserted, error: insertError } = await db.from("profiles").upsert({
      id:user.id,
      display_name:fallback.display_name,
      email:fallback.email,
      updated_at:new Date().toISOString()
    }).select("id,display_name,email").single();

    if (insertError) {
      console.warn("No se pudo crear el perfil; se usará el nombre de respaldo.", insertError);
      return fallback;
    }
    return inserted;
  }

  async function showApp(session) {
    currentSession = session;
    const user = session?.user;
    const email = user?.email || "Usuario autorizado";
    currentProfile = await loadOwnProfile(user);
    authUserName.textContent = currentProfile?.display_name || fallbackName(user);
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

  function openProfileModal() {
    if (!currentSession?.user) return;
    profileDisplayName.value = currentProfile?.display_name || fallbackName(currentSession.user);
    profileEmail.value = currentSession.user.email || "";
    showProfileError("");
    profileModal.classList.add("open");
    setTimeout(() => profileDisplayName.focus(), 50);
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
    if (error) { showLogin(); showError(error.message); return; }
    if (data.session) await showApp(data.session); else showLogin();
    db.auth.onAuthStateChange(async (_event, session) => {
      if (session) await showApp(session); else showLogin();
    });
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showError("");
    const email = loginEmail.value.trim();
    const password = loginPassword.value;
    if (!email || !password) { showError("Escribe correo y contraseña."); return; }
    setLoginBusy(true);
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) { setLoginBusy(false); showError(friendlyAuthError(error)); return; }
    loginPassword.value = "";
    await showApp(data.session);
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

  editUserButton.addEventListener("click", openProfileModal);
  profileModalClose.addEventListener("click", closeProfileModal);
  profileCancel.addEventListener("click", closeProfileModal);
  profileModal.addEventListener("click", (event) => { if (event.target === profileModal) closeProfileModal(); });

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentSession?.user) return;
    const displayName = profileDisplayName.value.trim();
    if (displayName.length < 2) { showProfileError("Escribe un nombre de al menos 2 caracteres."); return; }

    showProfileError("");
    profileSave.disabled = true;
    profileSave.textContent = "Guardando…";
    const user = currentSession.user;

    const { error: profileUpdateError } = await db.from("profiles").upsert({
      id:user.id,
      display_name:displayName,
      email:user.email || "",
      updated_at:new Date().toISOString()
    });

    if (profileUpdateError) {
      profileSave.disabled = false;
      profileSave.textContent = "Guardar cambios";
      showProfileError(profileUpdateError.message || "No se pudo guardar el usuario.");
      return;
    }

    const { error: metadataError } = await db.auth.updateUser({ data:{ display_name:displayName } });
    if (metadataError) console.warn("Perfil guardado; no se pudo actualizar metadata.", metadataError);

    currentProfile = { id:user.id, display_name:displayName, email:user.email || "" };
    authUserName.textContent = displayName;
    window.dispatchEvent(new CustomEvent("velora:user-profile-updated", { detail:{ userId:user.id, displayName } }));
    closeProfileModal();
  });

  initializeAuth();
})();
