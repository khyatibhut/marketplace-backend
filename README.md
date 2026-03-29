# 🛒 Marketplace Backend - Order Processing & Live Status System

This project is a high-performance, real-time backend API for a marketplace. It features secure **JWT Role-Based Access Control (RBAC)**, **asynchronous order lifecycle management** using **BullMQ**, and **live status tracking** via **WebSockets (Socket.io)**.

---

## 🚀 Tech Stack

- **Runtime:** Node.js (Express)
- **Language:** TypeScript
- **Database:** MongoDB (via Mongoose)
- **Caching & Queuing:** Redis, BullMQ
- **Real-Time Communication:** Socket.io
- **Validation:** Zod
- **Security:** JWT Authentication, Bcrypt Password Hashing

---



## 📂 Project Structure

```text
src/
├── config/           # Database connections, Redis & Environment setup
├── controllers/      # Request handlers (Auth, Product, Order, etc.)
├── interfaces/       # Global TypeScript types and interfaces
├── middlewares/      # Guards (Auth, Roles, Validation)
├── models/           # Mongoose schemas (User, Product, Order, etc.)
├── queues/           # BullMQ producers for background jobs
├── routes/           # API Endpoint definitions
├── services/         # Business logic layer
├── sockets/          # Socket.io connection logic & rooms
├── utils/            # Shared helpers (Logger, Errors, Validators)
└── workers/          # BullMQ consumers (Lifecycle transitions, Stock updates)
```

---

## 🛠 Features Breakdown

### 🔐 Authentication & Security
- **JWT-Based RBAC:** Secure access for **Buyers**, **Sellers**, and **Admins**.
- **Secure Registration:** Passwords are hashed using Bcrypt before storage.
- **Heartbeat Endpoint:** Validate session status in real-time.

### 📦 Product Management
- **Seller Controls:** Sellers can create, update, and manage their own products.
- **Dynamic Stock:** Real-time stock status and automated inventory deduction.
- **Category Support:** Organize items into manageable categories for better discovery.

### 📝 Order Lifecycle (Background Processing)
Orders move through an automated lifecycle using background worker queues:
- `placed` ➡️ `confirmed` ➡️ `preparing` ➡️ `out_for_delivery` ➡️ `delivered`
- **Async Processing:** Lifecycle transitions occur in the background via **BullMQ**, ensuring the API remains responsive.
- **Stock Guard:** Inventory is automatically deducted upon order placement.

### 📡 Real-Time Status Tracking
- **Socket.io Integration:** Live status updates for buyers and sellers.
- **Room-Based Updates:** 
  - `user:{id}`: Personal order status changes.
  - `seller:{id}`: Notifications for new orders and inventory changes.
  - `admin`: Global system events.

### 📊 Bonus Capabilities
- **Seller Analytics:** Dashboard with revenue tracking and order statistics.
- **Webhooks:** Subscribe external systems to marketplace events.
- **Rating System:** Post-delivery review capabilities for product quality feedback.

---

## ⚙️ Getting Started

### 1. Prerequisites
- **Node.js** (v18+)
- **MongoDB** (Local or Atlas)
- **Redis** (Local instance for queue & cache)

### 2. Installation
```bash
# Clone the repository and install dependencies
npm install
```

### 3. Environment Configuration
Copy the `.env.example` and update your credentials:
```bash
cp .env.example .env
```

### 4. Run Development Server
```bash
npm run dev
```

---

## 🧪 Testing with Postman

We have provided a complete Postman collection and environment for easy API consumption.

### Import Instructions:
1.  **Collection:** Import `marketplace_postman_collection.json`.
2.  **Environment:** Import [marketplace_postman_environment.json](./marketplace_postman_environment.json).
3.  **Execution:** Use the "Login User" request; the environment `token` will automatically be updated for subsequent requests.

---

## 📡 API Reference Overview

| Domain | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | POST | `/api/auth/register` | Create a new account |
| **Auth** | POST | `/api/auth/login` | Authenticate and get token |
| **Products** | GET | `/api/products` | Browse all products (Search/Filter) |
| **Orders** | POST | `/api/orders` | Place a new order |
| **Orders** | GET | `/api/orders/:id/status` | Track live order status |
| **Analytics** | GET | `/api/analytics` | View revenue dashboard (Sellers) |
| **Webhooks** | POST | `/api/webhooks` | Subscribe to status updates |

---

## 📜 License
This project is licensed under the **ISC License**.
