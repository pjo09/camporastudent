// =======================================
// CAMPORA OTP AUTH
// =======================================

import { API } from "./config.js";

const API_BASE = `${API}/otp`;

export async function sendOTP(name, email) {
    const { supabase } = await import("./supabaseClient.js");
    const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
            data: { name, role: "student" }
        }
    });

    if (error) {
        return { success: false, message: error.message };
    }
    return { success: true, message: "OTP sent to " + email };
}

export async function verifyOTP(name, email, code, password) {
    const { supabase } = await import("./supabaseClient.js");
    const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "signup"
    });

    if (error) {
        return { success: false, message: error.message };
    }

    if (password && data.user) {
        await supabase.auth.updateUser({ password });
    }

    return { success: true, user: data.user, token: data.session?.access_token };
}

export function saveLogin(data){

    localStorage.setItem("camporaToken", data.token);

    localStorage.setItem("camporaUser", JSON.stringify(data.user));

    localStorage.setItem("camporaRole", data.user && data.user.role || "student");

}

export function getUser(){

    try {

        return JSON.parse(localStorage.getItem("camporaUser"));

    } catch (err) {

        return null;

    }

}

export function logout(){

    localStorage.removeItem("camporaToken");

    localStorage.removeItem("camporaUser");

    localStorage.removeItem("camporaRole");

    localStorage.removeItem("camporaRemember");

    sessionStorage.removeItem("camporaToken");

    sessionStorage.removeItem("camporaUser");

    sessionStorage.removeItem("camporaRole");

    // Redirect to the main landing page and remove this page from history.
    window.location.replace("https://camporastudent.vercel.app/");

}
