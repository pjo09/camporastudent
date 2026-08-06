const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function copyFile(src, dest) {
    if (fs.existsSync(src)) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        console.log(`Copied: ${path.relative(ROOT, src)} -> ${path.relative(ROOT, dest)}`);
    } else {
        console.warn(`Source missing: ${path.relative(ROOT, src)}`);
    }
}

function writeFile(dest, content) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content, 'utf8');
    console.log(`Created/Updated: ${path.relative(ROOT, dest)}`);
}

// 1. Move/Copy HTML files
const htmlMap = {
    // Root HTML files
    'frontend/index.html': 'frontend/index.html',
    'frontend/login.html': 'frontend/login.html',
    'frontend/register.html': 'frontend/signup.html',
    'frontend/properties.html': 'frontend/properties.html',
    'frontend/contact.html': 'frontend/contact.html',

    // Student Pages
    'frontend/dashboard.html': 'frontend/pages/student/dashboard.html',
    'frontend/dashboard-new.html': 'frontend/pages/student/dashboard-new.html',
    'frontend/profile.html': 'frontend/pages/student/profile.html',
    'frontend/bookings.html': 'frontend/pages/student/bookings.html',
    'frontend/booking.html': 'frontend/pages/student/booking-details.html',
    'frontend/saved-properties.html': 'frontend/pages/student/saved-properties.html',
    'frontend/notifications.html': 'frontend/pages/student/notifications.html',
    'frontend/messages.html': 'frontend/pages/student/messages.html',
    'frontend/nearby.html': 'frontend/pages/student/nearby.html',
    'frontend/analytics.html': 'frontend/pages/student/analytics.html',
    'frontend/settings.html': 'frontend/pages/student/settings.html',
    'frontend/documents.html': 'frontend/pages/student/documents.html',
    'frontend/maintenance.html': 'frontend/pages/student/maintenance.html',
    'frontend/payment.html': 'frontend/pages/student/payment.html',
    'frontend/payments.html': 'frontend/pages/student/payments.html',
    'frontend/reviews.html': 'frontend/pages/student/reviews.html',
    'frontend/success.html': 'frontend/pages/student/success.html',
    'frontend/support.html': 'frontend/pages/student/support.html',

    // Owner Pages
    'frontend/owner-dashboard.html': 'frontend/pages/owner/dashboard.html',
    'frontend/owner-properties.html': 'frontend/pages/owner/properties.html',
    'frontend/add-property.html': 'frontend/pages/owner/add-property.html',
    'frontend/owner-bookings.html': 'frontend/pages/owner/bookings.html',
    'frontend/owner-students.html': 'frontend/pages/owner/tenants.html',
    'frontend/owner-payments.html': 'frontend/pages/owner/payments.html',
    'frontend/owner-reviews.html': 'frontend/pages/owner/reviews.html',
    'frontend/owner-analytics.html': 'frontend/pages/owner/analytics.html',
    'frontend/owner-messages.html': 'frontend/pages/owner/messages.html',
    'frontend/owner-notifications.html': 'frontend/pages/owner/notifications.html',
    'frontend/owner-settings.html': 'frontend/pages/owner/settings.html',
    'frontend/owner-maintenance.html': 'frontend/pages/owner/maintenance.html',

    // Admin Pages
    'frontend/admin-dashboard.html': 'frontend/pages/admin/dashboard.html',

    // Property Pages
    'frontend/property-details.html': 'frontend/pages/property/property.html',
    'frontend/property.html': 'frontend/pages/property/property-simple.html',
};

Object.entries(htmlMap).forEach(([srcRel, destRel]) => {
    copyFile(path.join(ROOT, srcRel), path.join(ROOT, destRel));
});

// Create missing requested HTML files as clean stubs if they don't exist
const extraHtml = [
    { file: 'frontend/forgot-password.html', title: 'Forgot Password - Campora', baseDepth: '' },
    { file: 'frontend/universities.html', title: 'Universities - Campora', baseDepth: '' },
    { file: 'frontend/pages/owner/edit-property.html', title: 'Edit Property - Campora Owner', baseDepth: '../../' },
    { file: 'frontend/pages/owner/rooms.html', title: 'Manage Rooms - Campora Owner', baseDepth: '../../' },
    { file: 'frontend/pages/admin/login.html', title: 'Admin Login - Campora', baseDepth: '../../' },
    { file: 'frontend/pages/admin/users.html', title: 'Manage Users - Campora Admin', baseDepth: '../../' },
    { file: 'frontend/pages/admin/owners.html', title: 'Manage Owners - Campora Admin', baseDepth: '../../' },
    { file: 'frontend/pages/admin/properties.html', title: 'Manage Properties - Campora Admin', baseDepth: '../../' },
    { file: 'frontend/pages/admin/bookings.html', title: 'Manage Bookings - Campora Admin', baseDepth: '../../' },
    { file: 'frontend/pages/admin/reports.html', title: 'Reports - Campora Admin', baseDepth: '../../' },
    { file: 'frontend/pages/admin/contact.html', title: 'Support Messages - Campora Admin', baseDepth: '../../' },
    { file: 'frontend/pages/admin/settings.html', title: 'Admin Settings - Campora', baseDepth: '../../' },
    { file: 'frontend/pages/property/compare.html', title: 'Compare Properties - Campora', baseDepth: '../../' },
    { file: 'frontend/pages/property/review.html', title: 'Property Review - Campora', baseDepth: '../../' }
];

extraHtml.forEach(({ file, title, baseDepth }) => {
    const fullPath = path.join(ROOT, file);
    if (!fs.existsSync(fullPath)) {
        const stub = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="stylesheet" href="${baseDepth}css/base.css">
    <link rel="stylesheet" href="${baseDepth}css/components.css">
</head>
<body>
    <div id="app">
        <h1>${title}</h1>
    </div>
    <script src="${baseDepth}js/config.js"></script>
    <script src="${baseDepth}js/app.js"></script>
</body>
</html>`;
        writeFile(fullPath, stub);
    }
});

// 2. Move Assets
const assetMap = {
    'frontend/images/logo.png': 'frontend/assets/logos/logo.png',
    'frontend/images/hero-room.png': 'frontend/assets/images/hero-room.png',
    'frontend/images/google.png': 'frontend/assets/images/google.png',
    'frontend/images/property-placeholder.jpg': 'frontend/assets/images/property-placeholder.jpg',
};

Object.entries(assetMap).forEach(([srcRel, destRel]) => {
    copyFile(path.join(ROOT, srcRel), path.join(ROOT, destRel));
    // Keep legacy path for backwards compatibility
    copyFile(path.join(ROOT, srcRel), path.join(ROOT, srcRel));
});

// 3. Move JavaScript Files into domain folders
const jsMap = {
    // Shared Root JS
    'frontend/js/api.js': 'frontend/js/api.js',
    'frontend/js/config.js': 'frontend/js/config.js',
    'frontend/js/notifications.js': 'frontend/js/notifications.js',
    'frontend/js/theme.js': 'frontend/js/theme.js',
    'frontend/js/main.js': 'frontend/js/app.js',

    // Student JS
    'frontend/js/student-dashboard.js': 'frontend/js/student/student-dashboard.js',
    'frontend/js/student-bookings.js': 'frontend/js/student/student-bookings.js',
    'frontend/js/student-booking.js': 'frontend/js/student/student-booking.js',
    'frontend/js/student-profile.js': 'frontend/js/student/student-profile.js',
    'frontend/js/student-messages.js': 'frontend/js/student/student-messages.js',
    'frontend/js/student-notifications.js': 'frontend/js/student/student-notifications.js',
    'frontend/js/student-analytics.js': 'frontend/js/student/student-analytics.js',
    'frontend/js/student-saved.js': 'frontend/js/student/student-saved.js',
    'frontend/js/student-maintenance.js': 'frontend/js/student/student-maintenance.js',
    'frontend/js/student-explore.js': 'frontend/js/student/student-explore.js',
    'frontend/js/student-documents.js': 'frontend/js/student/student-documents.js',
    'frontend/js/student-payments.js': 'frontend/js/student/student-payments.js',
    'frontend/js/student-reviews.js': 'frontend/js/student/student-reviews.js',
    'frontend/js/student-settings.js': 'frontend/js/student/student-settings.js',
    'frontend/js/student-support.js': 'frontend/js/student/student-support.js',
    'frontend/js/student-utils.js': 'frontend/js/student/student-utils.js',

    // Owner JS
    'frontend/js/owner-dashboard-v3.js': 'frontend/js/owner/owner-dashboard-v3.js',
    'frontend/js/owner-properties.js': 'frontend/js/owner/owner-properties.js',
    'frontend/js/owner-bookings.js': 'frontend/js/owner/owner-bookings.js',
    'frontend/js/owner-payments.js': 'frontend/js/owner/owner-payments.js',
    'frontend/js/owner-students.js': 'frontend/js/owner/owner-students.js',
    'frontend/js/owner-analytics.js': 'frontend/js/owner/owner-analytics.js',
    'frontend/js/owner-messages.js': 'frontend/js/owner/owner-messages.js',
    'frontend/js/owner-notifications.js': 'frontend/js/owner/owner-notifications.js',
    'frontend/js/owner-maintenance.js': 'frontend/js/owner/owner-maintenance.js',
    'frontend/js/owner-reviews.js': 'frontend/js/owner/owner-reviews.js',
    'frontend/js/owner-settings.js': 'frontend/js/owner/owner-settings.js',
    'frontend/js/owner-shell.js': 'frontend/js/owner/owner-shell.js',
    'frontend/js/add-property.js': 'frontend/js/owner/add-property.js',

    // Admin JS
    'frontend/js/admin-dashboard.js': 'frontend/js/admin/admin-dashboard.js',

    // Property JS
    'frontend/js/property-details.js': 'frontend/js/property/property-details.js',
    'frontend/js/property.js': 'frontend/js/property/property.js',
    'frontend/js/property-upload.js': 'frontend/js/property/property-upload.js',
};

Object.entries(jsMap).forEach(([srcRel, destRel]) => {
    copyFile(path.join(ROOT, srcRel), path.join(ROOT, destRel));
});

const extraJs = [
    { file: 'frontend/js/auth.js', content: '// Campora Shared Auth Utilities\n' },
    { file: 'frontend/js/utils.js', content: '// Campora Shared General Utilities\n' }
];
extraJs.forEach(({ file, content }) => {
    const fullPath = path.join(ROOT, file);
    if (!fs.existsSync(fullPath)) {
        writeFile(fullPath, content);
    }
});

// 4. Organize CSS files
const cssMap = {
    'frontend/css/index.css': 'frontend/css/landing.css',
    'frontend/css/auth.css': 'frontend/css/auth.css',
    'frontend/css/dashboard-v2.css': 'frontend/css/dashboard.css',
    'frontend/css/owner-v3.css': 'frontend/css/owner.css',
    'frontend/css/property.css': 'frontend/css/property.css',
};
Object.entries(cssMap).forEach(([srcRel, destRel]) => {
    copyFile(path.join(ROOT, srcRel), path.join(ROOT, destRel));
});

const extraCss = [
    { file: 'frontend/css/base.css', content: '/* Base Styles */\n' },
    { file: 'frontend/css/components.css', content: '/* Components Styles */\n' },
    { file: 'frontend/css/admin.css', content: '/* Admin Styles */\n' },
    { file: 'frontend/css/responsive.css', content: '/* Responsive Styles */\n' }
];
extraCss.forEach(({ file, content }) => {
    const fullPath = path.join(ROOT, file);
    if (!fs.existsSync(fullPath)) {
        writeFile(fullPath, content);
    }
});

// 5. Update references inside HTML files under frontend/
function updateHtmlFileContent(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const isSubPage = filePath.includes(path.normalize('frontend/pages/'));
    const prefix = isSubPage ? '../../' : '';

    // Update CSS paths
    content = content.replace(/(href=["'])css\//g, `$1${prefix}css/`);

    // Update JS paths
    content = content.replace(/(src=["'])js\/(student-[^"'\s]+\.js)/g, `$1${prefix}js/student/$2`);
    content = content.replace(/(src=["'])js\/(owner-[^"'\s]+\.js)/g, `$1${prefix}js/owner/$2`);
    content = content.replace(/(src=["'])js\/(add-property\.js)/g, `$1${prefix}js/owner/$2`);
    content = content.replace(/(src=["'])js\/(admin-dashboard\.js)/g, `$1${prefix}js/admin/$2`);
    content = content.replace(/(src=["'])js\/(property-details\.js|property\.js|property-upload\.js)/g, `$1${prefix}js/property/$2`);
    content = content.replace(/(src=["'])js\//g, `$1${prefix}js/`);

    // Update Image / Asset paths
    content = content.replace(/(src=["'\(]|url\(["']?)images\/logo\.png/g, `$1${prefix}assets/logos/logo.png`);
    content = content.replace(/(src=["'\(]|url\(["']?)images\/hero-room\.png/g, `$1${prefix}assets/images/hero-room.png`);
    content = content.replace(/(src=["'\(]|url\(["']?)images\/google\.png/g, `$1${prefix}assets/images/google.png`);
    content = content.replace(/(src=["'\(]|url\(["']?)images\/property-placeholder\.jpg/g, `$1${prefix}assets/images/property-placeholder.jpg`);
    content = content.replace(/(src=["'])images\//g, `$1${prefix}assets/images/`);

    // Update HTML links to new pages
    content = content.replace(/register\.html/g, isSubPage ? '../../signup.html' : 'signup.html');
    content = content.replace(/index\.html/g, isSubPage ? '../../index.html' : 'index.html');
    content = content.replace(/login\.html/g, isSubPage ? '../../login.html' : 'login.html');
    content = content.replace(/properties\.html/g, isSubPage ? '../../properties.html' : 'properties.html');
    content = content.replace(/contact\.html/g, isSubPage ? '../../contact.html' : 'contact.html');

    content = content.replace(/owner-dashboard\.html/g, isSubPage ? '../owner/dashboard.html' : 'pages/owner/dashboard.html');
    content = content.replace(/admin-dashboard\.html/g, isSubPage ? '../admin/dashboard.html' : 'pages/admin/dashboard.html');
    content = content.replace(/property-details\.html/g, isSubPage ? '../property/property.html' : 'pages/property/property.html');

    fs.writeFileSync(filePath, content, 'utf8');
}

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        const fullPath = path.join(dir, f);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath, callback);
        } else {
            callback(fullPath);
        }
    });
}

walkDir(path.join(ROOT, 'frontend'), (filePath) => {
    if (filePath.endsWith('.html')) {
        updateHtmlFileContent(filePath);
    }
});

console.log('HTML files reference updates completed.');

// 6. Update JS files window.location.href redirects
walkDir(path.join(ROOT, 'frontend/js'), (filePath) => {
    if (filePath.endsWith('.js')) {
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(/register\.html/g, '/signup.html');
        content = content.replace(/owner-dashboard\.html/g, '/pages/owner/dashboard.html');
        content = content.replace(/admin-dashboard\.html/g, '/pages/admin/dashboard.html');
        content = content.replace(/property-details\.html/g, '/pages/property/property.html');
        content = content.replace(/dashboard-new\.html/g, '/pages/student/dashboard.html');
        content = content.replace(/dashboard\.html/g, '/pages/student/dashboard.html');
        content = content.replace(/booking\.html/g, '/pages/student/booking-details.html');
        content = content.replace(/owner-properties\.html/g, '/pages/owner/properties.html');
        content = content.replace(/add-property\.html/g, '/pages/owner/add-property.html');
        content = content.replace(/owner-bookings\.html/g, '/pages/owner/bookings.html');
        content = content.replace(/owner-students\.html/g, '/pages/owner/tenants.html');
        content = content.replace(/owner-payments\.html/g, '/pages/owner/payments.html');
        content = content.replace(/owner-reviews\.html/g, '/pages/owner/reviews.html');
        content = content.replace(/owner-analytics\.html/g, '/pages/owner/analytics.html');
        content = content.replace(/owner-messages\.html/g, '/pages/owner/messages.html');
        content = content.replace(/owner-notifications\.html/g, '/pages/owner/notifications.html');
        content = content.replace(/owner-settings\.html/g, '/pages/owner/settings.html');
        content = content.replace(/owner-maintenance\.html/g, '/pages/owner/maintenance.html');

        content = content.replace(/images\/logo\.png/g, 'assets/logos/logo.png');
        content = content.replace(/images\/hero-room\.png/g, 'assets/images/hero-room.png');
        content = content.replace(/images\/google\.png/g, 'assets/images/google.png');
        content = content.replace(/images\/property-placeholder\.jpg/g, 'assets/images/property-placeholder.jpg');

        fs.writeFileSync(filePath, content, 'utf8');
    }
});

console.log('JS files reference updates completed.');

// 7. Update CSS files image references
walkDir(path.join(ROOT, 'frontend/css'), (filePath) => {
    if (filePath.endsWith('.css')) {
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(/images\/logo\.png/g, '../assets/logos/logo.png');
        content = content.replace(/images\/hero-room\.png/g, '../assets/images/hero-room.png');
        content = content.replace(/images\/google\.png/g, '../assets/images/google.png');
        content = content.replace(/images\/property-placeholder\.jpg/g, '../assets/images/property-placeholder.jpg');
        content = content.replace(/images\//g, '../assets/images/');
        fs.writeFileSync(filePath, content, 'utf8');
    }
});

console.log('CSS files reference updates completed.');
