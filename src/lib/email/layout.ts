import "server-only";

/**
 * Visual tokens matching the patient portal / Figma onboarding theme
 * (`app/onboarding/_lib/onboarding-theme.ts`).
 */
export const EMAIL_THEME = {
  navy: "#152A51",
  navyMuted: "#445575",
  navyFaint: "#8A94A8",
  page: "#F3F6F6",
  card: "#ffffff",
  border: "#E8EEED",
  inputBg: "#E8EEED",
  cta: "#E3E084",
  accent: "#6A9B9C",
} as const;

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function formatAmount(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

function applyBodyStyles(html: string): string {
  const t = EMAIL_THEME;
  return html
    .replace(/<p(?![^>]*\sstyle=)/gi, `<p style="margin:0 0 14px;color:${t.navyMuted};"`)
    .replace(/<strong(?![^>]*\sstyle=)/gi, `<strong style="color:${t.navy};font-weight:600;"`);
}

function darkModeLock(selectorList: string, declarations: string): string {
  const selectors = selectorList
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ogsc = selectors.flatMap((s) => [`[data-ogsc] ${s}`, `[data-ogsb] ${s}`]).join(", ");
  return `@media (prefers-color-scheme: dark) { ${selectors.join(", ")} { ${declarations} } }
${ogsc} { ${declarations} }`;
}

/** Lemon pill CTA — Figma: #E3E084, navy text, 46px, fully rounded. */
export function emailButton(label: string, href: string): string {
  const t = EMAIL_THEME;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;">
  <tr>
    <td align="left" bgcolor="${t.cta}" height="46" class="email-btn-cell" style="background-color:${t.cta};background:${t.cta};border-radius:105px;height:46px;mso-padding-alt:14px 19px;">
      <a href="${href}" target="_blank" class="email-btn" style="display:inline-block;background-color:${t.cta};background:${t.cta};border:1px solid ${t.cta};color:${t.navy};padding:14px 19px;border-radius:105px;text-decoration:none;font-weight:500;font-size:14px;line-height:18px;font-family:${FONT};">
        <!--[if mso]>&nbsp;&nbsp;<![endif]-->${label}<!--[if mso]>&nbsp;&nbsp;<![endif]-->
      </a>
    </td>
  </tr>
</table>`;
}

/** Soft gray chip matching onboarding input fills. */
export function emailChip(text: string): string {
  const t = EMAIL_THEME;
  return `<p style="margin:4px 0 16px;">
  <span class="email-chip" style="display:inline-block;background-color:${t.inputBg};color:${t.navy};border-radius:999px;padding:6px 12px;font-size:12px;line-height:16px;font-weight:500;font-family:${FONT};">${text}</span>
</p>`;
}

/** Rounded input-style panel for OTP codes and summary blocks. */
export function emailSoftPanel(innerHtml: string, align: "left" | "center" = "left"): string {
  const t = EMAIL_THEME;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
  <tr>
    <td align="${align}" bgcolor="${t.inputBg}" class="email-panel" style="background-color:${t.inputBg};background:${t.inputBg};border-radius:14px;padding:18px 20px;">
      ${innerHtml}
    </td>
  </tr>
</table>`;
}

export function emailLayout(title: string, bodyHtml: string): string {
  const t = EMAIL_THEME;
  const body = applyBodyStyles(bodyHtml);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light only" />
    <title>${title}</title>
    <style type="text/css">
      :root { color-scheme: light only; }
      body, table, td { color-scheme: light only; }
      p { margin: 0 0 14px; color: ${t.navyMuted}; }
      strong { color: ${t.navy}; font-weight: 600; }
      a { color: ${t.navy}; }
      .email-btn { background-color: ${t.cta} !important; color: ${t.navy} !important; }
      .email-btn-cell { background-color: ${t.cta} !important; }
      .email-chip { background-color: ${t.inputBg} !important; color: ${t.navy} !important; }
      .email-panel { background-color: ${t.inputBg} !important; }
      ${darkModeLock(
        ".email-page",
        `background-color:${t.page} !important;background:${t.page} !important;color:${t.navy} !important;`,
      )}
      ${darkModeLock(
        ".email-card, .email-header, .email-body, .email-footer",
        `background-color:${t.card} !important;background:${t.card} !important;color:${t.navy} !important;`,
      )}
      ${darkModeLock(".email-btn, .email-btn-cell", `background-color:${t.cta} !important;color:${t.navy} !important;`)}
      ${darkModeLock(".email-chip, .email-panel", `background-color:${t.inputBg} !important;color:${t.navy} !important;`)}
    </style>
  </head>
  <body class="email-page" bgcolor="${t.page}" style="margin:0;padding:0;background-color:${t.page};background:${t.page};font-family:${FONT};color:${t.navy};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.page}" class="email-page" style="background-color:${t.page};background:${t.page};padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.card}" class="email-card" style="max-width:560px;background-color:${t.card};background:${t.card};border-radius:20px;border:1px solid ${t.border};overflow:hidden;">
          <tr>
            <td class="email-header" bgcolor="${t.card}" style="background-color:${t.card};background:${t.card};padding:22px 28px 16px;">
              <span style="font-size:18px;font-weight:700;letter-spacing:0.08em;line-height:1;color:${t.navy};font-family:${FONT};">BODY INC.</span>
            </td>
          </tr>
          <tr>
            <td bgcolor="${t.navy}" style="height:2px;line-height:2px;font-size:0;background-color:${t.navy};background:${t.navy};">&nbsp;</td>
          </tr>
          <tr>
            <td bgcolor="${t.accent}" style="height:5px;line-height:5px;font-size:0;background-color:${t.accent};background:${t.accent};">&nbsp;</td>
          </tr>
          <tr>
            <td class="email-body" bgcolor="${t.card}" style="background-color:${t.card};padding:28px 28px 8px;font-size:24px;font-weight:500;letter-spacing:-0.5px;line-height:1.3;color:${t.navy};font-family:${FONT};">${title}</td>
          </tr>
          <tr>
            <td class="email-body" bgcolor="${t.card}" style="background-color:${t.card};padding:0 28px 28px;font-size:14px;line-height:1.65;color:${t.navyMuted};font-family:${FONT};">${body}</td>
          </tr>
          <tr>
            <td class="email-footer" bgcolor="${t.card}" style="background-color:${t.card};padding:16px 28px 24px;border-top:1px solid ${t.border};font-size:12px;line-height:1.5;color:${t.navyFaint};font-family:${FONT};">
              This email was sent by Body Inc. If you have questions, reply to this email or contact support.
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
