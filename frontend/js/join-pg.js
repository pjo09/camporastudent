import CONFIG from "./config.js";
import { isLoggedIn } from "./session.js";

const API_BASE = CONFIG.API_BASE;

document.addEventListener("DOMContentLoaded", () => {
    resolveInvite();
});

const $ = (id) => document.getElementById(id);

async function resolveInvite() {
    // 1. Flexible token extraction
    const searchParams = new URLSearchParams(window.location.search);
    let token = searchParams.get("token") || searchParams.get("property_id") || searchParams.get("id");

    if (!token) {
        const pathParts = window.location.pathname.split("/").filter(Boolean);
        const lastPart = pathParts.pop();
        if (lastPart && lastPart !== "join-pg.html" && lastPart !== "join-pg") {
            token = lastPart;
        }
    }

    if (!token) {
        showError("Invite token is missing from the URL.");
        return;
    }

    try {
        const { supabase } = await import("./supabaseClient.js");
        let prop = null;
        let propertyId = null;

        // Step A: Canonical lookup in property_invites
        const { data: invite, error: invErr } = await supabase
            .from("property_invites")
            .select("*, properties(*)")
            .eq("token", token)
            .eq("status", "ACTIVE")
            .maybeSingle();

        if (invite) {
            // Check expiration
            if (invite.expires_at && new Date() > new Date(invite.expires_at)) {
                throw new Error("This property invite link has expired.");
            }
            if (invite.properties) {
                prop = invite.properties;
                propertyId = invite.property_id || prop.id;
            }
        }

        // Step B: Legacy / fallback lookup directly in properties table by id or mongo_id
        if (!prop) {
            const { data: propById, error: pErr } = await supabase
                .from("properties")
                .select("*")
                .or(`id.eq.${token},mongo_id.eq.${token}`)
                .maybeSingle();

            if (propById) {
                prop = propById;
                propertyId = prop.id || prop.mongo_id || token;
            }
        }

        if (!prop) {
            throw new Error("No property details found for this invite link.");
        }

        const property = {
            id: propertyId || prop.id || prop._id,
            propertyName: prop.property_name || prop.propertyName || "Campora PG",
            city: prop.city || "",
            state: prop.state || "",
            address: prop.address || "",
            images: prop.images || []
        };

        // Render card
        $("propertyName").textContent = property.propertyName;
        $("propertyLocation").querySelector("span").textContent = property.city 
            ? `${property.address ? property.address + ", " : ""}${property.city}${property.state ? ", " + property.state : ""}`
            : (property.address || "Location details unavailable");

        const img = property.images && property.images.length ? property.images[0] : "/assets/logos/logo.png";
        $("propertyImage").src = img.startsWith("http") ? img : `${API_BASE.replace(/\/api$/, "")}${img}`;

        // Configure button
        $("continueBtn").addEventListener("click", () => {
            const targetPropId = property.id;
            const destUrl = `/property-details.html?id=${encodeURIComponent(targetPropId)}&joinPg=true`;

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
