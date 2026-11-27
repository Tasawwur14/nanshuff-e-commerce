const { sendEmail } = require('./emailController');

const TOPICS = {
    order: 'Order support',
    product: 'Product question',
    bulk: 'Bulk / wholesale enquiry',
    feedback: 'Feedback',
    other: 'Something else'
};

const escapeHtml = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Strip CR/LF so user input can never inject email headers
const oneLine = (s) => String(s || '').replace(/[\r\n]+/g, ' ').trim();

// POST /api/contact
exports.submitContactForm = async (req, res) => {
    try {
        const { name, email, phone, topic, message, website } = req.body || {};

        // Honeypot: bots fill the hidden "website" field. Pretend success, send nothing.
        if (website) return res.json({ success: true, message: 'Thanks! We will get back to you soon.' });

        const cleanName = oneLine(name);
        const cleanEmail = oneLine(email).toLowerCase();
        const cleanPhone = oneLine(phone);
        const cleanMessage = String(message || '').trim();
        const topicLabel = TOPICS[topic] || TOPICS.other;

        if (cleanName.length < 2 || cleanName.length > 100) {
            return res.status(400).json({ message: 'Please enter your name.' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail) || cleanEmail.length > 254) {
            return res.status(400).json({ message: 'Please enter a valid email address.' });
        }
        if (cleanPhone && !/^[+()\d\s-]{7,20}$/.test(cleanPhone)) {
            return res.status(400).json({ message: 'Please enter a valid phone number.' });
        }
        if (cleanMessage.length < 10 || cleanMessage.length > 2000) {
            return res.status(400).json({ message: 'Message must be between 10 and 2000 characters.' });
        }

        const inbox = process.env.CONTACT_EMAIL || 'nanshhuf@gmail.com';
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color:#8C6A5D;">New contact message: ${escapeHtml(topicLabel)}</h2>
                <p><strong>Name:</strong> ${escapeHtml(cleanName)}</p>
                <p><strong>Email:</strong> <a href="mailto:${escapeHtml(cleanEmail)}">${escapeHtml(cleanEmail)}</a></p>
                <p><strong>Phone:</strong> ${escapeHtml(cleanPhone || 'Not provided')}</p>
                <hr style="border:none;border-top:1px solid #eee;">
                <p style="white-space:pre-wrap;">${escapeHtml(cleanMessage)}</p>
            </div>`;
        const text = `New contact message (${topicLabel})\nName: ${cleanName}\nEmail: ${cleanEmail}\nPhone: ${cleanPhone || 'Not provided'}\n\n${cleanMessage}`;

        await sendEmail({
            to: inbox,
            subject: `[Contact] ${topicLabel} from ${cleanName}`,
            html,
            text
        });

        res.json({ success: true, message: 'Thanks! We will get back to you within 24 hours.' });
    } catch (error) {
        console.error('Contact form failed:', error);
        res.status(500).json({ message: 'Could not send your message. Please call or email us directly.' });
    }
};
