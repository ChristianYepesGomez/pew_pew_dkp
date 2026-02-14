import nodemailer from 'nodemailer';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Service:Email');
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user, pass },
  });

  return transporter;
}

export async function sendPasswordResetEmail(toEmail, username, resetUrl) {
  const mail = getTransporter();

  if (!mail) {
    log.info(`[Email not configured] Reset link for ${username}: ${resetUrl}`);
    return false;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await mail.sendMail({
    from,
    to: toEmail,
    subject: 'Pew Pew DKP - Password Reset',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0d1117; color: #e6e6e6; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #6b21a8, #7c3aed); padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 22px; color: #fff;">Pew Pew Kittens with Guns</h1>
          <p style="margin: 4px 0 0; font-size: 13px; color: #c4b5fd;">DKP System</p>
        </div>
        <div style="padding: 32px 24px;">
          <p style="margin: 0 0 16px;">Hola <strong>${username}</strong>,</p>
          <p style="margin: 0 0 24px;">Has solicitado restablecer tu contrasenya. Haz clic en el boton para crear una nueva:</p>
          <div style="text-align: center; margin: 0 0 24px;">
            <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #6b21a8, #7c3aed); color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: bold; font-size: 15px;">
              Restablecer contrasenya
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
  });

  return true;
}

export function isEmailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}
