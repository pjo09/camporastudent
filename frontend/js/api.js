// ==========================================
// CAMPORA API
// ==========================================

import { API } from "./config.js";

const API_BASE = API;

function getToken() {
    return localStorage.getItem("camporaToken");
}

async function request(endpoint, options = {}) {

    const token = getToken();

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    const contentType = response.headers.get("content-type");
    let data = {};
    if (contentType && contentType.includes("application/json")) {
        try {
            data = await response.json();
        } catch (err) {
            throw new Error("Failed to parse JSON response");
        }
    } else {
        throw new Error(`Request failed with status ${response.status}: ${response.statusText || "Non-JSON response"}`);
    }

    if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
    }

    return data;
}

export const api = {

    get(endpoint) {
        return request(endpoint);
    },

    post(endpoint, body) {
        return request(endpoint, {
            method: "POST",
            body: JSON.stringify(body)
        });
    },

    put(endpoint, body) {
        return request(endpoint, {
            method: "PUT",
            body: JSON.stringify(body)
        });
    },

    delete(endpoint) {
        return request(endpoint, {
            method: "DELETE"
        });
    }

};