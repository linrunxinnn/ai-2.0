import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import socketService from "../../api/socketService.js";

// 异步action：初始化Socket连接
export const initializeSocket = createAsyncThunk(
  "socket/initialize",
  async ({ url, options }, { dispatch, rejectWithValue }) => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));

      if (!user?.id) {
        throw new Error("用户信息不存在");
      }

      // 初始化Socket连接
      const socket = socketService.init(url, {
        ...options,
        query: {
          userId: user.id,
          timestamp: Date.now(),
        },
      });

      // 设置连接状态监听
      socketService.onMessage("connection_status", (data) => {
        dispatch(updateConnectionStatus(data));
      });

      // 设置消息监听
      socketService.onMessage("text_message", (data) => {
        dispatch(
          addMessage({
            content: data.content,
            role: "assistant",
            type: "text",
            timestamp: new Date(),
          })
        );
      });

      socketService.onMessage("audio_message", (audioBuffer) => {
        // 处理语音消息
        const blob = new Blob([audioBuffer], { type: "audio/wav" });
        const audioUrl = URL.createObjectURL(blob);

        dispatch(
          addMessage({
            content: "[语音消息]",
            role: "assistant",
            type: "audio",
            audioUrl,
            timestamp: new Date(),
          })
        );
      });

      socketService.onMessage("summary", (data) => {
        dispatch(receiveSummary(data));
      });

      socketService.onMessage("processing", () => {
        dispatch(setProcessing(true));
      });

      socketService.onMessage("error", (error) => {
        dispatch(setError(error.message));
      });

      // 认证用户
      socketService.authenticate(user);

      // 启动心跳
      socketService.startHeartbeat();

      return {
        socketId: socket.id,
        userId: user.id,
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 异步action：发送文字消息
export const sendTextMessage = createAsyncThunk(
  "socket/sendTextMessage",
  async ({ content }, { dispatch, getState, rejectWithValue }) => {
    try {
      const { socket } = getState();
      const user = JSON.parse(localStorage.getItem("user"));

      if (!socket.isConnected) {
        throw new Error("Socket未连接");
      }

      const messageData = {
        user_id: user.id,
        info: { ...user },
        input: {
          type: "text",
          content: content,
        },
      };

      socketService.sendTextMessage(messageData);

      // 添加用户消息到状态
      dispatch(
        addMessage({
          content,
          role: "user",
          type: "text",
          timestamp: new Date(),
        })
      );

      dispatch(setSending(true));

      return messageData;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 异步action：发送语音消息
export const sendAudioMessage = createAsyncThunk(
  "socket/sendAudioMessage",
  async (
    { audioBuffer, metadata },
    { dispatch, getState, rejectWithValue }
  ) => {
    try {
      const { socket } = getState();
      const user = JSON.parse(localStorage.getItem("user"));

      if (!socket.isConnected) {
        throw new Error("Socket未连接");
      }

      const messageMetadata = {
        userInfo: {
          user_id: user.id,
          info: { ...user },
          input: {
            type: "audio",
          },
        },
        format: metadata?.format || "webm",
        duration: metadata?.duration || 0,
      };

      socketService.sendAudioMessage(audioBuffer, messageMetadata);

      // 创建音频URL用于播放
      const blob = new Blob([audioBuffer], { type: "audio/webm;codecs=opus" });
      const audioUrl = URL.createObjectURL(blob);

      // 添加用户语音消息到状态
      dispatch(
        addMessage({
          content: "[语音消息]",
          role: "user",
          type: "audio",
          audioUrl,
          timestamp: new Date(),
        })
      );

      dispatch(setSending(true));

      return {
        audioSize: audioBuffer.byteLength,
        metadata: messageMetadata,
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Socket slice
const socketSlice = createSlice({
  name: "socket",
  initialState: {
    // 连接状态
    isConnected: false,
    isConnecting: false,
    socketId: null,
    connectionError: null,

    // 消息状态
    messages: [],
    isSending: false,
    isProcessing: false,

    // 语音状态
    isRecording: false,
    isListening: false,

    // 其他状态
    summary: null,
    error: null,
    activated: false,
  },
  reducers: {
    // 更新连接状态
    updateConnectionStatus: (state, action) => {
      const { status, socketId, reason, error } = action.payload;

      switch (status) {
        case "connected":
          state.isConnected = true;
          state.isConnecting = false;
          state.socketId = socketId;
          state.connectionError = null;
          break;
        case "disconnected":
          state.isConnected = false;
          state.isConnecting = false;
          state.connectionError = reason;
          break;
        case "error":
          state.isConnected = false;
          state.isConnecting = false;
          state.connectionError = error;
          break;
        case "reconnected":
          state.isConnected = true;
          state.isConnecting = false;
          state.connectionError = null;
          break;
        case "reconnect_failed":
          state.isConnected = false;
          state.isConnecting = false;
          state.connectionError = "重连失败";
          break;
        default:
          break;
      }
    },

    // 添加消息
    addMessage: (state, action) => {
      state.messages.push(action.payload);
      state.activated = true;

      // 如果是AI回复，停止发送状态
      if (action.payload.role === "assistant") {
        state.isSending = false;
        state.isProcessing = false;
      }
    },

    // 设置发送状态
    setSending: (state, action) => {
      state.isSending = action.payload;
    },

    // 设置处理状态
    setProcessing: (state, action) => {
      state.isProcessing = action.payload;
    },

    // 设置录音状态
    setRecording: (state, action) => {
      state.isRecording = action.payload;
    },

    // 设置语音识别状态
    setListening: (state, action) => {
      state.isListening = action.payload;
    },

    // 接收总结
    receiveSummary: (state, action) => {
      state.summary = action.payload;
      state.isSending = false;
      state.isProcessing = false;
    },

    // 设置错误
    setError: (state, action) => {
      state.error = action.payload;
      state.isSending = false;
      state.isProcessing = false;
    },

    // 清除错误
    clearError: (state) => {
      state.error = null;
    },

    // 清除消息
    clearMessages: (state) => {
      state.messages = [];
      state.activated = false;
    },

    // 重置状态
    resetSocket: (state) => {
      return {
        ...socketSlice.getInitialState(),
      };
    },
  },
  extraReducers: (builder) => {
    builder
      // 初始化Socket
      .addCase(initializeSocket.pending, (state) => {
        state.isConnecting = true;
        state.connectionError = null;
      })
      .addCase(initializeSocket.fulfilled, (state, action) => {
        state.isConnecting = false;
        state.socketId = action.payload.socketId;
      })
      .addCase(initializeSocket.rejected, (state, action) => {
        state.isConnecting = false;
        state.connectionError = action.payload;
      })

      // 发送文字消息
      .addCase(sendTextMessage.pending, (state) => {
        state.isSending = true;
        state.error = null;
      })
      .addCase(sendTextMessage.fulfilled, (state) => {
        // isSending 状态在收到回复时才会变为false
      })
      .addCase(sendTextMessage.rejected, (state, action) => {
        state.isSending = false;
        state.error = action.payload;
      })

      // 发送语音消息
      .addCase(sendAudioMessage.pending, (state) => {
        state.isSending = true;
        state.error = null;
      })
      .addCase(sendAudioMessage.fulfilled, (state) => {
        // isSending 状态在收到回复时才会变为false
      })
      .addCase(sendAudioMessage.rejected, (state, action) => {
        state.isSending = false;
        state.error = action.payload;
      });
  },
});

export const {
  updateConnectionStatus,
  addMessage,
  setSending,
  setProcessing,
  setRecording,
  setListening,
  receiveSummary,
  setError,
  clearError,
  clearMessages,
  resetSocket,
} = socketSlice.actions;

export default socketSlice.reducer;
