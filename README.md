# 🍱 NutriTiffin Backend

> **Connecting Home Kitchens with Healthy Eaters through Robust Technology.**

![NestJS](https://img.shields.io/badge/nestjs-%23E0234E.svg?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Postgres](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![AWS S3](https://img.shields.io/badge/AWS%20S3-%23FF9900.svg?style=for-the-badge&logo=amazon-aws&logoColor=white)

---

## 🚀 The Mission

**NutriTiffin** is a comprehensive food delivery platform designed to bridge the gap between talented home chefs and individuals seeking authentic, healthy, home-cooked meals. 

Unlike generic food delivery apps, NutriTiffin focuses on specific dietary needs, scheduled meal subscriptions, and empowering small-scale kitchen owners with professional management tools.

### Key Value Proposition
-   **For Clients**: Access to verified home-cooked meals, subscription plans, and transparent nutritional info.
-   **For Kitchens**: A "business-in-a-box" solution for managing menus, orders, and earnings.
-   **For Logistics**: An efficient, gig-economy friendly driver dispatch system.

---

## 🏗️ System Architecture

The backend is built as a modular monolith using **NestJS**, ensuring strict separation of concerns and type safety throughout the stack.

### High-Level Data Flow
1.  **Client/Kitchen/Driver Apps** communicate via RESTful JSON APIs.
2.  **API Gateway (NestJS)** handles authentication (JWT) and routing.
3.  **Service Layer** contains complex business logic (pricing, availability checks).
4.  **Data Layer** uses **TypeORM** interactions with **PostgreSQL** for ACID compliance.
5.  **Async Layer** offloads heavy tasks (notifications, reports) to **BullMQ** & **Redis**.
6.  **Storage Layer** manages media assets via **AWS S3**.

---

## 🛠️ Tech Stack & Engineering Decisions

We chose a modern, scalable stack to ensure performance and maintainability:

### Core Framework
-   **[NestJS](https://nestjs.com/) (Node.js)**: Chosen for its opinionated architecture, dependency injection, and best-in-class TypeScript support. It allows for easy testing and modular scaling.
-   **[TypeScript](https://www.typescriptlang.org/)**: Enforces type safety, reducing runtime errors and improving developer velocity with better tooling.

### Data & Storage
-   **[PostgreSQL](https://www.postgresql.org/)**: The primary relational database. selected for its reliability, JSONB support, and powerful querying capabilities for complex order relations.
-   **[TypeORM](https://typeorm.io/)**: Provides an abstraction layer for database interactions, simplifying migrations and query building.
-   **[Redis](https://redis.io/)**: Used for caching frequently accessed data (like menus) and managing job queues.
-   **[AWS S3](https://aws.amazon.com/s3/)**: Scalable object storage for user avatars and food images.

### Infrastructure & DevOps
-   **[Docker](https://www.docker.com/)**: Fully containerized environment ensuring consistency from development to production.
-   **[BullMQ](https://docs.bullmq.io/)**: Handles background job processing (e.g., "End of Day" kitchen summaries), ensuring the main API remains responsive.

---

## 📂 Documentation Map

We maintain detailed documentation for each core module:

-   🍎 **[Client Features](docs/Client.md)**: User registration, meal discovery, and order placement flows.
-   🖥️ **[Frontend Integration](docs/frontend.md)**: Guide for frontend developers.
-   👨‍🍳 **[Kitchen Management](docs/Kitchen.md)**: Dashboard features for menu creation and order acceptance.
-   🚚 **[Delivery Logistics](docs/delivery.md)**: Driver workflows for job discovery and fulfillment.
-   📡 **[API Endpoints](docs/endpoints.md)**: comprehensive API reference.
-   🐳 **[Docker & Queues](docs/bullmq-docker.md)**: Infrastructure setup guide.
-   🧪 **[Postman Collection](docs/postman.md)**: Ready-to-use collection for API testing.

---

## ✨ Features Spotlight

-   **💳 Secure Credit System**: Built-in integer-based Rupee credit wallets. Utilizes TypeORM transaction blocks with pessimistic row-level locking to guarantee safe balance operations under high concurrency.
-   **👑 Admin Management Tools**: Secure endpoints allowing Admins to manage user access, securely alter credit allocations, and monitor the user base.
-   **🔐 Role-Based Access Control (RBAC)**: Secure separation of duties between Admins, Owners, Clients, and Drivers using Guards and Decorators.
-   **📅 Smart Availability**: Menus automatically reset based on daily limits and operating hours.
-   **🔄 Order States**: Finite state machine implementation for orders (`PENDING` -> `ACCEPTED` -> `OUT_FOR_DELIVERY` -> `DELIVERED` -> `CANCELLED`).
-   **📍 Geolocation Ready**: Schema designed to support location-based kitchen discovery (future roadmap).

---

## 🚀 Getting Started

### Prerequisites
-   Node.js v18+
-   Docker & Docker Compose (Recommended)

### Quick Start (Docker)
The easiest way to run the full stack (API + DB + Redis):

1.  **Clone the repo**:
    ```bash
    git clone https://github.com/Ur-Code-Buddy/nutribackend.git
    cd nutribackend
    ```

2.  **Configure Environment**:
    ```bash
    cp .env.example .env
    # Update AWS / DB credentials in .env if needed
    ```

3.  **Launch**:
    ```bash
    docker-compose up --build
    ```
    The API will be available at `https://backend.v1.nutritiffin.com`.

### Running Tests
We emphasize quality code. Run our comprehensive test suite:

```bash
# Unit Tests
npm run test

# End-to-End Tests
npm run test:e2e
```

---

## 👥 Contributors

Built with passion by **Ur-Code-Buddy**.

---
*For recruitment inquiries or detailed architecture walkthroughs, please verify the `docs/` folder.*
