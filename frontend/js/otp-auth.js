// =======================================
// CAMPORA OTP AUTH
// =======================================

import { API } from "./config.js";

const API_BASE = `${API}/otp`;

export async function sendOTP(name, email) {

    const response = await fetch(`${API}/send`, {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            name,
            email
        })

    });

    return await response.json();

}

export async function verifyOTP(name, email, code, password) {

    const response = await fetch(`${API}/verify`, {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({

            name,
            email,
            code,
            password

        })

    });

    return await response.json();

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

    sessionStorage.removeItem("camporaToken");

    sessionStorage.removeItem("camporaUser");

}
