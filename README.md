# 🗂️ Task Manager

A full-stack task management web app that allows users to create, edit, delete, reorder, and view tasks in list or calendar formats, with email reminders for due dates. Built with Node.js, Express, MongoDB, and styled using Tailwind CSS.

---

## 🚀 Features

- 📝 Create tasks with title, email, due date, and details  
- ✏️ Edit or delete tasks with confirmation modals  
- 🔁 Reorder tasks via drag-and-drop interface  
- 🗓️ View tasks in list or calendar format  
- 📧 Email reminders for due dates  
- 📱 Responsive UI for all devices  

---

## 🧰 Tech Stack

**Backend**
- Node.js & Express.js
- MongoDB
- Nodemailer (email reminders)
- node-schedule (task scheduling)

**Frontend**
- EJS (HTML templating)
- Tailwind CSS (responsive styling)
- FullCalendar.js (calendar view)
- JavaScript (modals, drag-drop, validation)

---

## ⚙️ Getting Started

### ✅ Prerequisites

- Node.js (v16+)
- MongoDB (local or cloud like Atlas)
- npm (comes with Node.js)
- Git
- Gmail account (for email reminders)

---

### 📥 Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/dhrubang/task-manager.git
cd task-manager
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Configure Environment
Create a `.env` file:
```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-char-app-password
```

> 🔐 Use an App Password from Google (enable 2FA first). Never commit `.env` to GitHub.

#### 4. Start MongoDB

- If using local MongoDB, run:
```bash
mongod
```
- If using MongoDB Atlas, replace the connection URI in your code accordingly.

#### 5. Run the Application
```bash
node index.js
```

#### 6. Access in Browser

Visit: [http://localhost:3000](http://localhost:3000)

---

## 📖 Usage Guide

### ➕ Create Task
- Click **"Create Task"**
- Fill in unique title, email, due date, and details
- Submit to save and schedule reminder

### 📋 View Tasks
- **List View**: Displays cards with read/edit/delete options
- **Calendar View**: FullCalendar shows tasks with clickable tooltips

### ✏️ Edit/Delete Tasks
- Click **Edit** to update
- Click **Delete** to remove (with confirmation)

### 🔀 Reorder Tasks
- Click **"Reorder Task"**
- Drag and drop tasks to rearrange
- Click **"Save Order"**

### 📧 Email Reminders
- App sends automatic email reminders at task due time using Gmail SMTP

---

## 🗂️ Project Structure

```
task-manager/
├── index.js             # Main server file
├── views/               # EJS templates
├── public/              # Static assets (CSS/JS)
├── .env                 # Email credentials (not committed)
├── files/               # Legacy task storage (if used)
├── taskOrder.json       # Task order file (optional fallback)
├── package.json         # Project metadata and dependencies
```

---

## 📌 Enhancements to Try

- 🔐 Add user authentication (JWT or session)
- 🔍 Implement search, filters, and tags
- 📊 Build dashboard with task stats/analytics
- 🌐 Deploy on Render, Railway, or Vercel
- 🖼️ Add screenshots or GIF demo to README

---

## 👤 Author

**Dhrubang Talukdar**  
GitHub: [@dhrubang](https://github.com/dhrubang)

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
