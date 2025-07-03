
const express = require('express');
const nodemailer = require('nodemailer');
const schedule = require('node-schedule');
const moment = require('moment');
const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);
let tasksCollection, taskOrderCollection;

async function connectToMongo() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db('task_manager');
    tasksCollection = db.collection('tasks');
    taskOrderCollection = db.collection('taskOrder');
    await taskOrderCollection.updateOne(
      { _id: 'order' },
      { $setOnInsert: { order: [] } },
      { upsert: true }
    );
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

connectToMongo();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function scheduleReminder({ title, email, dueDate }) {
  console.log('Starting scheduleReminder:', { title, email, dueDate });
  try {
    const job = schedule.scheduleJob(new Date(dueDate), async () => {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: `Task Reminder: ${title}`,
          text: `Reminder for task: ${title}\nDetails: ${(await tasksCollection.findOne({ title })).details}\nDue: ${moment(dueDate).format('MMMM Do YYYY, h:mm a')}`
        });
        console.log('Reminder sent for:', title);
      } catch (err) {
        console.error('Error sending reminder:', err);
      }
    });
    console.log('Scheduled reminder successfully:', { title, email, dueDate });
  } catch (err) {
    console.error('Error scheduling reminder:', err);
  }
}

app.get('/', async (req, res) => {
  try {
    const files = await tasksCollection.find({}).toArray();
    const orderDoc = await taskOrderCollection.findOne({ _id: 'order' });
    let order = orderDoc ? orderDoc.order : [];
    const taskTitles = files.map(file => file.title);
    order = order.filter(title => taskTitles.includes(title));
    taskTitles.forEach(title => {
      if (!order.includes(title)) order.push(title);
    });
    await taskOrderCollection.updateOne(
      { _id: 'order' },
      { $set: { order } }
    );
    const filesList = files.map(file => ({
      encoded: encodeURIComponent(file.title),
      decoded: file.title
    }));
    filesList.sort((a, b) => {
      const indexA = order.indexOf(a.decoded);
      const indexB = order.indexOf(b.decoded);
      return indexA - indexB;
    });
    const events = files.map(file => ({
      title: file.title,
      start: new Date(file.dueDate).toISOString(),
      url: `/file/${encodeURIComponent(file.title)}`,
      details: file.details || '' // Include details for tooltip
    }));
    const initialView = req.query.view === 'calendar' ? 'calendar' : 'list';
    console.log('Rendering tasks with order:', order, 'and events:', events);
    res.render('index', { files: filesList, calendarEvents: events, initialView });
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).send('Error fetching tasks');
  }
});

app.post('/check-title', async (req, res) => {
  try {
    const { title } = req.body;
    const exists = await tasksCollection.findOne({ title });
    res.json({ exists: !!exists });
  } catch (err) {
    console.error('Error checking title:', err);
    res.status(500).json({ error: 'Error checking title' });
  }
});

app.post('/create', async (req, res) => {
  console.log('Starting /create:', req.body);
  const { title, email, dueDate, details } = req.body;
  try {
    const exists = await tasksCollection.findOne({ title });
    if (exists) {
      return res.status(400).json({ error: 'Task title already exists' });
    }
    const formattedDueDate = new Date(dueDate).toISOString();
    await tasksCollection.insertOne({ title, email, dueDate: formattedDueDate, details });
    await taskOrderCollection.updateOne(
      { _id: 'order' },
      { $push: { order: title } }
    );
    console.log('Task created successfully:', title, 'with email:', email, 'due:', formattedDueDate);
    await scheduleReminder({ title, email, dueDate: formattedDueDate });
    res.json({ message: 'Task created successfully' });
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: 'Error creating task' });
  }
});

app.delete('/delete/:filename', async (req, res) => {
  console.log('Sending delete request for:', { url: `/delete/${req.params.filename}` });
  const filename = decodeURIComponent(req.params.filename);
  try {
    const result = await tasksCollection.deleteOne({ title: filename });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    await taskOrderCollection.updateOne(
      { _id: 'order' },
      { $pull: { order: filename } }
    );
    console.log('Task deleted successfully:', filename);
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: 'Error deleting task' });
  }
});

app.post('/reorder', async (req, res) => {
  try {
    const { order } = req.body;
    console.log('Received reorder request:', order);
    if (!Array.isArray(order) || order.some(title => typeof title !== 'string')) {
      return res.status(400).json({ error: 'Invalid order format' });
    }
    const existingTitles = (await tasksCollection.find({}).toArray()).map(task => task.title);
    const validOrder = order.filter(title => existingTitles.includes(title));
    existingTitles.forEach(title => {
      if (!validOrder.includes(title)) validOrder.push(title);
    });
    await taskOrderCollection.updateOne(
      { _id: 'order' },
      { $set: { order: validOrder } }
    );
    console.log('Updated task order:', validOrder);
    res.json({ message: 'Order updated successfully' });
  } catch (err) {
    console.error('Error saving order:', err);
    res.status(500).json({ error: 'Error saving order' });
  }
});

app.get('/file/:filename', async (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  try {
    const task = await tasksCollection.findOne({ title: filename });
    if (!task) {
      return res.status(404).send('Task not found');
    }
    res.render('showfiles', { task });
  } catch (err) {
    console.error('Error fetching task:', err);
    res.status(500).send('Error fetching task');
  }
});

app.get('/edit/:filename', async (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  try {
    const task = await tasksCollection.findOne({ title: filename });
    if (!task) {
      return res.status(404).send('Task not found');
    }
    res.render('edit', { task, request: req });
  } catch (err) {
    console.error('Error fetching task for edit:', err);
    res.status(500).send('Error fetching task');
  }
});

app.post('/edit/:filename', async (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  const { title, email, dueDate, details } = req.body;
  try {
    const currentTask = await tasksCollection.findOne({ title: filename });
    if (!currentTask) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (title !== filename) {
      const exists = await tasksCollection.findOne({ title, _id: { $ne: currentTask._id } });
      if (exists) {
        return res.status(400).json({ error: 'Task title already exists' });
      }
    }
    const formattedDueDate = new Date(dueDate).toISOString();
    const result = await tasksCollection.updateOne(
      { _id: currentTask._id },
      { $set: { title, email, dueDate: formattedDueDate, details } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (title !== filename) {
      await taskOrderCollection.updateOne(
        { _id: 'order' },
        { $set: { 'order.$[elem]': title } },
        { arrayFilters: [{ elem: filename }] }
      );
    }
    await scheduleReminder({ title, email, dueDate: formattedDueDate });
    const view = req.query.view || 'list';
    res.redirect(`/?view=${view}`);
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Error updating task' });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
