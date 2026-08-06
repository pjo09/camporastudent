import { sendOTP, verifyOTP, saveLogin } from "./otp-auth.js";

export function initOTP() {

    const sendOtpBtn = document.getElementById("sendOtpBtn");
    const verifyOtpBtn = document.getElementById("verifyOtpBtn");

    let registerName = "";
    let registerEmail = "";
    let registerPassword = "";

    if (sendOtpBtn) {

        sendOtpBtn.addEventListener("click", async () => {

            registerName = document.getElementById("p-name").value.trim();
            registerEmail = document.getElementById("p-email").value.trim();
            registerPassword = document.getElementById("p-password").value.trim();

            if (!registerName || !registerEmail || !registerPassword) {

                alert("Please fill all fields.");
                return;

            }

            try {

                const result = await sendOTP(registerName, registerEmail);

                if (!result.success) {

                    alert(result.message);
                    return;

                }

                document.getElementById("registerFields").style.display = "none";
                document.getElementById("otpBox").style.display = "block";

                alert("OTP Sent Successfully.");

            }

            catch (err) {

                console.log(err);
                alert("Unable to send OTP.");

            }

        });

    }

    if (verifyOtpBtn) {

        verifyOtpBtn.addEventListener("click", async () => {

            const otp = document.getElementById("otpInput").value.trim();

            if (!otp) {

                alert("Enter OTP.");
                return;

            }

            try {

                const verify = await verifyOTP(

                    registerName,
                    registerEmail,
                    otp,
                    registerPassword

                );

                if (!verify.success) {

                    alert(verify.message);
                    return;

                }

                saveLogin(verify);

                alert("Registration Successful.");

                location.reload();

            }

            catch (err) {

                console.log(err);

                alert("OTP Verification Failed.");

            }

        });

    }

}