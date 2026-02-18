import { createLogger } from '../lib/logger.js';

const log = createLogger('Service:Email');

const RESEND_API = 'https://api.resend.com/emails';

export async function sendPasswordResetEmail(toEmail, username, resetUrl) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    log.info(`[Email not configured] Reset link for ${username}: ${resetUrl}`);
    return false;
  }

  const from = process.env.SMTP_FROM || 'Pew Pew Kittens DKP <onboarding@resend.dev>';

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [toEmail],
        subject: 'Pew Pew DKP - Password Reset',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0d1117; color: #e6e6e6; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #6b21a8, #7c3aed); padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 22px; color: #fff;">Pew Pew Kittens with Guns</h1>
          <p style="margin: 4px 0 0; font-size: 13px; color: #c4b5fd;">DKP System</p>
        </div>
        <div style="padding: 32px 24px;">
          <p style="margin: 0 0 16px;">Hola <strong>${username}</strong>,</p>
          <p style="margin: 0 0 24px;">Has solicitado restablecer tu contraseña. Haz clic en el botón para crear una nueva:</p>
          <div style="text-align: center; margin: 0 0 24px;">
            <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #6b21a8, #7c3aed); color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: bold; font-size: 15px;">
              Restablecer contraseña
            </a>
          </div>
          <p style="margin: 0 0 8px; font-size: 13px; color: #8b949e;">Este enlace expira en 1 hora.</p>
          <p style="margin: 0; font-size: 13px; color: #8b949e;">Si no solicitaste este cambio, ignora este email.</p>
        </div>
        <div style="padding: 16px 24px; border-top: 1px solid #21262d; text-align: center; font-size: 11px; color: #484f58;">
          Pew Pew DKP &mdash; Midnight Edition
        </div>
      </div>
    `,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      log.error('Resend API error', { status: res.status, body });
      return false;
    }

    log.info(`Password reset email sent to ${toEmail}`);
    return true;
  } catch (err) {
    log.error('Failed to send email via Resend', { error: err.message });
    return false;
  }
}

export function isEmailConfigured() {
  return !!process.env.RESEND_API_KEY;
}
