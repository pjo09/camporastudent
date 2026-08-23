import CONFIG from "./config.js";
import { isLoggedIn } from "./session.js";

const API_BASE = CONFIG.API_BASE;

document.addEventListener("DOMContentLoaded", () => {
    resolveInvite();
});

const $ = (id) => document.getElementById(id);

async function resolveInvite() {
    // Extract token from URL /join-pg/:token
    const pathParts = window.location.pathname.split("/");
    const token = pathParts.pop() || pathParts[pathParts.length - 1];

    if (!token) {
        showError("Invite token is missing from the URL.");
        return;
    }

    try {
        const { supabase } = await import("./supabaseClient.js");
        const { data: prop, error: pErr } = await supabase
            .from("properties")
            .select("*")
            .eq("id", token)
            .maybeSingle();

        if (pErr || !prop) throw new Error("No property details found for this invite link.");

        const property = {
            propertyName: prop.property_name,
            city: prop.city,
            state: prop.state,
            address: prop.address,
            images: prop.images
        };

        // Render card
        $("propertyName").textContent = property.propertyName || "Campora PG";
        $("propertyLocation").querySelector("span").textContent = property.city 
            ? `${property.address ? property.address + ", " : ""}${property.city}, ${property.state || ""}`
            : "Location details unavailable";

        const img = property.images && property.images.length ? property.images[0] : "/assets/logos/logo.png";
        $("propertyImage").src = img.startsWith("http") ? img : `${API_BASE.replace(/\/api$/, "")}${img}`;

        // Configure button
        $("continueBtn").addEventListener("click", () => {
            const propertyId = property._id;
            const destUrl = `/pages/property/property.html?id=${propertyId}&joinPg=true`;

            if (!isLoggedIn()) {
                // Not logged in -> go through login, then return
                window.location.href = `/login.html?redirectTo=${encodeURIComponent(destUrl)}`;
            } else {
                // Logged in -> go straight to PG details to open form
                window.location.href = destUrl;
            }
        });

        // Toggle visibility
        $("loading").style.display = "none";
        $("inviteCard").style.display = "block";

    } catch (err) {
        showError(err.message);
    }
}

function showError(msg) {
    $("loading").style.display = "none";
    $("inviteCard").style.display = "none";
    $("errorMsg").textContent = msg;
    $("error").style.display = "block";
}
