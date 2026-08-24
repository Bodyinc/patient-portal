import "server-only";

/** Visual tokens matching the patient portal (navy, lemon CTA, teal accent). */
export const EMAIL_THEME = {
  navy: "#152A51",
  navyMuted: "#445575",
  navyFaint: "#8A94A8",
  page: "#F3F6F6",
  card: "#ffffff",
  border: "#E8EEED",
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

/** Lemon pill CTA. Uses bgcolor so Outlook/Gmail do not fall back to a black link button. */
export function emailButton(label: string, href: string): string {
  const t = EMAIL_THEME;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr>
    <td bgcolor="${t.cta}" style="background-color:${t.cta};background:${t.cta};border-radius:999px;">
      <a href="${href}" style="display:inline-block;background-color:${t.cta};background:${t.cta};color:${t.navy};padding:13px 24px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;line-height:1.2;font-family:${FONT};">${label}</a>
    </td>
  </tr>
</table>`;
}

export function emailLayout(title: string, bodyHtml: string): string {
  const t = EMAIL_THEME;
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
  </head>
  <body bgcolor="${t.page}" style="margin:0;padding:0;background-color:${t.page};background:${t.page};font-family:${FONT};color:${t.navy};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.page}" style="background-color:${t.page};background:${t.page};padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.card}" style="max-width:560px;background-color:${t.card};background:${t.card};border-radius:16px;border:1px solid ${t.border};overflow:hidden;">
          <tr>
            <td bgcolor="${t.navy}" style="background-color:${t.navy};background:${t.navy};padding:20px 28px;">
              <span style="font-size:16px;font-weight:600;letter-spacing:-0.3px;color:#ffffff;">Body Inc</span>
            </td>
          </tr>
          <tr>
            <td bgcolor="${t.accent}" style="height:4px;line-height:4px;font-size:0;background-color:${t.accent};background:${t.accent};">&nbsp;</td>
          </tr>
          <tr>
            <td bgcolor="${t.card}" style="background-color:${t.card};padding:28px 28px 8px;font-size:22px;font-weight:500;letter-spacing:-0.4px;line-height:1.3;color:${t.navy};">${title}</td>
          </tr>
          <tr>
            <td bgcolor="${t.card}" style="background-color:${t.card};padding:0 28px 28px;font-size:14px;line-height:1.65;color:${t.navyMuted};">${bodyHtml}</td>
          </tr>
          <tr>
            <td bgcolor="${t.card}" style="background-color:${t.card};padding:16px 28px 24px;border-top:1px solid ${t.border};font-size:12px;line-height:1.5;color:${t.navyFaint};">
              This email was sent by Body Inc. If you have questions, reply to this email or contact support.
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
