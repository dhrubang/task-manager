require('dotenv').config(); // Load environment variables from .env
const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs').promises;
const nodemailer = require('nodemailer');
const schedule = require('node-schedule');
const moment = require('moment');

// Prevent server crashes from uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
});

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Email transporter configuration for Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Must match Gmail address in .env
    pass: process.env.EMAIL_PASS  // Must be 16-character App Password
  }
});

// Normalize filename: allow only alphanumeric characters and spaces
function normalizeFilename(title) {
  if (!title || typeof title !== 'string') {
    console.warn("Invalid title, using fallback:", title);
    return 'task_' + Date.now();
  }
  const cleaned = title.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  return cleaned || 'task_' + Date.now();
}

// Schedule email reminder
async function scheduleReminder(filename, title, details, email, dueDate) {
  try {
    console.log('Starting scheduleReminder:', { filename, title, dueDate });
    const date = moment(dueDate, 'YYYY-MM-DDTHH:mm').toDate();
    if (!moment(date).isValid()) {
      console.error('Invalid due date for scheduling:', dueDate);
      return;
    }
    schedule.scheduleJob(filename, date, async () => {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Task Reminder: ${title}`,
        text: `Reminder for task: ${title}\nDetails: ${details}\nDue: ${moment(dueDate).format('MMMM Do YYYY, h:mm a')}`
      };
      try {
        await transporter.sendMail(mailOptions);
        console.log('Email reminder sent for:', { filename, title, email, dueDate });
      } catch (err) {
        console.error('Error sending email for:', filename, err);
      }
    });
    console.log('Scheduled reminder successfully:', { filename, title, dueDate });
  } catch (err) {
    console.error('Error scheduling reminder:', err);
  }
}

// Load existing tasks and schedule reminders on server start
async function loadReminders() {
  try {
    const files = await fs.readdir('./files').catch(() => []);
    for (const file of files) {
      const content = await fs.readFile(`./files/${file}`, 'utf-8').catch(err => {
        console.error('Error reading file:', file, err);
        return '';
      });
      if (!content) continue;
      const [email, dueDate, ...detailsLines] = content.split('\n');
      const details = detailsLines.join('\n');
      if (email && dueDate && moment(dueDate, 'YYYY-MM-DDTHH:mm').isValid() && moment(dueDate).isAfter(moment())) {
        await scheduleReminder(file, decodeURIComponent(file), details, email, dueDate);
      }
    }
    console.log('Loaded existing reminders');
  } catch (err) {
    console.error('Error loading reminders:', err);
  }
}

// Initialize reminders on server start
loadReminders();

app.get('/', async (req, res) => {
  let files = [];
  let orderedFiles = [];
  let calendarEvents = [];
  try {
    files = await fs.readdir('./files').catch(() => []);
    orderedFiles = files;
    try {
      if (await fs.access('./taskOrder.json').then(() => true).catch(() => false)) {
        const orderData = JSON.parse(await fs.readFile('./taskOrder.json', 'utf-8').catch(() => '[]'));
        orderedFiles = orderData.filter(file => files.includes(file)).concat(files.filter(file => !orderData.includes(file)));
      }
      // Prepare calendar events
      for (const file of orderedFiles) {
        const content = await fs.readFile(`./files/${file}`, 'utf-8').catch(() => '');
        if (!content) continue;
        const [email, dueDate, ...detailsLines] = content.split('\n');
        if (dueDate && moment(dueDate, 'YYYY-MM-DDTHH:mm').isValid()) {
          calendarEvents.push({
            title: decodeURIComponent(file),
            start: dueDate,
            url: `/file/${encodeURIComponent(file)}`
          });
        }
      }
    } catch (error) {
      console.error("Error reading taskOrder.json or files:", error);
    }
    res.render("index", {
      files: orderedFiles.map(file => ({ encoded: encodeURIComponent(file), decoded: file })),
      calendarEvents: JSON.stringify(calendarEvents) // Simplified serialization
    });
    console.log("Loaded files:", orderedFiles, "Calendar events:", calendarEvents);
  } catch (err) {
    console.error("Error in / route:", err);
    res.render("index", {
      files: [],
      calendarEvents: JSON.stringify([]) // Fallback to empty array
    });
  }
});

app.post('/check-title', async (req, res) => {
  const { title, exclude } = req.body;
  if (!title || typeof title !== 'string') {
    return res.status(400).json({ exists: false, error: 'Invalid title' });
  }
  try {
    const files = await fs.readdir('./files').catch(() => []);
    const normalizedTitle = normalizeFilename(title);
    const exists = files.some(file => file.toLowerCase() === normalizedTitle.toLowerCase() && (!exclude || file.toLowerCase() !== exclude.toLowerCase()));
    console.log('Checking title:', { title, normalizedTitle, exclude, exists });
    res.json({ exists });
  } catch (err) {
    console.error("Error reading files for title check:", err);
    res.status(500).json({ exists: false, error: 'Server error' });
  }
});

app.post('/create', async (req, res) => {
  const { title, details, email, dueDate } = req.body;
  const filename = normalizeFilename(title);
  console.log("Starting /create:", { title, normalized: filename, details, email, dueDate });
  
  if (!filename) {
    console.error("Invalid filename after normalization:", title);
    return res.status(400).json({ error: 'Invalid title' });
  }
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    console.error("Invalid email:", email);
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (!dueDate || !moment(dueDate, 'YYYY-MM-DDTHH:mm').isValid()) {
    console.error("Invalid due date:", dueDate);
    return res.status(400).json({ error: 'Invalid due date' });
  }

  try {
    // Step 1: Ensure ./files directory exists
    console.log('Step 1: Creating/checking ./files directory');
    await fs.mkdir('./files', { recursive: true, mode: 0o755 }).catch(err => {
      console.error("Error creating ./files directory:", err);
      throw new Error(`Failed to create directory: ${err.message}`);
    });

    // Step 2: Check for existing files
    console.log('Step 2: Checking for existing files');
    const files = await fs.readdir('./files').catch(err => {
      console.error("Error reading ./files directory:", err);
      return [];
    });
    if (files.some(file => file.toLowerCase() === filename.toLowerCase())) {
      console.error("File already exists:", filename);
      return res.status(400).json({ error: 'Task title already exists' });
    }

    // Step 3: Write task file
    console.log('Step 3: Writing task file:', `./files/${filename}`);
    await fs.writeFile(`./files/${filename}`, `${email}\n${dueDate}\n${details || ''}`, { mode: 0o644 }).catch(err => {
      console.error("Error writing task file:", filename, err);
      throw new Error(`Failed to write task file: ${err.message}`);
    });

    // Step 4: Update task order
    console.log('Step 4: Updating task order');
    let orderData = [];
    try {
      if (await fs.access('./taskOrder.json').then(() => true).catch(() => false)) {
        const rawData = await fs.readFile('./taskOrder.json', 'utf-8').catch(err => {
          console.error("Error reading taskOrder.json:", err);
          return '[]';
        });
        try {
          orderData = JSON.parse(rawData);
          if (!Array.isArray(orderData)) {
            console.warn("taskOrder.json is not an array, resetting to []");
            orderData = [];
          }
        } catch (err) {
          console.error("Error parsing taskOrder.json:", err);
          orderData = [];
        }
      } else {
        console.log('taskOrder.json does not exist, initializing');
        await fs.writeFile('./taskOrder.json', '[]', { mode: 0o644 }).catch(err => {
          console.error("Error initializing taskOrder.json:", err);
          throw new Error(`Failed to initialize taskOrder.json: ${err.message}`);
        });
      }
    } catch (error) {
      console.error("Error accessing taskOrder.json:", error);
      orderData = [];
    }

    orderData.unshift(filename);
    console.log('Writing taskOrder.json:', orderData);
    await fs.writeFile('./taskOrder.json', JSON.stringify(orderData), { mode: 0o644 }).catch(err => {
      console.error("Error writing taskOrder.json:", err);
      throw new Error(`Failed to write taskOrder.json: ${err.message}`);
    });
    console.log("Updated taskOrder.json with new file:", filename);

    // Step 5: Schedule email reminder
    console.log('Step 5: Scheduling reminder for:', filename);
    try {
      await scheduleReminder(filename, title, details, email, dueDate);
      console.log("Reminder scheduled successfully");
    } catch (err) {
      console.error("Error in scheduleReminder, continuing:", err);
    }

    console.log("Task created successfully:", filename, "with email:", email, "due:", dueDate);
    res.redirect("/");
  } catch (err) {
    console.error("Error in /create:", filename, err);
    res.status(500).json({ error: `Failed to create task: ${err.message}` });
  }
});

app.get('/file/:filename', async (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  try {
    if (!await fs.access(`./files/${filename}`).then(() => true).catch(() => false)) {
      console.error("File does not exist for read:", filename);
      return res.redirect("/");
    }
    const filedata = await fs.readFile(`./files/${filename}`, "utf-8");
    const [email, dueDate, ...detailsLines] = filedata.split('\n');
    const details = detailsLines.join('\n');
    res.render("showfiles", { filename, filedata: details, email, dueDate });
  } catch (err) {
    console.error("Error reading file:", filename, err);
    res.redirect("/");
  }
});

app.get('/edit/:filename', async (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  try {
    if (!await fs.access(`./files/${filename}`).then(() => true).catch(() => false)) {
      console.error("File does not exist for edit:", filename);
      return res.redirect("/");
    }
    const filedata = await fs.readFile(`./files/${filename}`, "utf-8");
    const [email, dueDate, ...detailsLines] = filedata.split('\n');
    const details = detailsLines.join('\n');
    res.render("edit", { filename, displayName: filename, filedata: details, email, dueDate });
  } catch (err) {
    console.error("Error reading file for edit:", filename, err);
    res.redirect("/");
  }
});

app.post("/edit", async (req, res) => {
  const { previous, new: newName, details, email, dueDate } = req.body;
  if (!previous) {
    console.error("Invalid previous filename: empty");
    return res.status(400).json({ error: 'Invalid previous filename' });
  }
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    console.error("Invalid email:", email);
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (!dueDate || !moment(dueDate, 'YYYY-MM-DDTHH:mm').isValid()) {
    console.error("Invalid due date:", dueDate);
    return res.status(400).json({ error: 'Invalid due date' });
  }
  try {
    const decodedPrevious = decodeURIComponent(previous);
    if (!await fs.access(`./files/${decodedPrevious}`).then(() => true).catch(() => false)) {
      console.error("File does not exist for edit:", decodedPrevious);
      return res.status(404).json({ error: `Task file ${decodedPrevious} not found` });
    }
    // Check for duplicate title if changed
    if (newName && newName !== decodedPrevious) {
      const newFilename = normalizeFilename(newName);
      if (!newFilename) {
        console.error("Invalid new filename: empty or invalid", newName);
        return res.status(400).json({ error: 'Invalid new title' });
      }
      const files = await fs.readdir('./files').catch(() => []);
      if (files.some(file => file.toLowerCase() === newFilename.toLowerCase() && file !== decodedPrevious)) {
        console.error("Cannot rename: target file already exists:", newFilename);
        return res.status(400).json({ error: 'Task title already exists' });
      }
      // Cancel existing schedule for old filename
      schedule.cancelJob(decodedPrevious);
      // Rename file
      await fs.rename(`./files/${decodedPrevious}`, `./files/${newFilename}`);
      // Update task order
      try {
        if (await fs.access('./taskOrder.json').then(() => true).catch(() => false)) {
          const orderData = JSON.parse(await fs.readFile('./taskOrder.json', 'utf-8').catch(() => '[]'));
          const updatedOrder = orderData.map(file => file === decodedPrevious ? newFilename : file);
          await fs.writeFile('./taskOrder.json', JSON.stringify(updatedOrder));
          console.log("Updated taskOrder.json with new filename:", newFilename);
        }
      } catch (error) {
        console.error("Error updating taskOrder.json:", error);
      }
      console.log("Renamed file:", decodedPrevious, "to", newFilename);
      // Update content for new file
      await fs.writeFile(`./files/${newFilename}`, `${email}\n${dueDate}\n${details || ''}`);
      // Schedule new reminder
      await scheduleReminder(newFilename, newName, details, email, dueDate);
      console.log("Updated file content:", newFilename, "with email:", email, "due:", dueDate);
    } else {
      // Update content for existing file
      await fs.writeFile(`./files/${decodedPrevious}`, `${email}\n${dueDate}\n${details || ''}`);
      // Cancel and reschedule reminder
      schedule.cancelJob(decodedPrevious);
      await scheduleReminder(decodedPrevious, newName, details, email, dueDate);
      console.log("Updated file content:", decodedPrevious, "with email:", email, "due:", dueDate);
    }
    res.redirect("/");
  } catch (err) {
    console.error("Error during edit:", err);
    res.status(500).json({ error: `Failed to edit task: ${err.message}` });
  }
});

app.post('/reorder', async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) {
    console.error("Invalid reorder data:", order);
    return res.status(400).json({ error: 'Invalid reorder data' });
  }
  try {
    await fs.writeFile('./taskOrder.json', JSON.stringify(order));
    console.log("Saved task order:", order);
    res.json({ message: 'Task order saved' });
  } catch (err) {
    console.error("Error saving task order:", err);
    res.status(500).json({ error: 'Failed to save task order' });
  }
});

app.delete('/delete/:filename', async (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  console.log('Delete request received for:', filename);
  try {
    if (!await fs.access(`./files/${filename}`).then(() => true).catch(() => false)) {
      console.error('File does not exist:', filename);
      return res.status(404).json({ error: `Task file ${filename} not found` });
    }
    await fs.unlink(`./files/${filename}`);
    // Cancel scheduled reminder
    schedule.cancelJob(filename);
    try {
      if (await fs.access('./taskOrder.json').then(() => true).catch(() => false)) {
        const orderData = JSON.parse(await fs.readFile('./taskOrder.json', 'utf-8').catch(() => '[]'));
        const updatedOrder = orderData.filter(file => file !== filename);
        await fs.writeFile('./taskOrder.json', JSON.stringify(updatedOrder));
        console.log("Removed from taskOrder.json:", filename);
      }
      console.log('Task deleted successfully:', filename);
      res.json({ message: 'Task deleted successfully' });
    } catch (error) {
      console.error("Error updating taskOrder.json:", error);
      res.status(500).json({ error: `Failed to update task order: ${error.message}` });
    }
  } catch (err) {
    console.error("Error deleting file:", filename, err);
    res.status(500).json({ error: `Failed to delete task: ${err.message}` });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});