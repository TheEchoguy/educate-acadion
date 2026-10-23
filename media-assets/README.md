# Acadion Media Assets Directory

> **Centralized storage for high-definition background videos, topic card illustrations, and campus imagery used across Acadion workspaces.**

---

## 📁 Directory Structure

```
media-assets/
├── videos/
│   ├── backgrounds/        # High-definition MP4 background loops (Home, Landing, Auth)
│   └── unreferenced/       # Archived visual sequences and backup media
├── images/
│   └── topics/             # Subject and module diagnostic visual assets
├── other/                  # Vector icons and auxiliary graphical assets
├── ASSET_MANIFEST.md       # Detailed provenance, file sizes, and component reference audit
└── README.md               # Directory overview and asset resolution documentation
```

---

## 🔗 Asset Resolution Strategy

To maintain a fast and lightweight core source tree for CI/CD builds, large binary media assets are stored in this dedicated directory and mapped into the React/Vite development server and build pipeline via `@media` aliases configured in `educate/frontend/vite.config.js`.

For full details regarding file sizes, checksums, and component references, see [ASSET_MANIFEST.md](ASSET_MANIFEST.md).
