// Thin wrapper around Supabase Auth. Every gated page calls Auth.requireUser() first thing.
const Auth = (() => {
  async function getSession() {
    const { data } = await supabaseClient.auth.getSession();
    return data.session;
  }

  // Redirects to the login page if there's no active session; otherwise returns the user
  // and wires up the current page's logout button (id="logout-btn"), if present.
  async function requireUser() {
    const session = await getSession();
    if (!session) {
      const redirect = encodeURIComponent(window.location.pathname.split("/").pop());
      window.location.href = `login.html?redirect=${redirect}`;
      return null;
    }

    const nameEl = document.getElementById("current-user-name");
    if (nameEl) nameEl.textContent = session.user.user_metadata?.name || session.user.email;

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) logoutBtn.addEventListener("click", signOut);

    return session.user;
  }

  async function signOut() {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  }

  return { getSession, requireUser, signOut };
})();
