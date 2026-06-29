const APP_NAME = 'Simple Streamz';

export async function sendStreamAlertEmail(env, { to, subject, text, html }) {
  if (!to || !env?.EMAIL?.send) {
    return { sent: false, reason: 'email_not_configured' };
  }

  const fromEmail = env.STREAM_ALERT_FROM_EMAIL?.trim() || 'alerts@simplestreamz.com';
  const fromName = env.STREAM_ALERT_FROM_NAME?.trim() || APP_NAME;

  try {
    await env.EMAIL.send({
      to,
      from: { email: fromEmail, name: fromName },
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error.message || 'email_send_failed' };
  }
}