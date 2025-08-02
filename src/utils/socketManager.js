// socketManager.js
class SocketManager {
  constructor() {
    this.sockets = {
      text: null,
      tts: null,
      stt: null,
    };

    this.status = {
      text: "disconnected",
      tts: "disconnected",
      stt: "disconnected",
    };

    this.callbacks = {
      text: {},
      tts: {},
      stt: {},
    };

    this.reconnectTimers = {};
    this.maxReconnectAttempts = 5;
    this.reconnectAttempts = {
      text: 0,
      tts: 0,
      stt: 0,
    };
  }

  // 初始化所有连接
  initAllSockets() {
    this.initTextSocket();
    this.initTTSSocket();
    this.initSTTSocket();
  }

  // 获取WebSocket URL
  getWebSocketUrl(path = "") {
    const baseUrl = import.meta.env.VITE_SOCKET_URL || "ws://localhost:3000";
    return `${baseUrl}${path}`;
  }

  // 文本对话Socket
  initTextSocket() {
    if (this.sockets.text) {
      this.sockets.text.close();
    }

    try {
      this.status.text = "connecting";
      this.sockets.text = new WebSocket(this.getWebSocketUrl());
      this.sockets.text.onopen = () => {
        console.log("文本Socket已连接");
        this.status.text = "connected";
        this.reconnectAttempts.text = 0;
        this.handleTextSocketOpen();
      };

      this.sockets.text.onmessage = (event) => {
        this.handleTextMessage(event);
      };

      this.sockets.text.onclose = () => {
        console.log("文本Socket已断开");
        this.status.text = "disconnected";
        this.handleReconnect("text");
      };

      this.sockets.text.onerror = (error) => {
        console.error("文本Socket错误:", error);
        this.status.text = "error";
      };
    } catch (error) {
      console.error("初始化文本Socket失败:", error);
      this.handleReconnect("text");
    }
  }

  // 文本转语音Socket
  initTTSSocket() {
    if (this.sockets.tts) {
      this.sockets.tts.close();
    }

    try {
      this.status.tts = "connecting";
      this.sockets.tts = new WebSocket(this.getWebSocketUrl("/tts"));
      this.sockets.tts.binaryType = "arraybuffer";

      this.sockets.tts.onopen = () => {
        console.log("TTS Socket已连接");
        this.status.tts = "connected";
        this.reconnectAttempts.tts = 0;
        if (this.callbacks.tts.onOpen) {
          this.callbacks.tts.onOpen();
        }
      };

      this.sockets.tts.onmessage = (event) => {
        if (this.callbacks.tts.onMessage) {
          this.callbacks.tts.onMessage(event.data);
        }
      };

      this.sockets.tts.onclose = () => {
        console.log("TTS Socket已断开");
        this.status.tts = "disconnected";
        this.handleReconnect("tts");
      };

      this.sockets.tts.onerror = (error) => {
        console.error("TTS Socket错误:", error);
        this.status.tts = "error";
      };
    } catch (error) {
      console.error("初始化TTS Socket失败:", error);
      this.handleReconnect("tts");
    }
  }

  // 语音转文本Socket
  initSTTSocket() {
    if (this.sockets.stt) {
      this.sockets.stt.close();
    }

    try {
      this.status.stt = "connecting";
      this.sockets.stt = new WebSocket(this.getWebSocketUrl("/stt"));

      this.sockets.stt.onopen = () => {
        console.log("STT Socket已连接");
        this.status.stt = "connected";
        this.reconnectAttempts.stt = 0;
        if (this.callbacks.stt.onOpen) {
          this.callbacks.stt.onOpen();
        }
      };

      this.sockets.stt.onmessage = (event) => {
        if (this.callbacks.stt.onMessage) {
          this.callbacks.stt.onMessage(event.data);
        }
      };

      this.sockets.stt.onclose = () => {
        console.log("STT Socket已断开");
        this.status.stt = "disconnected";
        this.handleReconnect("stt");
      };

      this.sockets.stt.onerror = (error) => {
        console.error("STT Socket错误:", error);
        this.status.stt = "error";
      };
    } catch (error) {
      console.error("初始化STT Socket失败:", error);
      this.handleReconnect("stt");
    }
  }

  // 处理文本Socket连接成功
  handleTextSocketOpen() {
    // 自动执行握手
    this.handshake();
  }

  // 握手协议
  handshake(userData = {}) {
    if (this.status.text !== "connected") {
      console.warn("文本Socket未连接，无法握手");
      return;
    }

    const user = JSON.parse(localStorage.getItem("user")) || {};
    const handshakeData = {
      user_id: user.id || "user123",
      type: "handshake",
      info: {
        name: user.name || "",
        gender: user.gender || "",
        nationality: user.nationality || "",
        phone: user.phone || "",
        id_card: user.idCard || "",
        ...userData,
      },
    };

    this.sockets.text.send(JSON.stringify(handshakeData));
  }

  //

  // 处理文本消息
  handleTextMessage(event) {
    try {
      const data = JSON.parse(event.data);

      // 根据消息类型处理
      switch (data.type) {
        case "text":
          if (this.callbacks.text.onTextMessage) {
            this.callbacks.text.onTextMessage(data);
          }
          break;
        case "processing":
          if (this.callbacks.text.onProcessing) {
            this.callbacks.text.onProcessing(data);
          }
          break;
        case "summary":
          if (this.callbacks.text.onTableMessage) {
            this.callbacks.text.onTableMessage(data);
          }
          break;
        case "storage":
          if (this.callbacks.text.onStorage) {
            this.callbacks.text.onStorage(data);
          }
          break;
        case "error":
          if (this.callbacks.text.onError) {
            this.callbacks.text.onError(data);
          }
          break;
        default:
          if (this.callbacks.text.onMessage) {
            this.callbacks.text.onMessage(data);
          }
      }
    } catch (error) {
      console.error("解析文本消息失败:", error);
    }
  }

  // 发送文本消息
  sendTextMessage(text, type = "text") {
    if (this.status.text !== "connected") {
      console.warn("文本Socket未连接，无法发送消息");
      return false;
    }

    const user = JSON.parse(localStorage.getItem("user")) || {};
    const msg = {
      user_id: user.id,
      type: type,
      input: {
        type: "text",
        text: text,
      },
    };

    this.sockets.text.send(JSON.stringify(msg));
    return true;
  }

  // 文本转语音请求
  requestTTS(text) {
    return new Promise((resolve, reject) => {
      if (this.status.tts !== "connected") {
        reject(new Error("TTS Socket未连接"));
        return;
      }

      // 设置一次性监听器
      const handleMessage = (data) => {
        this.callbacks.tts.onMessage = originalCallback;
        resolve(data);
      };

      const originalCallback = this.callbacks.tts.onMessage;
      this.callbacks.tts.onMessage = handleMessage;

      try {
        this.sockets.tts.send(text);
      } catch (error) {
        this.callbacks.tts.onMessage = originalCallback;
        reject(error);
      }
    });
  }

  // 语音转文本请求
  requestSTT(audioData) {
    return new Promise((resolve, reject) => {
      if (this.status.stt !== "connected") {
        reject(new Error("STT Socket未连接"));
        return;
      }

      // 设置一次性监听器
      const handleMessage = (data) => {
        this.callbacks.stt.onMessage = originalCallback;
        resolve(data);

        // 收到文本后自动发送到文本Socket
        // this.sendTextMessage(data);
      };

      const originalCallback = this.callbacks.stt.onMessage;
      this.callbacks.stt.onMessage = handleMessage;

      try {
        this.sockets.stt.send(audioData);
      } catch (error) {
        this.callbacks.stt.onMessage = originalCallback;
        reject(error);
      }
    });
  }

  // 处理重连
  handleReconnect(socketType) {
    if (this.reconnectAttempts[socketType] < this.maxReconnectAttempts) {
      this.reconnectAttempts[socketType]++;
      console.log(
        `正在重连${socketType} Socket，尝试次数: ${this.reconnectAttempts[socketType]}`
      );

      this.reconnectTimers[socketType] = setTimeout(() => {
        switch (socketType) {
          case "text":
            this.initTextSocket();
            break;
          case "tts":
            this.initTTSSocket();
            break;
          case "stt":
            this.initSTTSocket();
            break;
        }
      }, 2000 * this.reconnectAttempts[socketType]); // 指数退避
    } else {
      console.error(`${socketType} Socket重连失败`);
    }
  }

  // 设置回调函数
  setCallbacks(socketType, callbacks) {
    if (this.callbacks[socketType]) {
      Object.assign(this.callbacks[socketType], callbacks);
    }
  }

  // 获取连接状态
  getStatus() {
    return { ...this.status };
  }

  // 关闭所有连接
  closeAllSockets() {
    Object.keys(this.sockets).forEach((key) => {
      if (this.sockets[key]) {
        this.sockets[key].close();
      }
      if (this.reconnectTimers[key]) {
        clearTimeout(this.reconnectTimers[key]);
      }
    });
  }
}

// 创建单例实例
const socketManager = new SocketManager();

export default socketManager;
