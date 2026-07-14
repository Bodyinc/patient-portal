import "server-only";

export function formatAmount(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

export function emailButton(label: string, href: string): string {
  return `<p style="margin:24px 0;"><a href="${href}" style="display:inline-block;background:#1a1a1a;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">${label}</a></p>`;
}

export function emailLayout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px;">
          <tr><td style="font-size:20px;font-weight:bold;padding-bottom:8px;">Body Inc</td></tr>
          <tr><td style="font-size:17px;font-weight:bold;padding:16px 0 8px;">${title}</td></tr>
          <tr><td style="font-size:14px;line-height:1.6;color:#444444;">${bodyHtml}</td></tr>
          <tr><td style="font-size:12px;color:#999999;padding-top:24px;border-top:1px solid #eeeeee;">
            This email was sent by Body Inc. If you have questions, reply to this email or contact support.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
