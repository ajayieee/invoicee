# Standalone Node.js & Express Backend with MongoDB Atlas

This is the standalone Node.js and Express backend service for the UAE FTA Tax Invoicing application.

---

## 🏗️ Architecture

```
server/
├── src/
│   ├── config/
│   │   └── db.ts                # Mongoose connection to MongoDB Atlas
│   ├── models/                  # Mongoose Schemas & TypeScript interfaces
│   │   ├── User.ts              # Authentication & RBAC roles
│   │   ├── CompanySettings.ts   # UAE TRN, Legal entity, bank accounts
│   │   ├── Customer.ts          # Customer entity with UAE Emirate & TRN
│   │   ├── Product.ts           # Product catalog & default VAT rates
│   │   ├── VatRate.ts           # UAE VAT rates (Standard 5%, Zero, Exempt)
│   │   ├── PaymentMethod.ts     # Bank Transfer, Cash, Card, Cheque
│   │   ├── Invoice.ts           # Sequential Tax Invoices & Article 25 discounts
│   │   ├── Payment.ts           # Payment collections & reversal audits
│   │   ├── CreditNote.ts        # UAE Credit Notes linked to original invoices
│   │   ├── Quote.ts             # Quotations and conversion to invoice
│   │   └── AuditLog.ts          # Tamper-evident accounting audit logs
│   ├── middleware/
│   │   ├── auth.middleware.ts   # JWT verification & role authorization
│   │   └── error.middleware.ts  # Global error formatting
│   ├── utils/
│   │   └── vatCalculator.ts     # Server-side Decimal.js commercial rounding
│   ├── controllers/             # Request handlers & business logic
│   │   ├── auth.controller.ts
│   │   ├── invoice.controller.ts
│   │   ├── payment.controller.ts
│   │   ├── customer.controller.ts
│   │   ├── creditNote.controller.ts
│   │   ├── quote.controller.ts
│   │   ├── report.controller.ts
│   │   └── settings.controller.ts
│   ├── routes/                  # Express Router modules
│   │   ├── auth.routes.ts
│   │   ├── invoice.routes.ts
│   │   ├── payment.routes.ts
│   │   ├── customer.routes.ts
│   │   ├── creditNote.routes.ts
│   │   ├── quote.routes.ts
│   │   ├── report.routes.ts
│   │   ├── settings.routes.ts
│   │   └── index.ts             # Main /api router
│   ├── scripts/
│   │   └── seed.ts              # Initial UAE data seeder
│   └── server.ts                # Express app entrypoint & graceful shutdown
├── .env                         # Server environment variables (PORT, MONGODB_URI, JWT_SECRET)
├── package.json
└── tsconfig.json
```

---

## 🚀 Quick Start Guide

### 1. MongoDB Atlas Setup
1. Log in to [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Create a free **M0 Sandbox** cluster.
3. Under **Database Access**, create a user with read and write permissions (e.g., username `admin`, password `your_password`).
4. Under **Network Access**, add IP address `0.0.0.0/0` (allow access from anywhere) or your current IP.
5. Click **Connect** → **Drivers** (Node.js) and copy the connection string.
6. Open [`server/.env`](file:///c:/Users/lenovo/Desktop/1-invoice/server/.env) and paste your URI:
   ```env
   MONGODB_URI=mongodb+srv://admin:your_password@cluster0.abcde.mongodb.net/uae_invoicing?retryWrites=true&w=majority
   ```

### 2. Seed the Database (Development / Demo Data Only)
Run the automated seed script to populate initial UAE VAT rates, Demo Company Settings, and sample invoices:
```bash
cd server
npm run seed
```

#### Secure Credential Handling in Seed:
* Passwords are **never hardcoded**.
* You can configure your own initial credentials in `server/.env`:
  ```env
  SEED_ADMIN_EMAIL=admin@yourcompany.ae
  SEED_ADMIN_PASSWORD=YourCustomSecurePassword
  ```
* If `SEED_ADMIN_PASSWORD` is omitted, the script automatically generates a cryptographically random, one-time password and displays it once in your terminal console.
* All passwords are stored using **bcrypt** (12 salt rounds) in MongoDB Atlas.

#### Safety Guards in Seed:
* **Production Guard**: The script automatically aborts if `NODE_ENV === 'production'`.
* **Overwrite Protection**: If the database already contains users or invoices, the script blocks accidental deletion unless `--confirm-reset` or `ALLOW_DESTRUCTIVE_SEED=true` is explicitly provided.

---

### 3. Alternative: One-Time Admin Setup (No Demo Data)
If you prefer not to seed demo invoices and start with a clean database:
1. Start the server (`npm run dev`).
2. Make a `POST` request to `/api/auth/setup-admin`:
   ```bash
   curl -X POST http://localhost:5000/api/auth/setup-admin \
     -H "Content-Type: application/json" \
     -d '{"name": "Your Name", "email": "admin@yourcompany.ae", "password": "YourStrongPassword"}'
   ```
3. Once the initial admin is created, this endpoint is **permanently locked**.

---

### 4. Start the Backend Server
```bash
npm run dev
```
The server will start listening at: `http://localhost:5000`
Health check: `http://localhost:5000/health`

---

## 📡 REST API Endpoints Overview

| Method | Endpoint | Description | Role Required |
| :--- | :--- | :--- | :--- |
| `GET`  | `/api/auth/setup-status` | Check if initial admin setup is required | Public |
| `POST` | `/api/auth/setup-admin` | One-time initial admin setup | Public (Locked once admin exists) |
| `POST` | `/api/auth/login` | User login & JWT issuance | Public |
| `POST` | `/api/auth/register` | User registration | Public |
| `GET` | `/api/auth/me` | Fetch authenticated user | Any authenticated |
| `GET` | `/api/invoices` | List invoices (search, filters, pagination) | Any authenticated |
| `GET` | `/api/invoices/:id` | Get single invoice details | Any authenticated |
| `POST` | `/api/invoices` | Create new invoice (Draft or Issued) | Owner, Accountant, Sales |
| `PUT` | `/api/invoices/:id` | Update draft invoice | Owner, Accountant, Sales |
| `POST` | `/api/invoices/:id/issue` | Issue official tax invoice | Owner, Accountant |
| `POST` | `/api/invoices/:id/duplicate` | Duplicate invoice as draft | Owner, Accountant, Sales |
| `POST` | `/api/invoices/:id/cancel` | Void/cancel issued invoice with audit reason | Owner, Accountant |
| `GET` | `/api/payments` | List payment receipts | Any authenticated |
| `POST` | `/api/payments` | Record payment & update balance/status | Owner, Accountant |
| `POST` | `/api/payments/:id/reverse` | Reverse payment & reopen balance | Owner, Accountant |
| `GET` | `/api/customers` | List corporate customers & entities | Any authenticated |
| `GET` | `/api/customers/:id/360` | Full 360° customer overview & invoice list | Any authenticated |
| `POST` | `/api/customers` | Register new customer | Owner, Accountant, Sales |
| `PUT` | `/api/customers/:id` | Update customer details | Owner, Accountant, Sales |
| `DELETE`| `/api/customers/:id` | Delete customer (safeguarded against invoices)| Owner, Accountant |
| `GET` | `/api/credit-notes` | List credit notes | Any authenticated |
| `POST` | `/api/credit-notes` | Issue credit note & offset invoice balance | Owner, Accountant |
| `GET` | `/api/quotes` | List quotations | Any authenticated |
| `POST` | `/api/quotes/:id/convert` | Convert quotation to draft invoice | Owner, Accountant, Sales |
| `GET` | `/api/reports/dashboard-metrics`| Real-time executive KPIs & overdue stats | Any authenticated |
| `GET` | `/api/reports/customer-statement`| Chronological debit/credit account statement | Any authenticated |
| `GET` | `/api/settings/company` | UAE company settings & bank details | Any authenticated |
| `PUT` | `/api/settings/company` | Update company settings & sequence prefixes | Owner, Accountant |
| `GET` | `/api/settings/vat-rates` | List active FTA VAT rates | Any authenticated |
| `GET` | `/api/settings/payment-methods` | List supported payment methods | Any authenticated |
