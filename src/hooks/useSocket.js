import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { message } from "antd";

// Socket配置
const SOCKET_CONFIG = {
  url: import.meta.env.VITE_SOCKET_URL,
  options: {
    transports: ["websocket", "polling"],
    timeout: 30000, // 增加超时时间到30秒
    reconnection: true,
    reconnectionAttempts: 10, // 增加重连次数
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    maxReconnectionAttempts: 10,
    forceNew: true,
    binary: true,
    // 添加心跳配置
    heartbeatTimeout: 60000, // 心跳超时
    heartbeatInterval: 25000, // 心跳间隔
    pingTimeout: 60000, // ping超时
    pingInterval: 25000, // ping间隔
  },
};

export const useSocket = () => {
  console.log(SOCKET_CONFIG);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const user = JSON.parse(localStorage.getItem("user"));

  useEffect(() => {
    // 创建Socket连接
    const createSocket = () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      setIsConnecting(true);

      const socket = io(SOCKET_CONFIG.url, {
        ...SOCKET_CONFIG.options,
        query: {
          userId: user?.id,
          timestamp: Date.now(),
        },
      });

      // 连接成功
      socket.on("connect", () => {
        console.log("Socket连接成功:", socket.id);
        setIsConnected(true);
        setIsConnecting(false);
        message.success("连接成功");
      });

      // 连接断开
      socket.on("disconnect", (reason) => {
        console.log("Socket连接断开:", reason);
        setIsConnected(false);
        setIsConnecting(false);

        if (reason === "io server disconnect") {
          // 服务器主动断开，需要手动重连
          message.error("服务器断开连接");
        } else {
          message.warning("连接已断开，正在重连...");
        }
      });

      // 连接错误
      socket.on("connect_error", (error) => {
        console.error("Socket连接错误:", error);
        setIsConnected(false);
        setIsConnecting(false);
        message.error(`连接失败: ${error.message}`);

        // 自动重连逻辑
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("尝试重新连接...");
            createSocket();
            reconnectTimeoutRef.current = null;
          }, 3000);
        }
      });

      // 重连成功
      socket.on("reconnect", (attemptNumber) => {
        console.log(`重连成功，尝试次数: ${attemptNumber}`);
        message.success("重连成功");
      });

      // 重连失败
      socket.on("reconnect_failed", () => {
        console.log("重连失败");
        message.error("重连失败，请刷新页面");
        setIsConnected(false);
        setIsConnecting(false);
      });

      // 服务器消息
      socket.on("server_message", (data) => {
        console.log("服务器消息:", data);
        if (data.type === "info") {
          message.info(data.message);
        } else if (data.type === "warning") {
          message.warning(data.message);
        } else if (data.type === "error") {
          message.error(data.message);
        }
      });

      socketRef.current = socket;
    };

    // 初始化连接
    createSocket();

    // 监听页面可见性变化
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        !isConnected &&
        !isConnecting
      ) {
        console.log("页面重新可见，尝试重连");
        createSocket();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 监听网络状态变化
    const handleOnline = () => {
      console.log("网络已连接，尝试重连");
      if (!isConnected && !isConnecting) {
        createSocket();
      }
    };

    const handleOffline = () => {
      console.log("网络已断开");
      message.warning("网络连接已断开");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // 清理函数
    return () => {
      console.log("清理Socket连接");

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);

      setIsConnected(false);
      setIsConnecting(false);
    };
  }, [user?.id]);

  // 手动重连
  const reconnect = () => {
    if (socketRef.current) {
      socketRef.current.connect();
    }
  };

  // 手动断开
  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    isConnecting,
    reconnect,
    disconnect,
  };
};
