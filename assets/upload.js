/* refillka data intake.
 *
 * Static page, real enforcement: submissions are committed to the PRIVATE
 * `refillka-uploads` repository through the GitHub Contents API using the
 * visitor's own fine-grained token. GitHub's repo permissions decide who can
 * upload — only collaborators with write access (the 1–2 authorized people)
 * succeed. The token talks to api.github.com only.
 */
(function () {
  "use strict";

  var OWNER = "Sreenivas-Sadhu-Prabhakara";
  var REPO = "refillka-uploads";
  var API = "https://api.github.com";
  var TOKEN_KEY = "rk_intake_token";
  var MAX_FILES = 5;
  var MAX_FILE_BYTES = 3 * 1024 * 1024;

  var state = { token: null, login: null };

  var $ = function (id) { return document.getElementById(id); };

  function msg(el, kind, html) {
    el.innerHTML = html ? '<div class="msg ' + kind + '">' + html + "</div>" : "";
  }

  function gh(path, options) {
    options = options || {};
    options.headers = Object.assign(
      {
        Authorization: "Bearer " + state.token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      options.headers || {}
    );
    return fetch(API + path, options).then(function (res) {
      if (res.status === 204) return null;
      return res.json().then(function (body) {
        if (!res.ok) {
          var reason = (body && body.message) || res.statusText;
          var err = new Error(reason);
          err.status = res.status;
          throw err;
        }
        return body;
      });
    });
  }

  /* ---------------- connect ---------------- */

  function connect(token, silent) {
    state.token = token;
    msg($("auth-msg"), "", "");
    return gh("/user")
      .then(function (user) {
        state.login = user.login;
        return gh("/repos/" + OWNER + "/" + REPO).then(function (repo) {
          if (!repo.permissions || !repo.permissions.push) {
            throw Object.assign(new Error("no-push"), { code: "no-push" });
          }
          $("who-avatar").src = user.avatar_url + "&s=72";
          $("who-name").textContent = user.name || user.login;
          $("who-login").textContent = "@" + user.login + " · write access verified";
          $("connect-block").style.display = "none";
          $("identity-block").style.display = "block";
          $("form-card").style.display = "block";
          $("recent-card").style.display = "block";
          if ($("remember").checked) localStorage.setItem(TOKEN_KEY, token);
          loadRecent();
        });
      })
      .catch(function (err) {
        state.token = null;
        localStorage.removeItem(TOKEN_KEY);
        if (silent) return;
        var why;
        if (err.code === "no-push") {
          why =
            "Your GitHub account is signed in, but it does <b>not</b> have write access to the " +
            "private uploads repository — uploads are limited to authorized staff. Ask the " +
            "administrator to add you as a collaborator on <b>" + REPO + "</b>.";
        } else if (err.status === 404) {
          why =
            "GitHub says the uploads repository is not visible to this token. Either the token " +
            "wasn't granted access to <b>" + REPO + "</b>, or your account isn't a collaborator.";
        } else if (err.status === 401) {
          why = "GitHub rejected the token. Check that it was copied completely and hasn't expired.";
        } else {
          why = "Could not connect: " + err.message;
        }
        msg($("auth-msg"), "err", why);
      });
  }

  /* ---------------- files ---------------- */

  function listFiles() {
    var input = $("files");
    var out = $("filelist");
    out.innerHTML = "";
    Array.prototype.forEach.call(input.files, function (f) {
      var li = document.createElement("li");
      var over = f.size > MAX_FILE_BYTES;
      li.innerHTML =
        "<span>" + (over ? "⚠ " : "📎 ") + escapeHtml(f.name) + "</span>" +
        '<span class="size">' + prettySize(f.size) + (over ? " — too big" : "") + "</span>";
      if (over) li.style.borderColor = "#ffdcdb";
      out.appendChild(li);
    });
  }

  function prettySize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result).split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function utf8ToBase64(text) {
    return btoa(unescape(encodeURIComponent(text)));
  }

  /* ---------------- submit ---------------- */

  function slugify(text) {
    return (
      text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "entry"
    );
  }

  function putFile(path, base64, message) {
    return gh("/repos/" + OWNER + "/" + REPO + "/contents/" + path, {
      method: "PUT",
      body: JSON.stringify({ message: message, content: base64 }),
    });
  }

  function submit() {
    var btn = $("submit-btn");
    var category = $("category").value;
    var title = $("title").value.trim();
    var details = $("details").value.trim();
    var files = Array.prototype.slice.call($("files").files);

    if (!title) return msg($("submit-msg"), "err", "Give the submission a title.");
    if (!details && files.length === 0)
      return msg($("submit-msg"), "err", "Add details or attach at least one file.");
    if (files.length > MAX_FILES)
      return msg($("submit-msg"), "err", "Up to " + MAX_FILES + " files per submission.");
    var oversized = files.filter(function (f) { return f.size > MAX_FILE_BYTES; });
    if (oversized.length)
      return msg($("submit-msg"), "err", "Each file must be under 3 MB. Remove: " +
        oversized.map(function (f) { return escapeHtml(f.name); }).join(", "));

    btn.disabled = true;
    msg($("submit-msg"), "info", "Uploading to the private repository…");

    var now = new Date();
    var stamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    var dir = "inbox/" + stamp + "-" + slugify(title);
    var entry = {
      category: category,
      title: title,
      details: details,
      files: files.map(function (f) { return { name: f.name, bytes: f.size, type: f.type }; }),
      submittedBy: state.login,
      submittedAt: now.toISOString(),
      source: "refillka-flow intake page",
    };
    var commitMsg = "intake: " + category + " — " + title + " (by @" + state.login + ")";

    putFile(dir + "/entry.json", utf8ToBase64(JSON.stringify(entry, null, 2)), commitMsg)
      .then(function () {
        // sequential so each commit builds on the previous tree
        return files.reduce(function (chain, file) {
          return chain.then(function () {
            return fileToBase64(file).then(function (b64) {
              return putFile(dir + "/files/" + file.name, b64, commitMsg + " · " + file.name);
            });
          });
        }, Promise.resolve());
      })
      .then(function () {
        msg(
          $("submit-msg"),
          "ok",
          "✓ Submitted. Filed as <b>" + escapeHtml(dir) + "</b> in the private repo" +
            (files.length ? " with " + files.length + " attachment(s)." : ".")
        );
        $("title").value = "";
        $("details").value = "";
        $("files").value = "";
        listFiles();
        loadRecent();
      })
      .catch(function (err) {
        msg(
          $("submit-msg"),
          "err",
          err.status === 403 || err.status === 404
            ? "GitHub refused the write — this account is not authorized to upload."
            : "Upload failed: " + escapeHtml(err.message)
        );
      })
      .finally(function () {
        btn.disabled = false;
      });
  }

  /* ---------------- recent ---------------- */

  function loadRecent() {
    var list = $("recent-list");
    gh("/repos/" + OWNER + "/" + REPO + "/contents/inbox")
      .then(function (items) {
        var dirs = (items || [])
          .filter(function (i) { return i.type === "dir"; })
          .sort(function (a, b) { return b.name.localeCompare(a.name); })
          .slice(0, 8);
        list.innerHTML = dirs.length
          ? dirs
              .map(function (d) {
                var when = d.name.slice(0, 10);
                var what = d.name.slice(20).replace(/-/g, " ");
                return (
                  "<li><span>📁 " + escapeHtml(what || d.name) + "</span>" +
                  '<span class="when">' + when + "</span></li>"
                );
              })
              .join("")
          : '<li><span>Inbox is empty — first submission starts the archive.</span></li>';
      })
      .catch(function () {
        list.innerHTML = '<li><span>Inbox is empty — first submission starts the archive.</span></li>';
      });
  }

  /* ---------------- wire up ---------------- */

  $("connect-btn").addEventListener("click", function () {
    var token = $("token").value.trim();
    if (!token) return msg($("auth-msg"), "err", "Paste your GitHub token first.");
    connect(token, false);
  });
  $("token").addEventListener("keydown", function (e) {
    if (e.key === "Enter") $("connect-btn").click();
  });
  $("disconnect-btn").addEventListener("click", function () {
    localStorage.removeItem(TOKEN_KEY);
    location.reload();
  });
  $("files").addEventListener("change", listFiles);
  $("submit-btn").addEventListener("click", submit);

  var saved = localStorage.getItem(TOKEN_KEY);
  if (saved) {
    $("remember").checked = true;
    connect(saved, true);
  }
})();
