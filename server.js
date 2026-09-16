const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Data directory
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// Helper functions
function readJSON(filename) {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, '[]');
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeJSON(filename, data) {
  const filepath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

// ============ BOXES API ============
app.get('/api/boxes', (req, res) => {
  const boxes = readJSON('boxes.json');
  res.json(boxes);
});

app.post('/api/boxes', (req, res) => {
  const boxes = readJSON('boxes.json');
  const { number, models, stock, brand } = req.body;
  
  const existing = boxes.findIndex(b => b.number === number);
  
  if (existing >= 0) {
    boxes[existing] = { ...boxes[existing], models, stock, brand };
    writeJSON('boxes.json', boxes);
    res.json({ success: true, message: 'جعبه ویرایش شد' });
  } else {
    boxes.push({ number, models, stock, brand, totalSold: 0 });
    writeJSON('boxes.json', boxes);
    res.json({ success: true, message: 'جعبه جدید اضافه شد' });
  }
});

app.delete('/api/boxes/:number', (req, res) => {
  const number = parseInt(req.params.number);
  let boxes = readJSON('boxes.json');
  boxes = boxes.filter(b => b.number !== number);
  writeJSON('boxes.json', boxes);
  res.json({ success: true, message: 'جعبه حذف شد' });
});

// ============ SALES API ============
app.get('/api/sales', (req, res) => {
  const sales = readJSON('sales.json');
  res.json(sales);
});

app.post('/api/sales', (req, res) => {
  const sales = readJSON('sales.json');
  const boxes = readJSON('boxes.json');
  const { boxNumber, model, quantity } = req.body;
  
  const box = boxes.find(b => b.number === boxNumber);
  if (!box) {
    return res.status(400).json({ success: false, message: 'جعبه یافت نشد' });
  }
  
  if (box.stock < quantity) {
    return res.status(400).json({ success: false, message: 'موجودی کافی نیست' });
  }
  
  box.stock -= quantity;
  box.totalSold = (box.totalSold || 0) + quantity;
  
  const sale = {
    id: Date.now(),
    boxNumber,
    model,
    quantity,
    date: new Date().toISOString()
  };
  
  sales.push(sale);
  writeJSON('sales.json', sales);
  writeJSON('boxes.json', boxes);
  
  res.json({ success: true, message: 'فروش ثبت شد', sale });
});

// ============ RECHARGES API ============
app.get('/api/recharges', (req, res) => {
  const recharges = readJSON('recharges.json');
  res.json(recharges);
});

app.post('/api/recharges', (req, res) => {
  const recharges = readJSON('recharges.json');
  const boxes = readJSON('boxes.json');
  const { boxNumber, quantity } = req.body;
  
  const box = boxes.find(b => b.number === boxNumber);
  if (!box) {
    return res.status(400).json({ success: false, message: 'جعبه یافت نشد' });
  }
  
  box.stock += quantity;
  
  const recharge = {
    id: Date.now(),
    boxNumber,
    quantity,
    date: new Date().toISOString()
  };
  
  recharges.push(recharge);
  writeJSON('recharges.json', recharges);
  writeJSON('boxes.json', boxes);
  
  res.json({ success: true, message: 'شارژ ثبت شد', recharge });
});

// ============ LOGS API ============
app.get('/api/logs', (req, res) => {
  const logs = readJSON('logs.json');
  res.json(logs);
});

app.post('/api/logs', (req, res) => {
  const logs = readJSON('logs.json');
  const { type, info } = req.body;
  
  const log = {
    id: Date.now(),
    type,
    info,
    date: new Date().toISOString()
  };
  
  logs.unshift(log);
  if (logs.length > 500) logs.splice(500);
  
  writeJSON('logs.json', logs);
  res.json({ success: true, message: 'لاگ ثبت شد' });
});

app.delete('/api/logs', (req, res) => {
  writeJSON('logs.json', []);
  res.json({ success: true, message: 'لاگ پاک شد' });
});

// ============ STATS API ============
app.get('/api/stats', (req, res) => {
  const sales = readJSON('sales.json');
  const boxes = readJSON('boxes.json');
  
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  
  const isSameDay = (d1, d2) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };
  
  const isSameWeek = (d) => {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return d >= start;
  };
  
  const isSameMonth = (d) => {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };
  
  const todaySales = sales.filter(s => isSameDay(new Date(s.date), now)).reduce((a, s) => a + s.quantity, 0);
  const yesterdaySales = sales.filter(s => isSameDay(new Date(s.date), yesterday)).reduce((a, s) => a + s.quantity, 0);
  const weekSales = sales.filter(s => isSameWeek(new Date(s.date))).reduce((a, s) => a + s.quantity, 0);
  const monthSales = sales.filter(s => isSameMonth(new Date(s.date))).reduce((a, s) => a + s.quantity, 0);
  const totalSales = sales.reduce((a, s) => a + s.quantity, 0);
  const totalStock = boxes.reduce((a, b) => a + b.stock, 0);
  
  res.json({
    today: todaySales,
    yesterday: yesterdaySales,
    week: weekSales,
    month: monthSales,
    total: totalSales,
    stock: totalStock
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║   📱 سیستم گلس آلما                       ║
  ║   🌐 سرور در حال اجراست                   ║
  ║   🔗 آدرس: http://localhost:${PORT}          ║
  ╚═══════════════════════════════════════════╝
  `);
});