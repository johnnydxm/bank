# 🔧 ENOBUFS Error Troubleshooting Guide

## What is ENOBUFS?
ENOBUFS (No buffer space available) occurs when the system runs out of network buffer space, typically due to:
- Too many concurrent network connections
- Memory buffer overflow
- System resource exhaustion
- Network stack congestion

## ⚡ Quick Fix (Run First)

```bash
# 1. Run the automated fix script
./fix-enobufs.sh

# 2. Restart your terminal session
# 3. Try the safe build command
npm run build:safe
```

## 🔍 Step-by-Step Resolution

### 1. Immediate Actions

```bash
# Check current limits
ulimit -n  # Should show 65536 after running fix script

# Check active connections
netstat -an | grep ESTABLISHED | wc -l

# Kill problematic processes
pkill -f "node.*mcp"
pkill -f "npx.*task-master"
```

### 2. System Configuration (macOS)

```bash
# Increase network buffers
sudo sysctl -w net.inet.tcp.sendspace=131072
sudo sysctl -w net.inet.tcp.recvspace=131072
sudo sysctl -w kern.ipc.maxsockbuf=16777216

# Reset network interface
sudo ifconfig lo0 down && sudo ifconfig lo0 up
```

### 3. Node.js Configuration

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
# Node.js memory and network optimization
export NODE_OPTIONS="--max-old-space-size=8192 --max-semi-space-size=512"
export UV_THREADPOOL_SIZE=16
export UV_USE_IO_URING=0
```

### 4. Application-Level Fixes

```bash
# Use safe build commands
npm run build:safe      # Limited memory usage
npm run dev:safe        # Safe development mode

# Or run with explicit limits
cross-env NODE_OPTIONS='--max-old-space-size=4096' npm run build
```

## 🛠️ Advanced Troubleshooting

### Check System Resources

```bash
# Memory usage
top -l 1 | grep "PhysMem"

# Network connections by process
lsof -i | head -20

# File descriptor usage
lsof | wc -l
```

### Monitor Network Activity

```bash
# Real-time network monitoring
netstat -w 2

# Check for connection leaks
watch "netstat -an | grep ESTABLISHED | wc -l"
```

### Clear System Caches

```bash
# DNS cache
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# System caches
sudo purge
```

## 🎯 Prevention Strategies

### 1. Use Connection Pooling
```javascript
// In your Node.js code
const https = require('https');
const agent = new https.Agent({
  maxSockets: 50,
  timeout: 30000,
  keepAlive: true
});
```

### 2. Implement Rate Limiting
```javascript
// Rate limit API calls
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Batch processing with delays
for (let i = 0; i < items.length; i += 10) {
  const batch = items.slice(i, i + 10);
  await processBatch(batch);
  await delay(100); // 100ms delay between batches
}
```

### 3. Monitor Resource Usage
```javascript
// Memory monitoring
setInterval(() => {
  const used = process.memoryUsage();
  console.log('Memory usage:', {
    rss: Math.round(used.rss / 1024 / 1024) + 'MB',
    heapUsed: Math.round(used.heapUsed / 1024 / 1024) + 'MB'
  });
}, 10000);
```

## 🚨 Emergency Recovery

If the error persists:

```bash
# 1. Restart network services (macOS)
sudo launchctl kickstart -k system/com.apple.networking.discovery

# 2. Reboot if necessary
sudo reboot

# 3. Use minimal build options
NODE_OPTIONS="--max-old-space-size=2048" npm run build
```

## 📊 Success Indicators

✅ **Fixed when you see:**
- `ulimit -n` returns 65536 or higher
- Build completes without ENOBUFS error
- Network connections < 100 during build
- No zombie Node.js processes

❌ **Still broken if:**
- ENOBUFS error continues
- Build times out or crashes
- Network connections > 500
- System becomes unresponsive

## 🔄 Maintenance

Run weekly:
```bash
# Clean up system
./fix-enobufs.sh

# Update system limits permanently
echo "ulimit -n 65536" >> ~/.zshrc
echo "export NODE_OPTIONS='--max-old-space-size=8192'" >> ~/.zshrc
```

---

**Need help?** Create an issue with:
1. Output of `ulimit -n`
2. Output of `netstat -an | grep ESTABLISHED | wc -l`
3. Full error message
4. System specs (macOS version, Node.js version)
