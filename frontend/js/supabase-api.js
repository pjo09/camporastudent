// =====================================================
// CAMPORA SUPABASE NATIVE API MODULE
// Bypasses Render API to talk directly to Supabase
// =====================================================

import { supabase } from "./supabaseClient.js";

export const supabaseAPI = {
    // Properties
    async getProperties(filters = {}) {
        let query = supabase
            .from("properties")
            .select("*, profiles!owner_id(name, profile_image)")
            .eq("status", "approved")
            .eq("published", true);

        if (filters.city) query = query.eq("city", filters.city);
        if (filters.minPrice) query = query.gte("rent", filters.minPrice);
        if (filters.maxPrice) query = query.lte("rent", filters.maxPrice);
        if (filters.propertyType) query = query.eq("property_type", filters.propertyType);

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async getProperty(id) {
        const { data, error } = await supabase
            .from("properties")
            .select("*, profiles!owner_id(*)")
            .eq("id", id)
            .single();
        if (error) throw error;
        return data;
    },

    // Auth
    async signUp(email, password, userData = {}) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: { data: userData }
        });
        if (authError) throw authError;

        // Upsert user profile into profiles table
        if (authData && authData.user) {
            await supabase.from("profiles").upsert({
                id: authData.user.id,
                email: email,
                name: userData.name || email.split("@")[0],
                role: userData.role || "student",
                account_status: userData.role === "owner" ? "PENDING" : "ACTIVE"
            });
        }
        return authData;
    },

    async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) throw error;
        return data;
    },

    async signInWithGoogle(selectedRole = "student") {
        try {
            if (typeof localStorage !== "undefined") {
                localStorage.setItem("campora_pending_role", selectedRole);
            }
        } catch (e) {}

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback.html`
            }
        });
        if (error) throw error;
        return data;
    },

    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    async getCurrentUser() {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!user) return null;

        // Fetch full user profile
        const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

        return { ...user, profile };
    },

    // Bookings
    async createBooking(propertyId, checkIn, price = 0) {
        const { data, error } = await supabase.rpc("create_booking_transaction", {
            p_property_id: propertyId,
            p_check_in: checkIn,
            p_price: price
        });
        if (error) throw error;
        return data;
    },

    async getMyBookings() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data, error } = await supabase
            .from("bookings")
            .select("*, properties(property_name, images, address)")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });
        if (error) throw error;
        return data;
    },

    // Saved / Favorite Properties
    async toggleFavorite(propertyId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: existing } = await supabase
            .from("saved_properties")
            .select("id")
            .eq("user_id", user.id)
            .eq("property_id", propertyId)
            .maybeSingle();

        if (existing) {
            const { error } = await supabase
                .from("saved_properties")
                .delete()
                .eq("id", existing.id);
            if (error) throw error;
            return { saved: false };
        } else {
            const { error } = await supabase
                .from("saved_properties")
                .insert({ user_id: user.id, property_id: propertyId });
            if (error) throw error;
            return { saved: true };
        }
    },

    // Statistics
    async getStatistics() {
        const [propsRes, citiesRes, collegesRes, usersRes] = await Promise.all([
            supabase.from("properties").select("id", { count: "exact", head: true }),
            supabase.from("cities").select("id", { count: "exact", head: true }),
            supabase.from("colleges").select("id", { count: "exact", head: true }),
            supabase.from("profiles").select("id", { count: "exact", head: true })
        ]);

        return {
            totalProperties: propsRes.count || 0,
            totalCities: citiesRes.count || 0,
            totalColleges: collegesRes.count || 0,
            totalUsers: usersRes.count || 0
        };
    },

    // Admin Auth
    async adminSignIn(email, password) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;

        if (!authData.user) throw new Error("Authentication failed");

        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", authData.user.id)
            .single();

        if (profileError || !profile) throw new Error("User profile not found");
        if (profile.role !== "admin") {
            await supabase.auth.signOut();
            throw new Error("Access denied: Admin credentials required.");
        }
        if (profile.account_status && profile.account_status !== "ACTIVE") {
            await supabase.auth.signOut();
            throw new Error("Access denied: Account is inactive or pending approval.");
        }

        return { session: authData.session, user: authData.user, profile };
    },

    // Admin Overview Statistics
    async getAdminDashboardStats() {
        const [
            usersRes,
            studentsRes,
            ownersRes,
            adminsRes,
            propsRes,
            approvedPropsRes,
            pendingPropsRes,
            rejectedPropsRes,
            bookingsRes,
            reviewsRes
        ] = await Promise.all([
            supabase.from("profiles").select("id", { count: "exact", head: true }),
            supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
            supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "owner"),
            supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin"),
            supabase.from("properties").select("id", { count: "exact", head: true }),
            supabase.from("properties").select("id", { count: "exact", head: true }).eq("status", "approved"),
            supabase.from("properties").select("id", { count: "exact", head: true }).eq("status", "pending"),
            supabase.from("properties").select("id", { count: "exact", head: true }).eq("status", "rejected"),
            supabase.from("bookings").select("id", { count: "exact", head: true }),
            supabase.from("reviews").select("id", { count: "exact", head: true })
        ]);

        if (usersRes.error) throw usersRes.error;
        if (propsRes.error) throw propsRes.error;
        if (bookingsRes.error) throw bookingsRes.error;

        return {
            success: true,
            statistics: {
                totalUsers: usersRes.count || 0,
                totalStudents: studentsRes.count || 0,
                totalOwners: ownersRes.count || 0,
                totalAdmins: adminsRes.count || 0,
                totalProperties: propsRes.count || 0,
                approvedProperties: approvedPropsRes.count || 0,
                pendingProperties: pendingPropsRes.count || 0,
                rejectedProperties: rejectedPropsRes.count || 0,
                totalBookings: bookingsRes.count || 0,
                totalReviews: reviewsRes.count || 0
            }
        };
    },

    // Admin User Management
    async getAdminUsers(params = {}) {
        let query = supabase.from("profiles").select("*", { count: "exact" });

        if (params.role && params.role !== "all") {
            query = query.eq("role", params.role.toLowerCase());
        }
        if (params.status && params.status !== "all") {
            query = query.eq("account_status", params.status);
        }
        if (params.search && params.search.trim()) {
            const s = `%${params.search.trim()}%`;
            query = query.or(`name.ilike.${s},email.ilike.${s},phone.ilike.${s}`);
        }

        const page = Math.max(1, Number(params.page || 1));
        const limit = Math.min(100, Math.max(1, Number(params.limit || 10)));
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        query = query.order("created_at", { ascending: false }).range(from, to);

        const { data, error, count } = await query;
        if (error) throw error;

        const users = (data || []).map(r => ({
            _id: r.mongo_id || r.id,
            id: r.id,
            name: r.name,
            email: r.email,
            role: r.role,
            accountStatus: r.account_status,
            status: r.status,
            verified: r.verified,
            phone: r.phone || '',
            profileImage: r.profile_image || r.avatar_url || '',
            createdAt: r.created_at
        }));

        return {
            success: true,
            total: count || 0,
            currentPage: page,
            totalPages: Math.ceil((count || 0) / limit),
            users
        };
    },

    // Admin Property Management
    async getAdminProperties(params = {}) {
        let query = supabase.from("properties").select("*, profiles!owner_id(name, email, phone)", { count: "exact" });

        if (params.status && params.status !== "all") {
            query = query.eq("status", params.status.toLowerCase());
        }
        if (params.city && params.city !== "all") {
            query = query.ilike("city", `%${params.city.trim()}%`);
        }
        if (params.propertyType && params.propertyType !== "all") {
            query = query.eq("property_type", params.propertyType);
        }
        if (params.search && params.search.trim()) {
            const s = `%${params.search.trim()}%`;
            query = query.or(`property_name.ilike.${s},city.ilike.${s},address.ilike.${s}`);
        }

        const page = Math.max(1, Number(params.page || 1));
        const limit = Math.min(100, Math.max(1, Number(params.limit || 10)));
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        query = query.order("created_at", { ascending: false }).range(from, to);

        const { data, error, count } = await query;
        if (error) throw error;

        const properties = (data || []).map(r => ({
            _id: r.mongo_id || r.id,
            id: r.id,
            propertyName: r.property_name,
            propertyType: r.property_type,
            city: r.city,
            state: r.state,
            rent: parseFloat(r.rent || 0),
            deposit: parseFloat(r.deposit || 0),
            availableBeds: r.available_beds,
            totalBeds: r.total_beds,
            status: r.status,
            published: r.published !== false,
            available: r.available !== false,
            blacklisted: !!r.blacklisted,
            featured: !!r.featured,
            owner: {
                _id: r.owner_id,
                id: r.owner_id,
                name: r.profiles ? r.profiles.name : '',
                email: r.profiles ? r.profiles.email : '',
                phone: r.profiles ? r.profiles.phone : ''
            },
            createdAt: r.created_at
        }));

        return {
            success: true,
            total: count || 0,
            currentPage: page,
            totalPages: Math.ceil((count || 0) / limit),
            properties
        };
    },

    // Admin Booking Management
    async getAdminBookings(params = {}) {
        let query = supabase.from("bookings").select("*, properties(property_name, city), user:profiles!user_id(name, email, phone), owner:profiles!owner_id(name, email)", { count: "exact" });

        if (params.status && params.status !== "all") {
            query = query.eq("booking_status", params.status.toLowerCase());
        }
        if (params.paymentStatus && params.paymentStatus !== "all") {
            query = query.eq("payment_status", params.paymentStatus.toLowerCase());
        }

        const page = Math.max(1, Number(params.page || 1));
        const limit = Math.min(100, Math.max(1, Number(params.limit || 20)));
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        query = query.order("created_at", { ascending: false }).range(from, to);

        const { data, error, count } = await query;
        if (error) throw error;

        const bookings = (data || []).map(r => ({
            _id: r.mongo_id || r.id,
            id: r.id,
            bookingStatus: r.booking_status,
            paymentStatus: r.payment_status,
            price: parseFloat(r.price || 0),
            checkIn: r.check_in,
            checkOut: r.check_out,
            userName: r.user ? r.user.name : '',
            userEmail: r.user ? r.user.email : '',
            propertyName: r.properties ? r.properties.property_name : '',
            ownerName: r.owner ? r.owner.name : '',
            userId: { _id: r.user_id, id: r.user_id, name: r.user ? r.user.name : '', email: r.user ? r.user.email : '' },
            ownerId: { _id: r.owner_id, id: r.owner_id, name: r.owner ? r.owner.name : '', email: r.owner ? r.owner.email : '' },
            propertyId: { _id: r.property_id, id: r.property_id, propertyName: r.properties ? r.properties.property_name : '', city: r.properties ? r.properties.city : '' },
            createdAt: r.created_at
        }));

        return {
            success: true,
            total: count || 0,
            currentPage: page,
            totalPages: Math.ceil((count || 0) / limit),
            bookings
        };
    },

    // Admin Review Management
    async getAdminReviews() {
        const { data, error } = await supabase
            .from("reviews")
            .select("*, student:profiles!student_id(name, email), properties(property_name, city)")
            .order("created_at", { ascending: false });

        if (error) throw error;

        const reviews = (data || []).map(r => ({
            _id: r.mongo_id || r.id,
            id: r.id,
            rating: parseFloat(r.rating || 0),
            comment: r.comment || '',
            isApproved: r.is_approved !== false,
            status: r.is_approved ? 'approved' : 'pending',
            user: { name: r.student ? r.student.name : '', email: r.student ? r.student.email : '' },
            property: { propertyName: r.properties ? r.properties.property_name : '', city: r.properties ? r.properties.city : '' },
            createdAt: r.created_at
        }));

        return { success: true, total: reviews.length, reviews };
    },

    // Admin Activity Stream
    async getAdminActivity() {
        const [usersRes, propsRes, bookingsRes] = await Promise.all([
            supabase.from("profiles").select("id, name, email, created_at").order("created_at", { ascending: false }).limit(5),
            supabase.from("properties").select("id, property_name, created_at, profiles!owner_id(name)").order("created_at", { ascending: false }).limit(5),
            supabase.from("bookings").select("id, price, created_at, properties(property_name), profiles!user_id(name)").order("created_at", { ascending: false }).limit(5)
        ]);

        return {
            success: true,
            users: (usersRes.data || []).map(u => ({ name: u.name, email: u.email, createdAt: u.created_at })),
            properties: (propsRes.data || []).map(p => ({ propertyName: p.property_name, owner: { name: p.profiles ? p.profiles.name : '' }, createdAt: p.created_at })),
            bookings: (bookingsRes.data || []).map(b => ({ propertyName: b.properties ? b.properties.property_name : '', userName: b.profiles ? b.profiles.name : '', createdAt: b.created_at }))
        };
    },

    // Admin Analytics
    async getAdminAnalytics() {
        const { data: props, error } = await supabase.from("properties").select("views, rent, available_beds");
        if (error) throw error;

        let totalViews = 0;
        let totalRent = 0;
        let availableBeds = 0;
        const count = props ? props.length : 0;

        if (props) {
            props.forEach(p => {
                totalViews += (p.views || 0);
                totalRent += parseFloat(p.rent || 0);
                availableBeds += (p.available_beds || 0);
            });
        }

        return {
            success: true,
            analytics: {
                totalViews,
                averageRent: count > 0 ? Math.round(totalRent / count) : 0,
                availableBeds
            }
        };
    },

    // Admin Mutations
    async approveOwner(id) {
        const { data, error } = await supabase
            .from("profiles")
            .update({ account_status: "ACTIVE", verified: true, status: "active", updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return { success: true, owner: data };
    },

    async rejectOwner(id) {
        const { data, error } = await supabase
            .from("profiles")
            .update({ account_status: "REJECTED", verified: false, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return { success: true, owner: data };
    },

    async disableUser(id) {
        const { data, error } = await supabase
            .from("profiles")
            .update({ account_status: "DISABLED", status: "inactive", updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return { success: true, user: data };
    },

    async activateUser(id) {
        const { data, error } = await supabase
            .from("profiles")
            .update({ account_status: "ACTIVE", status: "active", updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return { success: true, user: data };
    },

    async approveProperty(id) {
        const { data, error } = await supabase
            .from("properties")
            .update({ status: "approved", published: true, verified: true, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return { success: true, property: data };
    },

    async rejectProperty(id) {
        const { data, error } = await supabase
            .from("properties")
            .update({ status: "rejected", published: false, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return { success: true, property: data };
    },

    async blacklistProperty(id) {
        const { data, error } = await supabase
            .from("properties")
            .update({ blacklisted: true, published: false, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return { success: true, property: data };
    },

    async restoreProperty(id) {
        const { data, error } = await supabase
            .from("properties")
            .update({ blacklisted: false, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return { success: true, property: data };
    },

    async featureProperty(id) {
        const { data: prop } = await supabase.from("properties").select("featured").eq("id", id).single();
        const nextFeatured = !prop || !prop.featured;
        const { data, error } = await supabase
            .from("properties")
            .update({ featured: nextFeatured, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return { success: true, property: data };
    },

    async approveReview(id) {
        const { data, error } = await supabase
            .from("reviews")
            .update({ is_approved: true, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return { success: true, review: data };
    },

    async hideReview(id) {
        const { data, error } = await supabase
            .from("reviews")
            .update({ is_approved: false, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return { success: true, review: data };
    },

    async deleteReview(id) {
        const { error } = await supabase.from("reviews").delete().eq("id", id);
        if (error) throw error;
        return { success: true };
    },

    // Student Notifications
    async getStudentNotifications() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: true, notifications: [] };
        const { data, error } = await supabase
            .from("notifications")
            .select("*")
            .eq("receiver_id", user.id)
            .order("created_at", { ascending: false });
        if (error) throw error;
        return {
            success: true,
            notifications: (data || []).map(n => ({
                _id: n.id,
                id: n.id,
                title: n.title,
                message: n.message,
                type: n.type || "general",
                isRead: !!n.is_read,
                createdAt: n.created_at
            }))
        };
    },

    async markNotificationRead(id) {
        const { error } = await supabase
            .from("notifications")
            .update({ is_read: true, updated_at: new Date().toISOString() })
            .eq("id", id);
        if (error) throw error;
        return { success: true };
    },

    async markAllNotificationsRead() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: true };
        const { error } = await supabase
            .from("notifications")
            .update({ is_read: true, updated_at: new Date().toISOString() })
            .eq("receiver_id", user.id);
        if (error) throw error;
        return { success: true };
    },

    // Student Profile
    async getStudentProfile() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();
        if (error) throw error;
        return {
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: data ? data.name : user.email.split("@")[0],
                phone: data ? data.phone || "" : "",
                bio: data ? data.bio || "" : "",
                college: data ? data.college || "" : "",
                course: data ? data.course || "" : "",
                year: data ? data.year || "" : "",
                emergencyContact: data ? data.emergency_contact || "" : ""
            }
        };
    },

    async updateStudentProfile(payload = {}) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        const { data, error } = await supabase
            .from("profiles")
            .update({
                name: payload.name,
                phone: payload.phone,
                bio: payload.bio,
                college: payload.college,
                course: payload.course,
                year: payload.year,
                emergency_contact: payload.emergencyContact,
                updated_at: new Date().toISOString()
            })
            .eq("id", user.id)
            .select()
            .single();
        if (error) throw error;
        return { success: true, user: data };
    },

    // Owner System
    async getOwnerDashboardStats() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: true, statistics: {} };
        const [propsRes, bookingsRes, residentsRes] = await Promise.all([
            supabase.from("properties").select("id, status, total_beds, available_beds", { count: "exact" }).eq("owner_id", user.id),
            supabase.from("bookings").select("id, booking_status", { count: "exact" }).eq("owner_id", user.id),
            supabase.from("tenancies").select("id", { count: "exact" }).eq("owner_id", user.id)
        ]);
        const props = propsRes.data || [];
        let approvedCount = 0;
        let pendingCount = 0;
        let totalBeds = 0;
        let availableBeds = 0;
        props.forEach(p => {
            if (p.status === "approved") approvedCount++;
            if (p.status === "pending") pendingCount++;
            totalBeds += (p.total_beds || 0);
            availableBeds += (p.available_beds || 0);
        });
        return {
            success: true,
            dashboard: {
                totalProperties: props.length,
                approvedProperties: approvedCount,
                pendingProperties: pendingCount,
                totalBookings: bookingsRes.count || 0,
                activeResidents: residentsRes.count || 0,
                totalBeds,
                availableBeds
            }
        };
    },

    async getOwnerProperties() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: true, properties: [] };
        const { data, error } = await supabase
            .from("properties")
            .select("*")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false });
        if (error) throw error;
        return {
            success: true,
            properties: (data || []).map(p => ({
                _id: p.id,
                id: p.id,
                propertyName: p.property_name,
                propertyType: p.property_type,
                city: p.city,
                state: p.state,
                rent: parseFloat(p.rent || 0),
                deposit: parseFloat(p.deposit || 0),
                availableBeds: p.available_beds,
                totalBeds: p.total_beds,
                status: p.status,
                published: p.published !== false,
                featured: !!p.featured,
                images: p.images || [],
                createdAt: p.created_at
            }))
        };
    },

    async getOwnerBookings() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: true, bookings: [] };
        const { data, error } = await supabase
            .from("bookings")
            .select("*, properties(property_name, city), user:profiles!user_id(name, email, phone)")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false });
        if (error) throw error;
        return {
            success: true,
            bookings: (data || []).map(b => ({
                _id: b.id,
                id: b.id,
                bookingStatus: b.booking_status,
                paymentStatus: b.payment_status,
                price: parseFloat(b.price || 0),
                checkIn: b.check_in,
                propertyName: b.properties ? b.properties.property_name : "",
                studentName: b.user ? b.user.name : "",
                studentEmail: b.user ? b.user.email : "",
                studentPhone: b.user ? b.user.phone : "",
                createdAt: b.created_at
            }))
        };
    },

    async getOwnerResidents() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: true, residents: [] };
        const { data, error } = await supabase
            .from("tenancies")
            .select("*, properties(property_name), student:profiles!student_id(name, email, phone)")
            .eq("owner_id", user.id);
        if (error) throw error;
        return {
            success: true,
            residents: (data || []).map(r => ({
                _id: r.id,
                id: r.id,
                status: r.status,
                propertyName: r.properties ? r.properties.property_name : "",
                name: r.student ? r.student.name : "",
                email: r.student ? r.student.email : "",
                phone: r.student ? r.student.phone : "",
                createdAt: r.created_at
            }))
        };
    },

    async getOwnerNotifications() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: true, notifications: [] };
        const { data, error } = await supabase
            .from("notifications")
            .select("*")
            .eq("receiver_id", user.id)
            .order("created_at", { ascending: false });
        if (error) throw error;
        return {
            success: true,
            notifications: (data || []).map(n => ({
                _id: n.id,
                id: n.id,
                title: n.title,
                message: n.message,
                type: n.type || "general",
                isRead: !!n.is_read,
                createdAt: n.created_at
            }))
        };
    },

    async getOwnerAnnouncements() {
        const { data, error } = await supabase
            .from("announcements")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) throw error;
        return { success: true, announcements: data || [] };
    },

    async getOwnerMaintenances() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: true, maintenances: [] };
        const { data, error } = await supabase
            .from("maintenances")
            .select("*, properties(property_name), student:profiles!student_id(name)")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false });
        if (error) throw error;
        return { success: true, maintenances: data || [] };
    },

    async toggleOwnerPropertyPublish(id) {
        const { data: prop } = await supabase.from("properties").select("published").eq("id", id).single();
        const nextPublished = !prop || !prop.published;
        const { data, error } = await supabase
            .from("properties")
            .update({ published: nextPublished, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return { success: true, property: data };
    },

    async deleteOwnerProperty(id) {
        const { error } = await supabase.from("properties").delete().eq("id", id);
        if (error) throw error;
        return { success: true };
    },

    // Owner Profile & Unread Notifications
    async getOwnerProfile() {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error("Not authenticated");
        }

        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

        if (error) throw error;

        return {
            success: true,
            owner: {
                id: user.id,
                email: user.email,
                name: data ? (data.name || "") : (user.user_metadata?.name || user.email.split("@")[0]),
                phone: data ? (data.phone || "") : "",
                businessName: data ? (data.business_name || "") : "",
                city: data ? (data.city || "") : "",
                bio: data ? (data.bio || "") : "",
                profileImage: data ? (data.profile_image || data.avatar || "") : ""
            }
        };
    },

    async updateOwnerProfile(payload = {}) {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error("Not authenticated");
        }

        const updateData = {
            id: user.id,
            email: user.email,
            role: "owner",
            updated_at: new Date().toISOString()
        };

        if (payload.name !== undefined) updateData.name = payload.name;
        if (payload.phone !== undefined) updateData.phone = payload.phone;
        if (payload.businessName !== undefined) updateData.business_name = payload.businessName;
        if (payload.city !== undefined) updateData.city = payload.city;
        if (payload.bio !== undefined) updateData.bio = payload.bio;

        const { data, error } = await supabase
            .from("profiles")
            .upsert(updateData)
            .select()
            .single();

        if (error) throw error;

        try {
            if (typeof localStorage !== "undefined" || typeof sessionStorage !== "undefined") {
                const rawUser = localStorage.getItem("camporaUser") || sessionStorage.getItem("camporaUser");
                if (rawUser) {
                    const parsed = JSON.parse(rawUser);
                    if (data.name) parsed.name = data.name;
                    if (data.phone) parsed.phone = data.phone;
                    if (data.business_name) parsed.businessName = data.business_name;
                    if (data.city) parsed.city = data.city;
                    if (data.bio) parsed.bio = data.bio;
                    if (localStorage.getItem("camporaUser")) localStorage.setItem("camporaUser", JSON.stringify(parsed));
                    if (sessionStorage.getItem("camporaUser")) sessionStorage.setItem("camporaUser", JSON.stringify(parsed));
                }
            }
        } catch (e) {
            // non-blocking
        }

        return {
            success: true,
            owner: {
                id: data.id,
                email: data.email,
                name: data.name || "",
                phone: data.phone || "",
                businessName: data.business_name || "",
                city: data.city || "",
                bio: data.bio || "",
                profileImage: data.profile_image || data.avatar || ""
            }
        };
    },

    async changePassword(newPassword) {
        if (!newPassword || newPassword.length < 6) {
            throw new Error("Password must be at least 6 characters long.");
        }
        const { data, error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        return { success: true, message: "Password updated successfully" };
    },

    async getUnreadNotificationCount() {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return { success: true, count: 0 };

        const { count, error } = await supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("receiver_id", user.id)
            .eq("is_read", false);

        if (error) throw error;
        return { success: true, count: count || 0 };
    }
};
