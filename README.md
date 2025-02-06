# Task Management System

A simple task management system using **Node.js, Express, and EJS**, where users can **create, view, and read text-based tasks stored as files**. 📝🚀

## Features
- Create and store tasks as text files 📄
- View a list of all saved tasks 📋
- Read task details by opening individual files 🔍
- Simple and responsive UI using Tailwind CSS 🎨

## Technologies Used
- **Node.js** - Backend runtime
- **Express.js** - Web framework for handling routes
- **EJS** - Templating engine for dynamic content
- **File System (fs module)** - Read and write tasks to files
- **Tailwind CSS** - For styling the UI

## Installation & Setup
### 1️⃣ Clone the Repository
```sh
git clone https://github.com/yourusername/task-manager.git
cd task-manager
```

### 2️⃣ Install Dependencies
```sh
npm install
```

### 3️⃣ Run the Server
```sh
node server.js
```

### 4️⃣ Open in Browser
Go to: `http://localhost:3000`

## Project Structure
```
📂 task-manager
├── 📂 files             # Stores task files
├── 📂 public            # Static assets (CSS, images)
├── 📂 views             # EJS templates
│   ├── index.ejs        # Homepage (list tasks)
│   ├── showfiles.ejs    # View task details
├── server.js           # Main server file
├── package.json        # Project dependencies
└── README.md           # Documentation
```

## API Routes
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Show all tasks |
| POST | `/create` | Create a new task |
| GET | `/file/:filename` | Read a specific task |

## License
This project is open-source and available under the **MIT License**. ✨

