// ==========================================
// CAMPORA API
// ==========================================

import { API } from "./config.js";

const API_BASE = API;

function getToken() {
    return localStorage.getItem("camporaToken");
}

async function request(endpoint, options = {}, retryCount = 0) {
    const token = getToken();

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const method = (options.method || "GET").toUpperCase();
    const isSafeMethod = method === "GET";

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });

        if (!response.ok && (response.status === 503 || response.status === 502) && retryCount < 2) {
            const delay = 2000 * Math.pow(2, retryCount);
            await new Promise(r => setTimeout(r, delay));
            return request(endpoint, options, retryCount + 1);
        }

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
    } catch (err) {
        if ((isSafeMethod || err.name === "TypeError") && retryCount < 2) {
            const delay = 2000 * Math.pow(2, retryCount);
            await new Promise(r => setTimeout(r, delay));
            return request(endpoint, options, retryCount + 1);
        }
        throw err;
    }
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