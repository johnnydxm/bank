#!/bin/bash
# Fix ENOBUFS Error - Network Buffer Management

echo "🔧 Fixing ENOBUFS Error - Network Buffer Management"
echo "========================================================"

# 1. Increase file descriptor limits
echo "📈 Increasing file descriptor limits..."
ulimit -n 65536

# 2. Set network buffer limits (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 Applying macOS network optimizations..."
    sudo sysctl -w net.inet.tcp.sendspace=131072
    sudo sysctl -w net.inet.tcp.recvspace=131072
    sudo sysctl -w kern.ipc.maxsockbuf=16777216
    sudo sysctl -w net.inet.tcp.mssdflt=1440
fi

# 3. Clean up zombie processes
echo "🧹 Cleaning up processes..."
pkill -f "node.*mcp" 2>/dev/null || true
pkill -f "npx.*task-master" 2>/dev/null || true

# 4. Clear DNS cache (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🔄 Clearing DNS cache..."
    sudo dscacheutil -flushcache
    sudo killall -HUP mDNSResponder
fi

# 5. Reset network state
echo "🌐 Resetting network state..."
sudo ifconfig lo0 down
sudo ifconfig lo0 up

# 6. Set Node.js environment variables for better memory management
echo "⚙️ Setting Node.js optimization flags..."
export NODE_OPTIONS="--max-old-space-size=8192 --max-semi-space-size=512"
export UV_THREADPOOL_SIZE=16

echo "✅ ENOBUFS fixes applied successfully!"
echo "📋 Recommended next steps:"
echo "   1. Restart your terminal session"
echo "   2. Run: source ~/.zshrc (or ~/.bashrc)"
echo "   3. Retry your command with smaller batch sizes"

echo "🔍 Current limits:"
echo "   File descriptors: $(ulimit -n)"
echo "   Active connections: $(netstat -an | grep ESTABLISHED | wc -l | tr -d ' ')"
