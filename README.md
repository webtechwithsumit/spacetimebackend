# Spacetime API

Node.js Express backend with Scalar API documentation.

## Setup

```bash
npm install
```

MongoDB connection string `.env` me `MONGODB_URI` set karo (already set hai agar tumne diya hai). Naya setup ho to: `cp .env.example .env` karke apna URI daalo.

## Run

```bash
# Production
npm start

# Development (auto-reload)
npm run dev
```

## Swagger – Saari APIs dekhna

Server start karne ke baad browser me open karo:

**http://localhost:3000/api-docs**

Yahan saari APIs list hogi. Har API ko try kar sakte ho (Try it out).

## APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/users` | Get all users |
| GET | `/api/users/:id` | Get user by ID |
| POST | `/api/users` | Create user |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |
| GET | `/api/items` | Get all items |
| GET | `/api/items/:id` | Get item by ID |
| POST | `/api/items` | Create item |
| PUT | `/api/items/:id` | Update item |
| DELETE | `/api/items/:id` | Delete item |

Data MongoDB me store hota hai. Collection: `users`.

## Production – API docs (/reference)

Production me **Scalar API docs** yahan milte hain: `https://your-domain.com/reference`

- **.env** me set karo: `BASE_URL=https://api.yourdomain.com` (apna domain use karo).
- Agar `/reference` open karne par **404** ya page nahi dikhe, to **reverse proxy (Nginx/Caddy)** me ye path Node app tak forward karna zaroori hai. Example (Nginx):

```nginx
location / {
    proxy_pass http://127.0.0.1:3002;   # jis port par Node chal raha hai
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

`location /` sab paths (including `/reference`) Node ko bhej dega. Proxy ke baad Node restart karo aur `/reference` dubara try karo.
# spacetimebackend
