/**
 * Injected client script for proxied QuickBlox consultation pages.
 *
 * Responsibilities:
 * 1. Safe URL rewriting & token preservation.
 * 2. Intercepts history.pushState, history.replaceState, location.assign, location.replace to:
 *    - Keep all navigations on the current origin (localhost or production domain).
 *    - Intercept dashboard redirects and postMessage the parent portal to navigate.
 *    - Detect room transitions (/appointment/:newId, /scheduled-appointments/:id/visit) and notify the parent portal immediately.
 * 3. Listens for JotForm form submissions and dispatches focus events so QuickBlox
 *    re-fetches the appointment and transitions smoothly into the consultation waiting room.
 * 4. Detects when the consultation waiting room (.appointment-screen) is mounted and notifies
 *    the parent portal that the room is active.
 * 5. Detects when a consultation concludes/finishes and notifies the parent portal.
 */
export const CONSULTATION_BRIDGE_SCRIPT = `
<script id="portal-consultation-bridge">
(function() {
  var initialMatch = window.location.pathname.match(/(?:scheduled[-_])?appointments?\\/([a-f0-9]{20,32})/i);
  var currentApptId = initialMatch && initialMatch[1] ? initialMatch[1] : null;
  var lastNotifiedApptId = currentApptId;

  // 1. Safe URL rewriting & token preservation helper
  function rewriteConsultationUrl(url) {
    if (!url) return url;
    var str = String(url);

    // If URL points to api-bodyinc.quickblox.com
    if (str.indexOf("api-bodyinc.quickblox.com") !== -1) {
      if (str.indexOf("webhooks/injury") !== -1) {
        try {
          window.parent.postMessage({ type: "CONSULTATION_FORM_SUBMITTED" }, "*");
        } catch(e) {}
        return window.location.href;
      }
      if (str.indexOf("injury-appointment") !== -1) {
        var newPath = str.replace("https://api-bodyinc.quickblox.com", window.location.origin);
        try {
          var urlObj = new URL(newPath);
          var params = urlObj.searchParams;
          var currentParams = new URLSearchParams(window.location.search);
          var currentToken = currentParams.get("token") || "";
          if (currentToken && !params.has("token")) {
            params.append("token", currentToken);
            urlObj.search = params.toString();
          }
          return urlObj.toString();
        } catch(e) {
          return newPath;
        }
      }
      // Intercept scheduled-appointments / appointment URLs on api domain (which 404s) and redirect to client proxy
      if (str.indexOf("scheduled-appointment") !== -1 || str.indexOf("appointment") !== -1) {
        var apptMatch = str.match(/(?:scheduled[-_])?appointments?\\/([a-f0-9]{20,32})/i);
        var extractedApptId = apptMatch && apptMatch[1] ? apptMatch[1] : null;
        try {
          window.parent.postMessage({
            type: "CONSULTATION_FORM_SUBMITTED",
            appointmentId: extractedApptId || undefined
          }, "*");
        } catch(e) {}
        str = str.replace("https://api-bodyinc.quickblox.com", window.location.origin);
        str = str.replace("http://api-bodyinc.quickblox.com", window.location.origin);
      }
    }

    if (str.indexOf("client-bodyinc.quickblox.com") !== -1) {
      str = str.split("https://client-bodyinc.quickblox.com").join(window.location.origin);
      str = str.split("http://client-bodyinc.quickblox.com").join(window.location.origin);
    }

    if (
      str.indexOf("patient.bodyinc.com/dashboard") !== -1 ||
      str === "/dashboard" ||
      str.endsWith("/dashboard") ||
      str === "/" ||
      str === window.location.origin + "/"
    ) {
      try {
        window.parent.postMessage({ type: "PORTAL_NAVIGATE", path: "/dashboard" }, "*");
      } catch(e) {}
      return window.location.origin + "/dashboard";
    }
    if (str.indexOf("patient.bodyinc.com") !== -1) {
      str = str.split("https://patient.bodyinc.com").join(window.location.origin);
      str = str.split("http://patient.bodyinc.com").join(window.location.origin);
    }

    // Preserve existing authentication token if target URL lacks one
    try {
      var currentParams = new URLSearchParams(window.location.search);
      var currentToken = currentParams.get("token") || "";
      if (currentToken && str.indexOf("token=") === -1) {
        var sep = str.indexOf("?") === -1 ? "?" : "&";
        str = str + sep + "token=" + encodeURIComponent(currentToken);
      }
    } catch(e) {}

    // If navigating to an appointment path, extract ID and notify parent portal
    try {
      var match = str.match(/(?:scheduled[-_])?appointments?\\/([a-f0-9]{20,32})/i);
      if (match && match[1]) {
        if (str.indexOf("scheduled-appointment") !== -1) {
          try {
            window.parent.postMessage({
              type: "CONSULTATION_FORM_SUBMITTED",
              appointmentId: match[1]
            }, "*");
          } catch(e) {}
        }
        if (match[1] !== lastNotifiedApptId) {
          lastNotifiedApptId = match[1];
          window.parent.postMessage({ type: "CONSULTATION_ADVANCE_ROOM", appointmentId: match[1] }, "*");
        }
      }
    } catch(e) {}

    return str;
  }

  // 2. Intercept History API (React Router navigations inside QuickBlox SPA)
  try {
    var origPushState = window.history.pushState.bind(window.history);
    var origReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = function(state, title, url) {
      var target = rewriteConsultationUrl(url);
      return origPushState(state, title, target);
    };

    window.history.replaceState = function(state, title, url) {
      var target = rewriteConsultationUrl(url);
      return origReplaceState(state, title, target);
    };
  } catch(e) {}

  // 3. Intercept window.location methods
  try {
    var origAssign = window.location.assign.bind(window.location);
    var origReplace = window.location.replace.bind(window.location);

    window.location.assign = function(url) {
      var target = rewriteConsultationUrl(url);
      if (target.indexOf("/dashboard") !== -1) {
        try {
          window.parent.postMessage({ type: "PORTAL_NAVIGATE", path: "/dashboard" }, "*");
          return;
        } catch(e) {}
      }
      origAssign(target);
    };

    window.location.replace = function(url) {
      var target = rewriteConsultationUrl(url);
      if (target.indexOf("/dashboard") !== -1) {
        try {
          window.parent.postMessage({ type: "PORTAL_NAVIGATE", path: "/dashboard" }, "*");
          return;
        } catch(e) {}
      }
      origReplace(target);
    };
  } catch(e) {}

  // 4. Intercept window.open
  try {
    var origOpen = window.open.bind(window);
    window.open = function(url, target, features) {
      if (url) {
        var rewritten = rewriteConsultationUrl(url);
        if (rewritten.indexOf("/dashboard") !== -1) {
          window.parent.postMessage({ type: "PORTAL_NAVIGATE", path: "/dashboard" }, "*");
          return null;
        }
        return origOpen(rewritten, target === "_top" ? "_self" : target, features);
      }
      return origOpen(url, target, features);
    };
  } catch(e) {}

  // 5. Intercept link clicks and form submits to neutralize target="_top"
  document.addEventListener("click", function(e) {
    try {
      var target = e.target;
      while (target && target.tagName !== "A") {
        target = target.parentElement;
      }
      if (target && target.href) {
        if (target.target === "_top" || target.target === "_parent") {
          target.target = "_self";
        }
        if (
          target.href.indexOf("client-bodyinc.quickblox.com") !== -1 ||
          target.href.indexOf("api-bodyinc.quickblox.com") !== -1 ||
          target.href.indexOf("patient.bodyinc.com") !== -1
        ) {
          e.preventDefault();
          var rewritten = rewriteConsultationUrl(target.href);
          window.location.assign(rewritten);
        }
      }
    } catch(e) {}
  }, true);

  document.addEventListener("submit", function(e) {
    try {
      var form = e.target;
      if (form && (form.target === "_top" || form.target === "_parent")) {
        form.target = "_self";
      }
    } catch(e) {}
  }, true);

  // 6. Helper to trigger QuickBlox appointment refresh via window focus
  function triggerQuickbloxRefresh() {
    try {
      window.dispatchEvent(new Event("focus"));
    } catch(e) {}
  }

  // 7. Check if consultation has finished
  function checkForFinished() {
    try {
      var callFinished = document.querySelector(".call-ended") ||
                         document.querySelector(".appointment-finished") ||
                         document.querySelector(".dialog-ended") ||
                         document.querySelector("[class*='call-ended']") ||
                         document.querySelector("[class*='finished-screen']");
      if (callFinished) {
        window.parent.postMessage({ type: "CONSULTATION_FINISHED" }, "*");
        return true;
      }
    } catch(e) {}
    return false;
  }

  // 8. Detect when consultation waiting room or video/chat is rendered (NOT the intake form)
  function checkForRoom() {
    try {
      if (checkForFinished()) return true;

      // If the intake form / injury screen or jotform iframe is visible, we are NOT in the room yet!
      var isFormVisible = document.querySelector(".appointment-injury") ||
                          document.querySelector(".appointment-form") ||
                          document.querySelector("iframe[src*='jotform']") ||
                          document.querySelector("[class*='injury']");
      if (isFormVisible) {
        return false;
      }

      var room = document.querySelector(".chat-container") ||
                 document.querySelector(".radar-circle") ||
                 document.querySelector(".call-screen") ||
                 document.querySelector(".video-chat") ||
                 document.querySelector(".dialog-info");
      if (room) {
        var match = window.location.pathname.match(/(?:scheduled[-_])?appointments?\\/([a-f0-9]{20,32})/i);
        var apptId = match && match[1] ? match[1] : (currentApptId || undefined);
        try {
          window.parent.postMessage({ type: "CONSULTATION_IN_ROOM", appointmentId: apptId }, "*");
        } catch(e) {}
        return true;
      }
    } catch(e) {}
    return false;
  }

  // 9. Active URL & DOM watcher (catches redirects and state changes)
  var lastObservedPath = window.location.pathname;
  setInterval(function() {
    try {
      var currentPath = window.location.pathname;
      if (currentPath !== lastObservedPath) {
        lastObservedPath = currentPath;
        var match = currentPath.match(/(?:scheduled[-_])?appointments?\\/([a-f0-9]{20,32})/i);
        if (match && match[1]) {
          if (currentPath.indexOf("scheduled-appointment") !== -1) {
            handleFormCompleted();
          }
          if (match[1] !== lastNotifiedApptId) {
            lastNotifiedApptId = match[1];
            window.parent.postMessage({ type: "CONSULTATION_ADVANCE_ROOM", appointmentId: match[1] }, "*");
          }
        }
      }
      checkForRoom();
    } catch(e) {}
  }, 1000);

  // 10. Handle form completion: notify parent, refresh QuickBlox until room is active
  var hasSubmitted = false;
  function handleFormCompleted() {
    if (hasSubmitted) return;
    hasSubmitted = true;

    console.log("[Portal Consultation] Intake form completed! Transitioning to consultation room...");
    var match = window.location.pathname.match(/(?:scheduled[-_])?appointments?\\/([a-f0-9]{20,32})/i);
    var apptId = match && match[1] ? match[1] : (currentApptId || "current");

    try {
      window.parent.postMessage({ type: "CONSULTATION_FORM_SUBMITTED", appointmentId: apptId }, "*");
    } catch(e) {}

    // Trigger QuickBlox focus refresh so it re-fetches updated appointment
    triggerQuickbloxRefresh();

    var attempts = 0;
    var refreshInterval = setInterval(function() {
      attempts++;
      triggerQuickbloxRefresh();
      if (checkForRoom() || attempts >= 20) {
        clearInterval(refreshInterval);
      }
    }, 1000);
  }

  // 11. Listen for verified postMessages from JotForm
  window.addEventListener("message", function(event) {
    try {
      var data = event.data;
      var isCompleted = false;
      if (typeof data === "string") {
        if (
          data === "submission-completed" ||
          data === "form-submitted" ||
          data.indexOf("submission-completed") !== -1
        ) {
          isCompleted = true;
        }
      } else if (typeof data === "object" && data !== null) {
        if (
          data.action === "submission-completed" ||
          data.type === "submission-completed" ||
          data.event === "submission-completed" ||
          data.action === "form-submitted"
        ) {
          isCompleted = true;
        }
      }

      if (isCompleted) {
        console.log("[Portal Consultation] JotForm submission event received!");
        handleFormCompleted();
      }
    } catch(err) {}
  }, true);

  // 12. Observe DOM changes for thank you messages
  document.addEventListener("DOMContentLoaded", function() {
    checkForRoom();

    var observer = new MutationObserver(function() {
      if (checkForRoom()) return;
      if (document.body) {
        var text = document.body.innerText || "";
        if (
          text.indexOf("Your submission has been received") !== -1 ||
          (text.indexOf("Thank You") !== -1 && text.indexOf("received") !== -1)
        ) {
          handleFormCompleted();
        }
      }
    });

    if (document.documentElement) {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  });
})();
</script>
`;
