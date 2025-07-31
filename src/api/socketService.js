import { io } from "socket.io-client";

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.messageHandlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 1000;
  }

  // 初始化连接
  init(url = "http://localhost:3000", options = {}) {
    const defaultOptions = {
      transports: ["websocket", "polling"],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectInterval,
      reconnectionDelayMax: 5000,
      forceNew: true,
      binary: true, // 支持二进制数据
      ...options,
    };

    this.socket = io(url, defaultOptions);
    this.setupEventHandlers();

    return this.socket;
  }

  // 设置事件处理器
  setupEventHandlers() {
    if (!this.socket) return;

    // 连接成功
    this.socket.on("connect", () => {
      console.log("Socket连接成功:", this.socket.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit("connection_status", {
        status: "connected",
        socketId: this.socket.id,
      });
    });

    // 连接断开
    this.socket.on("disconnect", (reason) => {
      console.log("Socket连接断开:", reason);
      this.isConnected = false;
      this.emit("connection_status", { status: "disconnected", reason });
    });

    // 连接错误
    this.socket.on("connect_error", (error) => {
      console.error("Socket连接错误:", error);
      this.isConnected = false;
      this.emit("connection_status", { status: "error", error: error.message });
    });

    // 重连成功
    this.socket.on("reconnect", (attemptNumber) => {
      console.log(`Socket重连成功，尝试次数: ${attemptNumber}`);
      this.reconnectAttempts = 0;
      this.emit("connection_status", {
        status: "reconnected",
        attempts: attemptNumber,
      });
    });

    // 重连失败
    this.socket.on("reconnect_failed", () => {
      console.log("Socket重连失败");
      this.emit("connection_status", { status: "reconnect_failed" });
    });
  }

  // 发送文字消息
  sendTextMessage(data) {
    if (!this.isConnected) {
      throw new Error("Socket未连接");
    }

    const messageData = {
      type: "text",
      timestamp: Date.now(),
      ...data,
    };

    console.log("发送文字消息:", messageData);
    this.socket.emit("text_message", messageData);
  }

  // 发送语音消息（二进制）
  sendAudioMessage(audioBuffer, metadata = {}) {
    if (!this.isConnected) {
      throw new Error("Socket未连接");
    }

    const messageData = {
      type: "audio",
      timestamp: Date.now(),
      metadata: {
        size: audioBuffer.byteLength,
        format: metadata.format || "webm",
        duration: metadata.duration || 0,
        ...metadata,
      },
      ...metadata.userInfo,
    };

    console.log("发送语音消息:", {
      ...messageData,
      audioSize: audioBuffer.byteLength,
    });

    // 先发送元数据
    this.socket.emit("audio_message_meta", messageData);

    // 再发送二进制音频数据
    this.socket.emit("audio_message_data", audioBuffer);
  }

  // 监听消息
  onMessage(eventName, handler) {
    if (!this.socket) return;

    this.socket.on(eventName, handler);

    // 存储处理器以便后续管理
    if (!this.messageHandlers.has(eventName)) {
      this.messageHandlers.set(eventName, []);
    }
    this.messageHandlers.get(eventName).push(handler);
  }

  // 移除消息监听
  offMessage(eventName, handler) {
    if (!this.socket) return;

    if (handler) {
      this.socket.off(eventName, handler);

      // 从存储中移除
      const handlers = this.messageHandlers.get(eventName);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    } else {
      // 移除所有监听器
      this.socket.off(eventName);
      this.messageHandlers.delete(eventName);
    }
  }

  // // 发送用户认证
  // authenticate(userInfo) {
  //   if (!this.isConnected) {
  //     throw new Error("Socket未连接");
  //   }

  //   console.log("发送用户认证:", userInfo);
  //   this.socket.emit("authenticate", {
  //     userId: userInfo.id,
  //     userInfo,
  //     timestamp: Date.now(),
  //   });
  // }

  // 发送心跳
  sendHeartbeat() {
    if (!this.isConnected) return;

    this.socket.emit("heartbeat", {
      timestamp: Date.now(),
      clientTime: new Date().toISOString(),
    });
  }

  // 启动心跳
  startHeartbeat(interval = 30000) {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, interval);
  }

  // 停止心跳
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // 获取连接状态
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      socketId: this.socket?.id,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  // 手动重连
  reconnect() {
    if (this.socket) {
      this.socket.connect();
    }
  }

  // 断开连接
  disconnect() {
    this.stopHeartbeat();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected = false;
    this.messageHandlers.clear();
  }

  // 内部事件发射器
  emit(eventName, data) {
    const handlers = this.messageHandlers.get(eventName);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in handler for ${eventName}:`, error);
        }
      });
    }
  }

  // 获取Socket实例
  getSocket() {
    return this.socket;
  }
}

// 创建单例实例
const socketService = new SocketService();

export default socketService;
