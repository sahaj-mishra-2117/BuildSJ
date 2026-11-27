const loginBtn = document.getElementById("login-btn");
const signupBtn = document.getElementById("signup-btn");
const logoutBtn = document.getElementById("logout-btn");
const accountBtn = document.getElementById("account-btn");
const accountButtonAvatar = document.getElementById("account-button-avatar");
const accountEmail = document.getElementById("account-email");
const accountAvatar = document.getElementById("account-avatar");
const accountAvatarUpload = document.getElementById("account-avatar-upload");
const accountAvatarFile = document.getElementById("account-avatar-file");
const accountAddress = document.getElementById("account-address");
const accountAddressLink = document.getElementById("account-address-link");
const accountHomeMarker = document.getElementById("account-home-marker");
const accountHomeMarkerLink = document.getElementById("account-home-marker-link");
const accountStatus = document.getElementById("account-status");
const popup = document.getElementById("popup");
const accountCloseBtn = document.getElementById("account-close");
let accountDetailsRequest = 0;
const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const AVATAR_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function updateAvatar(element, initial, avatarUrl) {
  if (!element) return;
  element.replaceChildren(document.createTextNode(initial));

  if (typeof avatarUrl !== "string" || !avatarUrl.startsWith("https://")) return;

  const image = document.createElement("img");
  image.className = "account-avatar-image";
  image.src = avatarUrl;
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", () => image.remove(), { once: true });
  element.appendChild(image);
}

function updateButtons(session) {
  if (loginBtn) loginBtn.hidden = !!session;
  if (signupBtn) signupBtn.hidden = !!session;
  if (logoutBtn) logoutBtn.hidden = !session;
  if (accountBtn) accountBtn.hidden = !session;

  const email = session?.user?.email;
  if (accountEmail) {
    accountEmail.textContent = email || "Email unavailable";
  }
  const initial = email ? email.trim().charAt(0).toUpperCase() : "B";
  const avatarUrl = session?.user?.user_metadata?.avatar_url;
  updateAvatar(accountAvatar, initial, avatarUrl);
  updateAvatar(accountButtonAvatar, initial, avatarUrl);
}

async function uploadAccountAvatar(file) {
  if (!file) return;
  if (!Object.prototype.hasOwnProperty.call(AVATAR_TYPES, file.type)) {
    throw new Error("Choose a PNG, JPEG, or WebP image.");
  }
  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error("Choose an image smaller than 5 MB.");
  }

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError) throw sessionError;
  const session = sessionData.session;
  if (!session) throw new Error("Sign in again before changing your profile picture.");
  const previousPath = session.user.user_metadata?.avatar_path;

  const fileToken = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const objectPath = `${session.user.id}/${fileToken}-avatar.${AVATAR_TYPES[file.type]}`;
  const { error: uploadError } = await supabaseClient.storage
    .from(AVATAR_BUCKET)
    .upload(objectPath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data: currentData, error: currentError } = await supabaseClient.auth.getSession();
  if (currentError) throw currentError;
  if (!currentData.session || currentData.session.user.id !== session.user.id) {
    throw new Error("Your signed-in account changed. Please try uploading again.");
  }

  const { data: publicData } = supabaseClient.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(objectPath);
  const avatarUrl = `${publicData.publicUrl}?v=${Date.now()}`;
  const { data, error } = await supabaseClient.auth.updateUser({
    data: { avatar_url: avatarUrl, avatar_path: objectPath },
  });
  if (error) throw error;

  updateButtons({ user: data.user });

  if (
    typeof previousPath === "string" &&
    previousPath.startsWith(`${session.user.id}/`) &&
    previousPath !== objectPath
  ) {
    const { error: removeError } = await supabaseClient.storage
      .from(AVATAR_BUCKET)
      .remove([previousPath]);
    if (removeError) {
      console.warn("Could not remove the previous profile picture:", removeError.message || removeError);
    }
  }
}

accountAvatarUpload?.addEventListener("click", () => accountAvatarFile?.click());

accountAvatarFile?.addEventListener("change", async () => {
  const file = accountAvatarFile.files?.[0];
  if (!file) return;

  if (accountAvatarUpload) accountAvatarUpload.disabled = true;
  if (accountStatus) accountStatus.textContent = "Uploading profile picture…";
  try {
    await uploadAccountAvatar(file);
    if (accountStatus) accountStatus.textContent = "Profile picture updated.";
  } catch (error) {
    console.error("Could not update the profile picture:", error.message || error);
    if (accountStatus) {
      accountStatus.textContent = `Could not update the profile picture: ${error.message || "Please try again."}`;
    }
  } finally {
    accountAvatarFile.value = "";
    if (accountAvatarUpload) accountAvatarUpload.disabled = false;
  }
});

function updateHomeMarker(session) {
  if (!accountHomeMarker || !accountHomeMarkerLink) return;

  if (!session) {
    accountHomeMarker.textContent = "Sign in to see your home marker.";
    accountHomeMarkerLink.textContent = "Open map";
    return;
  }

  try {
    const stored = localStorage.getItem(`buildSJ.localHouseMarker:${session.user.id}`);
    const marker = stored ? JSON.parse(stored) : null;
    const coordinates = marker && marker.coordinates;
    const validCoordinates =
      Array.isArray(coordinates) &&
      coordinates.length === 2 &&
      Number.isFinite(coordinates[0]) &&
      Number.isFinite(coordinates[1]) &&
      coordinates[0] >= -180 &&
      coordinates[0] <= 180 &&
      coordinates[1] >= -90 &&
      coordinates[1] <= 90;

    accountHomeMarker.textContent = validCoordinates
      ? "Set on this browser"
      : "No home marker on this browser";
    accountHomeMarkerLink.textContent = validCoordinates ? "View map" : "Set on map";
  } catch (error) {
    console.error("Could not check the locally saved home marker:", error.message || error);
    accountHomeMarker.textContent = "Could not check this browser";
    accountHomeMarkerLink.textContent = "Open map";
  }
}

async function updateAccountDetails(session) {
  const request = ++accountDetailsRequest;
  if (accountStatus) accountStatus.textContent = "";
  updateHomeMarker(session);

  if (!accountAddress) return;
  if (!session) {
    accountAddress.textContent = "Sign in to see your saved address.";
    if (accountAddressLink) accountAddressLink.textContent = "Add address";
    return;
  }

  accountAddress.textContent = "Looking up your saved address…";
  if (accountAddressLink) accountAddressLink.textContent = "Update";

  try {
    if (!window.profileAddress) {
      throw new Error("The profile address service is unavailable.");
    }
    const address = await window.profileAddress.read(session);
    if (request !== accountDetailsRequest) return;

    accountAddress.textContent = address || "No saved address yet";
    if (accountAddressLink) {
      accountAddressLink.textContent = address ? "Update" : "Add address";
    }
  } catch (error) {
    if (request !== accountDetailsRequest) return;
    console.error("Could not load the account's saved address:", error.message || error);
    accountAddress.textContent = "Could not load saved address";
  }
}

function refreshAccountDetails() {
  const request = ++accountDetailsRequest;
  supabaseClient.auth.getSession()
    .then(({ data, error }) => {
      if (error) throw error;
      if (request !== accountDetailsRequest) return;
      updateAccountDetails(data.session);
    })
    .catch(error => {
      if (request !== accountDetailsRequest) return;
      console.error("Could not refresh account details:", error.message || error);
      if (accountAddress) accountAddress.textContent = "Could not load saved address";
      if (accountHomeMarker) accountHomeMarker.textContent = "Could not check this browser";
    });
}

supabaseClient.auth.getSession().then(({ data: { session }, error }) => {
  if (error) {
    console.error("Could not load the signed-in account:", error.message || error);
    return;
  }
  updateButtons(session);
  updateAccountDetails(session);
});

supabaseClient.auth.onAuthStateChange((_event, session) => {
  updateButtons(session);
  window.setTimeout(() => updateAccountDetails(session), 0);
});

logoutBtn?.addEventListener("click", async () => {
  logoutBtn.disabled = true;
  if (accountStatus) accountStatus.textContent = "";

  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    window.location.href = "home.html";
  } catch (error) {
    console.error("Could not sign out:", error.message || error);
    if (accountStatus) accountStatus.textContent = "Could not sign out. Please try again.";
  } finally {
    logoutBtn.disabled = false;
  }
});

function openPopup() {
  if (!popup) return;
  popup.style.display = "flex";
  refreshAccountDetails();
  accountCloseBtn?.focus();
}

function closePopup() {
  if (!popup) return;
  popup.style.display = "none";
  accountBtn?.focus();
}

popup?.addEventListener("click", event => {
  if (event.target === popup) closePopup();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && popup?.style.display === "flex") {
    closePopup();
  }
});
