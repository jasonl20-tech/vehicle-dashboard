-- Erzwingt 2FA für einzelne Nutzer (pro user). Steht der Wert auf 1 und der
-- User hat noch keinen Authenticator hinterlegt, sperrt das Frontend & die API
-- alles ausser den TOTP-Enrollment-Endpunkten und der Account-Settings-Seite.
ALTER TABLE user ADD COLUMN require_2fa INTEGER NOT NULL DEFAULT 0;
