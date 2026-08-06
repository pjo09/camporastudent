const { Resend } = require("resend");

function getResendClient() {

    if (!process.env.RESEND_API_KEY) {

        throw new Error("Email service is not configured.");

    }

    return new Resend(process.env.RESEND_API_KEY);

}

async function sendEmail(to, subject, html) {

    try {

        console.log("====================================");
        console.log("📨 Sending Email...");
        console.log("To:", to);
        console.log("From:", process.env.FROM_EMAIL);
        console.log("Subject:", subject);
        console.log("====================================");

        if (!to || !subject || !html || !process.env.FROM_EMAIL) {

            throw new Error("Email recipient, subject, content, and sender are required.");

        }

        const { data, error } = await getResendClient().emails.send({

            from: process.env.FROM_EMAIL,

            to: [to],

            subject,

            html

        });

        console.log("====================================");
        console.log("📬 Resend Response");
        console.log("Data:", data);
        console.log("Error:", error);
        console.log("====================================");

        if (error) {

            throw new Error(error.message || JSON.stringify(error));

        }

        console.log("✅ Email Sent Successfully");

        return data;

    } catch (err) {

        console.error("Unable to send email:", err.message);
        throw err;

    }

}

module.exports = sendEmail;
