# Campora - Student Accommodation Platform

Campora is a web-based student accommodation discovery and management platform.

## Project Structure

```
campora/
├── frontend/          # Web user interface (HTML, CSS, JavaScript, assets)
│   ├── pages/         # Role-based HTML pages (student, owner, admin, property)
│   ├── css/           # Modular CSS styles
│   ├── js/            # Client-side JavaScript modules
│   └── assets/        # Media assets (logos, images, icons)
├── backend/           # Node.js / Express API server
│   ├── controllers/   # Request handlers
│   ├── middleware/    # Auth, security, sanitization
│   ├── routes/        # API route definitions
│   └── services/      # Business logic layer
├── prisma/            # Database schema & migrations
├── docs/              # Project documentation
└── scripts/           # Maintenance and helper scripts
```

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Open your browser:
   [http://localhost:5000](http://localhost:5000)
