import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('BREVO_API_KEY') ?? '';
    this.fromEmail = this.config.get<string>('MAIL_FROM_EMAIL') ?? 'fomongole091600@gmail.com';
    this.fromName  = this.config.get<string>('MAIL_FROM_NAME')  ?? 'Rentora Houselink Uganda';
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey,
        },
        body: JSON.stringify({
          sender:      { name: this.fromName, email: this.fromEmail },
          to:          [{ email: to }],
          subject,
          htmlContent: html,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      this.logger.log(`Email sent → ${to} | ${subject}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${(err as Error).message}`);
    }
  }

  // ── All public methods ────────────────────────────────

  async sendAdminWelcome(email: string, name: string): Promise<void> {
    const portalUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    await this.send(email, 'Welcome to Rentora Houselink Uganda Admin Portal', this.adminWelcomeTemplate(name, email, portalUrl));
  }

  async sendContactWelcome(email: string, name: string, role: string): Promise<void> {
    await this.send(email, `Welcome to Rentora Houselink Uganda — ${role === 'OWNER' ? 'Property Owner' : 'Agent'} Portal`, this.contactWelcomeTemplate(name, role));
  }

  async sendPasswordChanged(email: string, name: string): Promise<void> {
    await this.send(email, 'Your password has been changed — Rentora Houselink Uganda', this.passwordChangedTemplate(name));
  }

  async sendEmailChanged(oldEmail: string, newEmail: string, name: string): Promise<void> {
    const html = this.emailChangedTemplate(name, newEmail);
    await this.send(oldEmail, 'Your email address has been updated — Rentora Houselink Uganda', html);
    await this.send(newEmail, 'Your email address has been updated — Rentora Houselink Uganda', html);
  }

  async sendAccountActivated(email: string, name: string): Promise<void> {
    await this.send(email, 'Your account has been activated — Rentora Houselink Uganda', this.accountStatusTemplate(name, true));
  }

  async sendAccountDeactivated(email: string, name: string): Promise<void> {
    await this.send(email, 'Your account has been deactivated — Rentora Houselink Uganda', this.accountStatusTemplate(name, false));
  }

  async sendPasswordResetOtp(email: string, name: string, otp: string): Promise<void> {
    await this.send(email, 'Your password reset code — Rentora Houselink Uganda', this.passwordResetOtpTemplate(name, otp));
  }

  async sendComplaintReply(
    email: string,
    name: string,
    category: string,
    status: string,
    reply: string,
  ): Promise<void> {
    await this.send(
      email,
      'Update on your complaint — Rentora Houselink Uganda',
      this.complaintReplyTemplate(name, category, status, reply),
    );
  }

  async sendBookingConfirmed(
    email: string,
    renterName: string,
    propertyTitle: string,
    moveInDate: string,
  ): Promise<void> {
    await this.send(
      email,
      'Your booking has been confirmed — Rentora Houselink Uganda',
      this.bookingConfirmedTemplate(renterName, propertyTitle, moveInDate),
    );
  }

  async sendBookingCancelled(
    email: string,
    renterName: string,
    propertyTitle: string,
    reason?: string,
  ): Promise<void> {
    await this.send(
      email,
      'Your booking has been cancelled — Rentora Houselink Uganda',
      this.bookingCancelledTemplate(renterName, propertyTitle, reason),
    );
  }

  async sendNewBookingAlert(
    adminEmail: string,
    renterName: string,
    renterPhone: string,
    propertyTitle: string,
    moveInDate: string,
  ): Promise<void> {
    if (!adminEmail) return;
    await this.send(
      adminEmail,
      `New Booking Request — ${propertyTitle}`,
      this.newBookingAlertTemplate(renterName, renterPhone, propertyTitle, moveInDate),
    );
  }

  // ── HTML Templates ────────────────────────────────────────────────────────

  // All styles are inlined for maximum email client compatibility.
  private base(content: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Rentora Houselink Uganda</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,0.06);max-width:100%;">
        <tr>
          <td style="background:#09090b;padding:24px 36px;">
            <span style="color:#ffffff;font-size:17px;font-weight:700;
                         letter-spacing:-0.3px;">Rentora Houselink Uganda</span>
            <span style="color:#52525b;font-size:12px;margin-left:10px;
                         vertical-align:middle;">Admin Portal</span>
          </td>
        </tr>
        <tr><td style="padding:36px 36px 28px;">${content}</td></tr>
        <tr>
          <td style="padding:18px 36px;border-top:1px solid #f4f4f5;">
            <p style="margin:0;color:#a1a1aa;font-size:12px;line-height:1.7;">
              This is an automated message from Rentora Houselink Uganda.
              Please do not reply to this email.<br>
              If you did not expect this message, contact your system
              administrator immediately.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private adminWelcomeTemplate(name: string, email: string, portalUrl: string): string {
    return this.base(`
      <h2 style="margin:0 0 8px;color:#09090b;font-size:20px;font-weight:700;
                 letter-spacing:-0.3px;">Welcome aboard, ${name}!</h2>
      <p style="margin:0 0 24px;color:#52525b;font-size:14px;line-height:1.75;">
        Your admin account on the Rentora Houselink Uganda portal has been created.
        Sign in using the credentials your administrator provided.
      </p>
      <table cellpadding="0" cellspacing="0" role="presentation"
             style="background:#f4f4f5;border-radius:8px;padding:16px 20px;
                    margin-bottom:28px;width:100%;">
        <tr><td>
          <p style="margin:0 0 4px;color:#71717a;font-size:11px;
                    text-transform:uppercase;letter-spacing:0.6px;">Login email</p>
          <p style="margin:0;color:#09090b;font-size:14px;font-weight:600;">${email}</p>
        </td></tr>
      </table>
      <a href="${portalUrl}/login"
         style="display:inline-block;background:#09090b;color:#ffffff;
                text-decoration:none;padding:12px 22px;border-radius:8px;
                font-size:14px;font-weight:600;">
        Sign in to the portal &rarr;
      </a>
      <p style="margin:24px 0 0;color:#a1a1aa;font-size:13px;line-height:1.6;">
        Keep your credentials private and never share your password.
      </p>
    `);
  }

  private passwordChangedTemplate(name: string): string {
    return this.base(`
      <h2 style="margin:0 0 8px;color:#09090b;font-size:20px;font-weight:700;
                 letter-spacing:-0.3px;">Password changed</h2>
      <p style="margin:0 0 22px;color:#52525b;font-size:14px;line-height:1.75;">
        Hi <strong>${name}</strong>, your Rentora Houselink Uganda account password was just
        successfully changed.
      </p>
      <table cellpadding="0" cellspacing="0" role="presentation"
             style="background:#fef3c7;border-left:3px solid #f59e0b;
                    border-radius:0 8px 8px 0;padding:14px 18px;
                    margin-bottom:24px;width:100%;">
        <tr><td>
          <p style="margin:0;color:#92400e;font-size:13px;line-height:1.65;">
            <strong>Wasn't you?</strong> Contact your system administrator
            immediately to secure your account.
          </p>
        </td></tr>
      </table>
      <p style="margin:0;color:#a1a1aa;font-size:12px;">
        Changed at: ${new Date().toUTCString()}
      </p>
    `);
  }

  private emailChangedTemplate(name: string, newEmail: string): string {
    return this.base(`
      <h2 style="margin:0 0 8px;color:#09090b;font-size:20px;font-weight:700;
                 letter-spacing:-0.3px;">Email address updated</h2>
      <p style="margin:0 0 22px;color:#52525b;font-size:14px;line-height:1.75;">
        Hi <strong>${name}</strong>, the email address on your Rentora Houselink Uganda
        account has been changed.
      </p>
      <table cellpadding="0" cellspacing="0" role="presentation"
             style="background:#f4f4f5;border-radius:8px;padding:16px 20px;
                    margin-bottom:20px;width:100%;">
        <tr><td>
          <p style="margin:0 0 4px;color:#71717a;font-size:11px;
                    text-transform:uppercase;letter-spacing:0.6px;">New email address</p>
          <p style="margin:0;color:#09090b;font-size:14px;font-weight:600;">${newEmail}</p>
        </td></tr>
      </table>
      <table cellpadding="0" cellspacing="0" role="presentation"
             style="background:#fef3c7;border-left:3px solid #f59e0b;
                    border-radius:0 8px 8px 0;padding:14px 18px;
                    margin-bottom:8px;width:100%;">
        <tr><td>
          <p style="margin:0;color:#92400e;font-size:13px;line-height:1.65;">
            <strong>Wasn't you?</strong> Contact your system administrator
            immediately.
          </p>
        </td></tr>
      </table>
    `);
  }

  private accountStatusTemplate(name: string, activated: boolean): string {
    const accentColor  = activated ? '#16a34a' : '#dc2626';
    const bgColor      = activated ? '#f0fdf4' : '#fef2f2';
    const status       = activated ? 'activated' : 'deactivated';
    const message      = activated
      ? 'Your account has been reactivated. You can sign in to the portal again.'
      : 'Your account has been deactivated. You will not be able to sign in until an administrator reactivates it.';

    return this.base(`
      <h2 style="margin:0 0 8px;color:#09090b;font-size:20px;font-weight:700;
                 letter-spacing:-0.3px;">Account ${status}</h2>
      <p style="margin:0 0 22px;color:#52525b;font-size:14px;line-height:1.75;">
        Hi <strong>${name}</strong>,
      </p>
      <table cellpadding="0" cellspacing="0" role="presentation"
             style="background:${bgColor};border-left:3px solid ${accentColor};
                    border-radius:0 8px 8px 0;padding:14px 18px;
                    margin-bottom:24px;width:100%;">
        <tr><td>
          <p style="margin:0;color:#09090b;font-size:13px;line-height:1.65;">
            ${message}
          </p>
        </td></tr>
      </table>
      <p style="margin:0;color:#a1a1aa;font-size:13px;">
        If you believe this is a mistake, contact your system administrator.
      </p>
    `);
  }

  private contactWelcomeTemplate(name: string, role: string): string {
    const roleLabel = role === 'OWNER' ? 'Property Owner' : 'Agent / Broker';
    const roleMessage =
      role === 'OWNER'
        ? 'Your properties are now being managed on the Rentora Houselink Uganda platform. Our team will keep you updated on listings, bookings, and any activity related to your properties.'
        : 'You have been registered as an agent on the Rentora Houselink Uganda platform. You will be contacted regarding properties you manage on behalf of owners.';

    return this.base(`
      <h2 style="margin:0 0 8px;color:#09090b;font-size:20px;font-weight:700;
                letter-spacing:-0.3px;">Welcome to Rentora Houselink Uganda, ${name}!</h2>
      <p style="margin:0 0 24px;color:#52525b;font-size:14px;line-height:1.75;">
        ${roleMessage}
      </p>
      <table cellpadding="0" cellspacing="0" role="presentation"
            style="background:#f4f4f5;border-radius:8px;padding:16px 20px;
                    margin-bottom:28px;width:100%;">
        <tr><td>
          <p style="margin:0 0 4px;color:#71717a;font-size:11px;
                    text-transform:uppercase;letter-spacing:0.6px;">Registered as</p>
          <p style="margin:0;color:#09090b;font-size:14px;font-weight:600;">${roleLabel}</p>
        </td></tr>
      </table>
      <p style="margin:0;color:#a1a1aa;font-size:13px;line-height:1.6;">
        If you have any questions, please reach out to the Rentora Houselink Uganda team directly.
        Do not reply to this automated email.
      </p>
    `);
  }

  private passwordResetOtpTemplate(name: string, otp: string): string {
  const digits = otp.split('');
    return this.base(`
      <h2 style="margin:0 0 8px;color:#09090b;font-size:20px;font-weight:700;
                letter-spacing:-0.3px;">Password reset request</h2>
      <p style="margin:0 0 24px;color:#52525b;font-size:14px;line-height:1.75;">
        Hi <strong>${name}</strong>, use the code below to reset your
        Rentora Houselink Uganda password. It expires in <strong>15 minutes</strong>.
      </p>

      <table cellpadding="0" cellspacing="0" role="presentation"
            style="margin-bottom:28px;">
        <tr>
          ${digits.map(d => `
            <td style="padding-right:8px;">
              <div style="width:44px;height:56px;background:#f4f4f5;
                          border-radius:8px;border:1px solid #e4e4e7;
                          font-size:28px;font-weight:700;color:#09090b;
                          text-align:center;line-height:56px;
                          font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                          letter-spacing:-0.5px;">
                ${d}
              </div>
            </td>`).join('')}
        </tr>
      </table>

      <table cellpadding="0" cellspacing="0" role="presentation"
            style="background:#fef3c7;border-left:3px solid #f59e0b;
                    border-radius:0 8px 8px 0;padding:14px 18px;
                    margin-bottom:24px;width:100%;">
        <tr><td>
          <p style="margin:0;color:#92400e;font-size:13px;line-height:1.65;">
            <strong>Didn't request this?</strong> Ignore this email — your
            password will not change unless you enter this code.
          </p>
        </td></tr>
      </table>
      <p style="margin:0;color:#a1a1aa;font-size:12px;">
        Requested at: ${new Date().toUTCString()}
      </p>
    `);
  }

  private complaintReplyTemplate(
  name: string,
  category: string,
  status: string,
  reply: string,
): string {
  const categoryLabel = category.replace(/_/g, ' ');
  const statusLabel   = status.replace(/_/g, ' ');

    return this.base(`
      <h2 style="margin:0 0 8px;color:#09090b;font-size:20px;font-weight:700;
                letter-spacing:-0.3px;">Update on your complaint</h2>
      <p style="margin:0 0 22px;color:#52525b;font-size:14px;line-height:1.75;">
        Hi <strong>${name}</strong>, our team has reviewed your complaint
        regarding <strong>${categoryLabel}</strong> and has sent you the
        following update.
      </p>

      <table cellpadding="0" cellspacing="0" role="presentation"
            style="background:#f4f4f5;border-radius:8px;padding:16px 20px;
                    margin-bottom:20px;width:100%;">
        <tr><td>
          <p style="margin:0 0 4px;color:#71717a;font-size:11px;
                    text-transform:uppercase;letter-spacing:0.6px;">Status</p>
          <p style="margin:0;color:#09090b;font-size:14px;font-weight:600;">${statusLabel}</p>
        </td></tr>
      </table>

      <table cellpadding="0" cellspacing="0" role="presentation"
            style="background:#f0fdf4;border-left:3px solid #16a34a;
                    border-radius:0 8px 8px 0;padding:14px 18px;
                    margin-bottom:24px;width:100%;">
        <tr><td>
          <p style="margin:0 0 6px;color:#71717a;font-size:11px;
                    text-transform:uppercase;letter-spacing:0.6px;">Message from our team</p>
          <p style="margin:0;color:#09090b;font-size:14px;line-height:1.7;">${reply}</p>
        </td></tr>
      </table>

      <p style="margin:0;color:#a1a1aa;font-size:13px;line-height:1.6;">
        If you have further concerns, please submit a new complaint through the app
        or contact us directly.
      </p>
    `);
  }

  private bookingConfirmedTemplate(
    name: string,
    propertyTitle: string,
    moveInDate: string,
  ): string {
    return this.base(`
      <h2 style="margin:0 0 8px;color:#09090b;font-size:20px;font-weight:700;
                letter-spacing:-0.3px;">Booking confirmed ✅</h2>
      <p style="margin:0 0 22px;color:#52525b;font-size:14px;line-height:1.75;">
        Hi <strong>${name}</strong>, great news — your booking has been
        confirmed by the property manager.
      </p>

      <table cellpadding="0" cellspacing="0" role="presentation"
            style="background:#f4f4f5;border-radius:8px;padding:16px 20px;
                    margin-bottom:20px;width:100%;">
        <tr><td>
          <p style="margin:0 0 4px;color:#71717a;font-size:11px;
                    text-transform:uppercase;letter-spacing:0.6px;">Property</p>
          <p style="margin:0;color:#09090b;font-size:14px;font-weight:600;">${propertyTitle}</p>
        </td></tr>
      </table>

      <table cellpadding="0" cellspacing="0" role="presentation"
            style="background:#f4f4f5;border-radius:8px;padding:16px 20px;
                    margin-bottom:28px;width:100%;">
        <tr><td>
          <p style="margin:0 0 4px;color:#71717a;font-size:11px;
                    text-transform:uppercase;letter-spacing:0.6px;">Move-in date</p>
          <p style="margin:0;color:#09090b;font-size:14px;font-weight:600;">${moveInDate}</p>
        </td></tr>
      </table>

      <table cellpadding="0" cellspacing="0" role="presentation"
            style="background:#f0fdf4;border-left:3px solid #16a34a;
                    border-radius:0 8px 8px 0;padding:14px 18px;
                    margin-bottom:8px;width:100%;">
        <tr><td>
          <p style="margin:0;color:#166534;font-size:13px;line-height:1.65;">
            Please ensure you are available on the move-in date. Contact the
            property manager if you need to make any changes.
          </p>
        </td></tr>
      </table>
    `);
  }

  private bookingCancelledTemplate(
    name: string,
    propertyTitle: string,
    reason?: string,
  ): string {
    return this.base(`
      <h2 style="margin:0 0 8px;color:#09090b;font-size:20px;font-weight:700;
                letter-spacing:-0.3px;">Booking cancelled</h2>
      <p style="margin:0 0 22px;color:#52525b;font-size:14px;line-height:1.75;">
        Hi <strong>${name}</strong>, unfortunately your booking has been
        cancelled by the property manager.
      </p>

      <table cellpadding="0" cellspacing="0" role="presentation"
            style="background:#f4f4f5;border-radius:8px;padding:16px 20px;
                    margin-bottom:20px;width:100%;">
        <tr><td>
          <p style="margin:0 0 4px;color:#71717a;font-size:11px;
                    text-transform:uppercase;letter-spacing:0.6px;">Property</p>
          <p style="margin:0;color:#09090b;font-size:14px;font-weight:600;">${propertyTitle}</p>
        </td></tr>
      </table>

      ${reason ? `
      <table cellpadding="0" cellspacing="0" role="presentation"
            style="background:#fef2f2;border-left:3px solid #dc2626;
                    border-radius:0 8px 8px 0;padding:14px 18px;
                    margin-bottom:24px;width:100%;">
        <tr><td>
          <p style="margin:0 0 6px;color:#71717a;font-size:11px;
                    text-transform:uppercase;letter-spacing:0.6px;">Reason</p>
          <p style="margin:0;color:#09090b;font-size:13px;line-height:1.65;">${reason}</p>
        </td></tr>
      </table>
      ` : ''}

      <p style="margin:0;color:#52525b;font-size:13px;line-height:1.6;">
        You can browse other available properties on the Rentora Houselink Uganda app
        and submit a new booking request.
      </p>
    `);
  }

  private newBookingAlertTemplate(
    renterName: string,
    renterPhone: string,
    propertyTitle: string,
    moveInDate: string,
  ): string {
    const portalUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';

    return this.base(`
      <h2 style="margin:0 0 8px;color:#09090b;font-size:20px;font-weight:700;
                letter-spacing:-0.3px;">New booking request</h2>
      <p style="margin:0 0 22px;color:#52525b;font-size:14px;line-height:1.75;">
        A new booking has been submitted and is waiting for your confirmation.
      </p>

      <table cellpadding="0" cellspacing="0" role="presentation"
            style="background:#f4f4f5;border-radius:8px;padding:16px 20px;
                    margin-bottom:12px;width:100%;">
        <tr><td>
          <p style="margin:0 0 4px;color:#71717a;font-size:11px;
                    text-transform:uppercase;letter-spacing:0.6px;">Property</p>
          <p style="margin:0;color:#09090b;font-size:14px;font-weight:600;">${propertyTitle}</p>
        </td></tr>
      </table>

      <table cellpadding="0" cellspacing="0" role="presentation"
            style="background:#f4f4f5;border-radius:8px;padding:16px 20px;
                    margin-bottom:12px;width:100%;">
        <tr><td>
          <p style="margin:0 0 4px;color:#71717a;font-size:11px;
                    text-transform:uppercase;letter-spacing:0.6px;">Renter</p>
          <p style="margin:0;color:#09090b;font-size:14px;font-weight:600;">${renterName}</p>
          <p style="margin:4px 0 0;color:#52525b;font-size:13px;">${renterPhone}</p>
        </td></tr>
      </table>

      <table cellpadding="0" cellspacing="0" role="presentation"
            style="background:#f4f4f5;border-radius:8px;padding:16px 20px;
                    margin-bottom:28px;width:100%;">
        <tr><td>
          <p style="margin:0 0 4px;color:#71717a;font-size:11px;
                    text-transform:uppercase;letter-spacing:0.6px;">Requested move-in</p>
          <p style="margin:0;color:#09090b;font-size:14px;font-weight:600;">${moveInDate}</p>
        </td></tr>
      </table>

      <a href="${portalUrl}/bookings"
        style="display:inline-block;background:#09090b;color:#ffffff;
                text-decoration:none;padding:12px 22px;border-radius:8px;
                font-size:14px;font-weight:600;">
        Review booking in portal &rarr;
      </a>
    `);
  }
}