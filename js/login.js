(async function () {
  const params = new URLSearchParams(window.location.search);
  const redirectTarget = params.get("redirect") || "task-dashboard.html";

  // Already signed in? Skip straight past the login form.
  const { data: existing } = await supabaseClient.auth.getSession();
  if (existing.session) {
    window.location.href = redirectTarget;
    return;
  }

  const form = document.getElementById("login-form");
  const headingEl = document.getElementById("auth-heading");
  const errorEl = document.getElementById("auth-error");
  const emailEl = document.getElementById("email");
  const passwordEl = document.getElementById("password");
  const toggleBtn = document.getElementById("toggle-mode-btn");
  const submitBtn = document.getElementById("submit-btn");

  let mode = "login"; // or "signup"

  function setMode(next) {
    mode = next;
    const isSignup = mode === "signup";
    headingEl.textContent = isSignup ? "Sign up" : "Log in";
    submitBtn.textContent = isSignup ? "Sign up" : "Log in";
    toggleBtn.textContent = isSignup ? "Already have an account? Log in" : "Need an account? Sign up";
    errorEl.hidden = true;
  }

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  toggleBtn.addEventListener("click", () => setMode(mode === "login" ? "signup" : "login"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    submitBtn.disabled = true;

    const email = emailEl.value.trim();
    const password = passwordEl.value;

    const { error } =
      mode === "signup"
        ? await supabaseClient.auth.signUp({ email, password })
        : await supabaseClient.auth.signInWithPassword({ email, password });

    submitBtn.disabled = false;

    if (error) {
      showError(error.message);
      return;
    }

    if (mode === "signup") {
      const { data: session } = await supabaseClient.auth.getSession();
      if (!session.session) {
        showError("Account created. Check your email to confirm it, then log in.");
        setMode("login");
        return;
      }
    }

    window.location.href = redirectTarget;
  });

  setMode("login");
})();
