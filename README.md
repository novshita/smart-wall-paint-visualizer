# 🎨 Smart Wall Paint Visualizer

> Preview wall paint colours and designs on your **own room photos** before you pick up a brush.

![Angular](https://img.shields.io/badge/Angular-22-DD0031?logo=angular&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

**Smart Wall Paint Visualizer** is a web app built on the **MEAN stack** (MongoDB, Express, Angular, Node.js). Upload a photo of your room, select the walls, try different colours and designs, and compare the before and after, all in your browser.

🔗 **Live demo:** _coming soon_ (add your deployed URL here)

---

## 📸 Screenshots

_Add screenshots or a short GIF here once the UI is ready._

| Upload | Wall Selection | Colour Preview |
|:------:|:--------------:|:--------------:|
| `docs/screenshots/upload.png` | `docs/screenshots/select.png` | `docs/screenshots/studio.png` |

---

## 🤔 Why this project?

Choosing a wall colour is hard. Shade cards don't show how a colour looks in *your* lighting and *your* room, and a wrong choice means repainting costs and regret. This app gives you a realistic preview so you can decide with confidence.

**Who is it for?**
- 🏠 Homeowners planning a repaint
- 🧑‍🎨 Interior designers and painters during client consultations
- 🏪 Paint retailers helping customers decide

---

## ✨ Features

**For users**
- 🔐 Register and log in securely
- 🖼️ Upload room photos (JPG/PNG)
- ✏️ Select walls manually with **brush** or **polygon** tools (with undo/redo, zoom and pan)
- 🎨 Apply solid colours, **dual-tone walls**, and basic patterns
- 🎚️ Adjust opacity, brightness, and finish (matte, satin, glossy)
- 🔀 Try multiple design variants on one image
- 👀 Compare **before and after** with a slider
- 💾 Save projects, reopen and edit them later
- ⬇️ Download the final image
- ⭐ Favourite colours and patterns

**For admins**
- 🗂️ Manage paint colours, shade details, and patterns
- 👥 Manage users and view activity and saved designs
- ⚙️ Configure system settings
- 📊 View a KPI dashboard (uploads, saved designs, session time, satisfaction)

> ℹ️ **Note:** Results are a visual guide. Actual colours may vary due to lighting, screen calibration, and wall texture.

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Angular 22 (standalone components), Angular Material, TypeScript, HTML5 Canvas, SVG, SCSS |
| **Backend** | Node.js, Express.js, RESTful APIs, JWT authentication |
| **Database** | MongoDB (Mongoose) |
| **Storage** | AWS S3 (or local disk in development) |
| **Deployment** | Vercel / Netlify (frontend), AWS or similar (backend), MongoDB Atlas |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- [Docker](https://www.docker.com/) (runs MongoDB locally), or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- Angular CLI is optional; the commands below use `npx ng`
- Git

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/smart-wall-paint-visualizer.git
cd smart-wall-paint-visualizer
```

### 2. Start MongoDB

```bash
docker compose up -d
```

This starts MongoDB 7 on `localhost:27017` with a persistent volume (`swpv-mongo-data`).

### 3. Set up the backend

```bash
cd server
npm install
cp .env.example .env
```

Open `.env` and fill in your values (at minimum, set a long random `JWT_SECRET`):

```env
PORT=5050
MONGODB_URI=mongodb://localhost:27017/wall-paint-visualizer
JWT_SECRET=replace_with_a_long_random_string
JWT_EXPIRES_IN=1h
CLIENT_URL=http://localhost:4200
MAX_UPLOAD_MB=10

# Seed admin account (used by `npm run seed`)
ADMIN_EMAIL=admin@swpv.local
ADMIN_PASSWORD=ChangeMe123!

# Optional: cloud image storage
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
AWS_REGION=
```

Seed the database with sample colours, patterns, default settings, and an admin account (safe to run more than once):

```bash
npm run seed
```

Start the API:

```bash
npm run dev
```

The API runs at `http://localhost:5050/api/v1`.

### 4. Set up the frontend

Open a new terminal:

```bash
cd client
npm install
npm start
```

During development, `/api` and `/static` requests are proxied to the API (`client/proxy.conf.json`), so no CORS setup is needed.

Open **http://localhost:4200** in your browser. 🎉

---

## 🧭 How to Use

1. **Sign up or log in.**
2. **Upload** a clear photo of your room.
3. **Select the wall** using the polygon or brush tool. Zoom in for precision.
4. **Pick a colour or pattern** from the library, or enter your own HEX code.
5. **Fine-tune** opacity, finish, and brightness.
6. **Compare** before and after with the slider.
7. **Save** your design or **download** the image.

> Tip: Photos taken in good, even lighting give the most realistic results.

---

## 📁 Project Structure

```
smart-wall-paint-visualizer/
├── client/                 # Angular frontend
│   └── src/app/
│       ├── core/           # auth, guards, interceptors
│       ├── shared/         # reusable components & models
│       └── features/       # landing, auth, dashboard, upload,
│                           # wall-selection, studio, colors,
│                           # projects, profile, help, admin
├── server/                 # Node + Express backend
│   └── src/
│       ├── config/
│       ├── models/         # Mongoose schemas
│       ├── routes/
│       ├── controllers/
│       ├── services/
│       └── middleware/
├── docs/
│   └── spec.md             # Full product & technical specification
└── README.md
```

---

## 🔌 API Overview

Base URL: `/api/v1`

| Area | Example Endpoints |
|------|------------------|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Projects | `GET /projects`, `POST /projects`, `PUT /projects/:id`, `DELETE /projects/:id` |
| Colours | `GET /colors`, `GET /colors/:id` (admin: create, update, delete, import) |
| Patterns | `GET /patterns` (admin: create, update, delete) |
| Favourites | `GET /me/favorites`, `POST /me/favorites/colors/:id` |
| Admin | `GET /admin/users`, `GET /admin/activity`, `GET /admin/analytics` |

Full interactive API docs (Swagger): `http://localhost:5050/api/docs`

---

## 🔒 Security

- Passwords are hashed with bcrypt
- JWT-based authentication with role-based access (User / Admin)
- Upload validation (file type, signature, and size limits)
- Helmet, CORS allow-list, rate limiting, and input sanitisation
- Users can only access their own projects

> Please upload only room images that you own or have permission to use.

---

## 🧪 Running Tests

```bash
# Backend (Mocha + Supertest + in-memory MongoDB)
cd server
npm test
npm run lint

# Frontend (Vitest)
cd client
npx ng test --watch=false
npx ng lint
```

---

## 🗺️ Roadmap

**Phase 1 (current)**
- [x] Product specification
- [x] Project foundation (API skeleton, models, seed data, Angular shell, CI)
- [x] Authentication and user roles (register, login, profile, password change, role guards)
- [x] Colour library (browse by family, search, filters, swatch detail, favourites)
- [x] Image upload (validation, metadata stripping, private signed links, dashboard recent designs)
- [x] Manual wall selection (polygon, brush, eraser, multiple walls, undo/redo, zoom/pan, soft edges)
- [x] Solid colour application with realistic blending, finishes, before/after, auto-save
- [x] Dual-tone walls, patterns, and design variants (with side-by-side variant comparison)
- [x] Save, reopen, and download designs (full-resolution PNG/JPG, before/after export, Saved Designs page)
- [ ] Admin panel and KPI dashboard
- [ ] Cloud deployment

**Future ideas**
- AI-based automatic wall detection
- Advanced textures and 3D previews
- Day and night lighting simulation
- Integration with paint brands and retailers
- Mobile app and AR live preview

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push the branch: `git push origin feature/your-feature`
5. Open a Pull Request

Please follow the existing code style (ESLint and Prettier) and keep changes focused.

---

## 📄 Documentation

- 📘 [Full specification](docs/spec.md)
- 🔌 API docs: available at `/api/docs` when the server is running

---

## 📝 License

This project is licensed under the [MIT License](LICENSE).

---

## 🙌 Acknowledgements

- Colour browsing UX inspired by common paint-catalogue patterns. All design, code, and assets in this project are original.
- Built as a practical demonstration of full-stack development with the MEAN stack.

---

<p align="center">Made with ❤️ to help people choose the right colour the first time.</p>
