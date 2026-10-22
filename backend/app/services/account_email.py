"""Configured TLS SMTP only. Never log or return recovery tokens."""
import os
import logging
import smtplib
import ssl
from email.message import EmailMessage
from fastapi import HTTPException


def email_available():
    return bool(os.getenv('SMTP_HOST') and os.getenv('SMTP_FROM') and
                (not os.getenv('SMTP_USER') or os.getenv('SMTP_PASSWORD')))


def send_account_email(destination, purpose, token):
    if not email_available():
        raise HTTPException(503, 'Account emails are not configured yet. Contact the project team.')
    try:
        message = EmailMessage()
        message['From'] = os.environ['SMTP_FROM']
        message['To'] = destination
        message['Subject'] = 'Student Compass — ' + ('reset password' if purpose == 'reset' else 'verify email')
        message.set_content(f'Enter this one-use code in Student Compass to {purpose}:\n\n{token}\n\n'
                            'It expires in 30 minutes. If you did not request it, ignore this email. Never share the code.')
        with smtplib.SMTP(os.environ['SMTP_HOST'], int(os.getenv('SMTP_PORT', '587')), timeout=10) as server:
            server.starttls(context=ssl.create_default_context())
            if os.getenv('SMTP_USER'):
                server.login(os.environ['SMTP_USER'], os.environ['SMTP_PASSWORD'])
            server.send_message(message)
    except (OSError, smtplib.SMTPException, UnicodeError, ValueError, KeyError):
        # Do not log the destination, code, SMTP credentials or exception body.
        logging.getLogger(__name__).warning('Account email delivery failed; check protected SMTP configuration/provider status.')
        raise HTTPException(503, 'Email delivery is temporarily unavailable. Please retry.') from None
