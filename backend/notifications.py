
import os
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import smtplib
import cairosvg # For SVG to PNG conversion

from backend.generate_glyph import generate_glyph # Assuming this can generate an SVG string

def generate_weekly_digest_content(user_email: str, collection_id: str, glyph_svg_content: str, health_metrics: dict):
    """
    Generates the HTML content for the weekly digest email.
    """
    # Convert SVG to PNG for embedding
    glyph_image_path = f"/tmp/glyph_{collection_id}.png"
    cairosvg.svg2png(bytestring=glyph_svg_content.encode('utf-8'), write_to=glyph_image_path)

    # Basic summary of key statistics
    summary_text = f"""
    <p>Here's a summary of your project's activity this week:</p>
    <ul>
        <li><strong>Feature vs. Fix Ratio:</strong> {health_metrics.get('feature_to_fix_ratio', 0):.2f}</li>
        <li><strong>Commit Cadence:</strong> {health_metrics.get('commit_cadence', 0):.2f} commits/month</li>
        <li><strong>Code Churn Volatility:</strong> {health_metrics.get('code_churn_volatility', 0):.2f}</li>
    </ul>
    """

    html_content = f"""
    <html>
        <body>
            <h1>Your Weekly GitGlyph Digest!</h1>
            <p>Hello {user_email},</p>
            <p>Here's your weekly update for your Glyph. See how your coding journey evolved!</p>
            {summary_text}
            <p>Here's a snapshot of your Glyph's activity:</p>
            <img src="cid:glyph_image" alt="Your Weekly Glyph" style="max-width: 100%; height: auto;">
            <p>View your full, animated Glyph on the platform: <a href="http://localhost:5173/glyph/{collection_id}">View Glyph</a></p>
            <p>Thank you for using GitGlyph!</p>
        </body>
    </html>
    """
    return html_content, glyph_image_path

def send_email(to_email: str, subject: str, html_content: str, image_path: str = None):
    """
    Sends an email with HTML content and an optional embedded image.
    """
    sender_email = os.getenv("EMAIL_USERNAME")
    sender_password = os.getenv("EMAIL_PASSWORD")
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))

    if not sender_email or not sender_password:
        print("Email credentials not set. Skipping email sending.")
        return

    msg = MIMEMultipart('related')
    msg['From'] = sender_email
    msg['To'] = to_email
    msg['Subject'] = subject

    msg.attach(MIMEText(html_content, 'html'))

    if image_path:
        with open(image_path, 'rb') as img_file:
            img = MIMEImage(img_file.read())
            img.add_header('Content-ID', '<glyph_image>')
            msg.attach(img)

    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(msg)
        print(f"Email sent successfully to {to_email}")
    except Exception as e:
        print(f"Failed to send email to {to_email}: {e}")
    finally:
        if image_path and os.path.exists(image_path):
            os.remove(image_path) # Clean up the generated image

async def send_weekly_digest(user_email: str, collection_id: str, repo_path: str):
    """
    Orchestrates the generation and sending of the weekly digest email.
    """
    # Simulate glyph generation and health analysis
    # In a real scenario, you'd fetch the actual glyph data and metrics
    glyph_svg_content, health_metrics = generate_glyph(repo_path, "/tmp/dummy_glyph.svg") # Dummy path, content is returned

    html_content, glyph_image_path = generate_weekly_digest_content(user_email, collection_id, glyph_svg_content, health_metrics)
    send_email(to_email=user_email, subject="Your Weekly GitGlyph Digest!", html_content=html_content, image_path=glyph_image_path)

